const store = require('../models/todoStore');

function index(req, res) {
  res.json(store.listLists(req.auth.user.id));
}

async function create(req, res, next) {
  try {
    const result = await store.createList(req.auth.user.id, req.body?.name);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

function show(req, res, next) {
  try {
    res.json(store.getList(req.auth.user.id, req.params.listId));
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const result = await store.renameList(req.auth.user.id, req.params.listId, req.body?.name);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const result = await store.deleteList(req.auth.user.id, req.params.listId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function share(req, res, next) {
  try {
    const result = await store.shareList(req.auth.user.id, req.params.listId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function unshare(req, res, next) {
  try {
    const result = await store.unshareList(req.auth.user.id, req.params.listId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function addItem(req, res, next) {
  try {
    const result = await store.addItem(req.auth.user.id, req.params.listId, req.body?.text, req.body?.tags || []);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  index,
  create,
  show,
  update,
  remove,
  share,
  unshare,
  addItem
};
