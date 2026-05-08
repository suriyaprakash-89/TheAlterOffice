const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

const seedState = {
  users: [],
  sessions: [],
  lists: [],
  items: [],
  shares: []
};

let state = { ...seedState };
let writeQueue = Promise.resolve();

class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
  }
}

function uid(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function now() {
  return new Date().toISOString();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeTag(tag) {
  return String(tag || '').trim().replace(/^#/, '').toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, passwordRecord) {
  const computed = crypto.pbkdf2Sync(password, passwordRecord.salt, 120000, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(passwordRecord.hash, 'hex'));
}

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(seedState, null, 2));
  }
}

async function load() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  state = raw ? JSON.parse(raw) : { ...seedState };

  for (const key of Object.keys(seedState)) {
    if (!Array.isArray(state[key])) {
      state[key] = [];
    }
  }
}

function save() {
  writeQueue = writeQueue.then(() => fs.writeFile(DATA_FILE, JSON.stringify(state, null, 2)));
  return writeQueue;
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

function publicList(list, userId) {
  return {
    id: list.id,
    name: list.name,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
    shareToken: list.shareToken,
    isPublic: Boolean(list.shareToken),
    isOwner: list.ownerId === userId,
    publicUrl: list.shareToken ? `/share/${list.shareToken}` : null,
    items: getItemsForList(list.id),
    stats: calculateStats(list.id)
  };
}

function getItemsForList(listId) {
  return state.items
    .filter((item) => item.listId === listId)
    .sort((left, right) => left.order - right.order || left.createdAt.localeCompare(right.createdAt));
}

function calculateStats(listId) {
  const items = getItemsForList(listId);
  const completed = items.filter((item) => item.completed).length;
  const pending = items.length - completed;
  const tagCounts = {};

  for (const item of items) {
    if (!item.tags.length) {
      tagCounts['no tag'] = (tagCounts['no tag'] || 0) + 1;
      continue;
    }

    for (const tag of item.tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  return {
    total: items.length,
    completed,
    pending,
    tagCounts
  };
}

function requireUser(userId) {
  const user = state.users.find((entry) => entry.id === userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return user;
}

function requireListForUser(listId, userId) {
  const list = state.lists.find((entry) => entry.id === listId && entry.ownerId === userId);
  if (!list) {
    throw new AppError('List not found', 404);
  }
  return list;
}

function requireItemForUser(itemId, userId) {
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item) {
    throw new AppError('Todo item not found', 404);
  }

  const list = state.lists.find((entry) => entry.id === item.listId && entry.ownerId === userId);
  if (!list) {
    throw new AppError('List not found', 404);
  }

  return { item, list };
}

function authenticateToken(token) {
  if (!token) {
    return null;
  }

  const session = state.sessions.find((entry) => entry.token === token);
  if (!session) {
    return null;
  }

  const user = state.users.find((entry) => entry.id === session.userId);
  if (!user) {
    return null;
  }

  return { user, session };
}

function createDefaultList(userId) {
  const createdAt = now();
  const defaultList = {
    id: uid('lst'),
    ownerId: userId,
    name: 'Groceries',
    createdAt,
    updatedAt: createdAt,
    shareToken: null
  };

  state.lists.push(defaultList);
  state.items.push(
    {
      id: uid('itm'),
      listId: defaultList.id,
      text: 'Snacks',
      completed: false,
      tags: ['important', 'time-sensitive'],
      order: 1,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: uid('itm'),
      listId: defaultList.id,
      text: 'Vegetables',
      completed: false,
      tags: ['healthy', 'time-sensitive'],
      order: 2,
      createdAt,
      updatedAt: createdAt
    }
  );

  return defaultList;
}

async function signup({ name, email, password }) {
  const normalizedEmail = normalizeEmail(email);
  if (!name || !normalizedEmail || !password || password.length < 6) {
    throw new AppError('Provide name, email, and a password with at least 6 characters', 400);
  }

  if (state.users.some((user) => user.email === normalizedEmail)) {
    throw new AppError('Email already exists', 409);
  }

  const passwordRecord = hashPassword(password);
  const user = {
    id: uid('usr'),
    name: String(name).trim(),
    email: normalizedEmail,
    password: passwordRecord,
    createdAt: now()
  };

  const token = uid('tok');
  state.users.push(user);
  state.sessions.push({ token, userId: user.id, createdAt: now() });
  createDefaultList(user.id);
  await save();
  return { token, user: publicUser(user) };
}

async function login({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const user = state.users.find((entry) => entry.email === normalizedEmail);
  if (!user || !verifyPassword(String(password || ''), user.password)) {
    throw new AppError('Invalid email or password', 401);
  }

  const token = uid('tok');
  state.sessions.push({ token, userId: user.id, createdAt: now() });
  await save();
  return { token, user: publicUser(user) };
}

async function logout(sessionToken) {
  state.sessions = state.sessions.filter((entry) => entry.token !== sessionToken);
  await save();
  return { ok: true };
}

function me(userId) {
  return { user: publicUser(requireUser(userId)) };
}

function listLists(userId) {
  return {
    lists: state.lists.filter((list) => list.ownerId === userId).map((list) => publicList(list, userId))
  };
}

async function createList(userId, name) {
  if (typeof name !== 'string' || !name.trim()) {
    throw new AppError('List name is required', 400);
  }

  const createdAt = now();
  const list = {
    id: uid('lst'),
    ownerId: userId,
    name: name.trim(),
    createdAt,
    updatedAt: createdAt,
    shareToken: null
  };

  state.lists.push(list);
  await save();
  return { list: publicList(list, userId) };
}

async function renameList(userId, listId, name) {
  const list = requireListForUser(listId, userId);
  if (typeof name !== 'string' || !name.trim()) {
    throw new AppError('List name is required', 400);
  }

  list.name = name.trim();
  list.updatedAt = now();
  await save();
  return { list: publicList(list, userId) };
}

async function deleteList(userId, listId) {
  requireListForUser(listId, userId);
  state.lists = state.lists.filter((entry) => entry.id !== listId);
  state.items = state.items.filter((item) => item.listId !== listId);
  state.shares = state.shares.filter((entry) => entry.listId !== listId);
  await save();
  return { ok: true };
}

async function shareList(userId, listId) {
  const list = requireListForUser(listId, userId);
  if (!list.shareToken) {
    list.shareToken = uid('shr');
  }

  const createdAt = now();
  state.shares = state.shares.filter((entry) => entry.listId !== list.id);
  state.shares.push({ listId: list.id, shareToken: list.shareToken, createdAt });
  list.updatedAt = createdAt;
  await save();
  return {
    shareToken: list.shareToken,
    publicUrl: `/share/${list.shareToken}`
  };
}

async function unshareList(userId, listId) {
  const list = requireListForUser(listId, userId);
  list.shareToken = null;
  list.updatedAt = now();
  state.shares = state.shares.filter((entry) => entry.listId !== list.id);
  await save();
  return { ok: true };
}

function getList(userId, listId) {
  const list = requireListForUser(listId, userId);
  return { list: publicList(list, userId) };
}

async function addItem(userId, listId, text, tags = []) {
  const list = requireListForUser(listId, userId);
  if (typeof text !== 'string' || !text.trim()) {
    throw new AppError('Todo text is required', 400);
  }

  const items = getItemsForList(list.id);
  const nextOrder = items.length ? Math.max(...items.map((item) => item.order)) + 1 : 1;
  const createdAt = now();
  const item = {
    id: uid('itm'),
    listId: list.id,
    text: text.trim(),
    completed: false,
    tags: Array.isArray(tags) ? tags.map(normalizeTag).filter(Boolean) : [],
    order: nextOrder,
    createdAt,
    updatedAt: createdAt
  };

  state.items.push(item);
  list.updatedAt = createdAt;
  await save();
  return { item };
}

async function updateItem(userId, itemId, payload) {
  const { item, list } = requireItemForUser(itemId, userId);
  if (Object.prototype.hasOwnProperty.call(payload, 'text')) {
    if (typeof payload.text !== 'string' || !payload.text.trim()) {
      throw new AppError('Todo text is required', 400);
    }
    item.text = payload.text.trim();
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'completed')) {
    item.completed = Boolean(payload.completed);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'tags')) {
    item.tags = Array.isArray(payload.tags) ? payload.tags.map(normalizeTag).filter(Boolean) : [];
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'order')) {
    item.order = Number(payload.order) || item.order;
  }

  item.updatedAt = now();
  list.updatedAt = item.updatedAt;
  await save();
  return { item };
}

async function deleteItem(userId, itemId) {
  const { item, list } = requireItemForUser(itemId, userId);
  state.items = state.items.filter((entry) => entry.id !== item.id);
  list.updatedAt = now();
  await save();
  return { ok: true };
}

async function moveItem(userId, itemId, direction) {
  const { item, list } = requireItemForUser(itemId, userId);
  const items = getItemsForList(list.id);
  const index = items.findIndex((entry) => entry.id === item.id);
  const targetIndex = direction === 'up' ? index - 1 : index + 1;

  if (index < 0 || targetIndex < 0 || targetIndex >= items.length) {
    throw new AppError('Cannot reorder item', 400);
  }

  const swap = items[targetIndex];
  const originalOrder = item.order;
  item.order = swap.order;
  swap.order = originalOrder;
  const updatedAt = now();
  item.updatedAt = updatedAt;
  swap.updatedAt = updatedAt;
  list.updatedAt = updatedAt;
  await save();
  return { ok: true };
}

function getPublicList(shareToken) {
  const list = state.lists.find((entry) => entry.shareToken === shareToken);
  if (!list) {
    throw new AppError('Shared list not found', 404);
  }

  const owner = state.users.find((entry) => entry.id === list.ownerId);
  return {
    list: {
      id: list.id,
      name: list.name,
      owner: owner ? publicUser(owner) : null,
      isPublic: true,
      publicUrl: `/share/${list.shareToken}`,
      items: getItemsForList(list.id),
      stats: calculateStats(list.id)
    }
  };
}

module.exports = {
  AppError,
  init: load,
  authenticateToken,
  signup,
  login,
  logout,
  me,
  listLists,
  createList,
  renameList,
  deleteList,
  shareList,
  unshareList,
  getList,
  addItem,
  updateItem,
  deleteItem,
  moveItem,
  getPublicList
};
