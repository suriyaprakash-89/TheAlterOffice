import { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function apiPath(path) {
  return `${API_BASE}${path}`;
}

async function request(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(apiPath(path), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }
  return payload;
}

function buildShareUrl(sharePath) {
  if (!sharePath) return '';
  return `${window.location.origin}${sharePath}`;
}

function parseTags(value) {
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim().replace(/^#/, '').toLowerCase())
    .filter(Boolean);
}

function App() {
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [token, setToken] = useState(() => window.localStorage.getItem('todo-token') || '');
  const [user, setUser] = useState(null);
  const [lists, setLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState('');
  const [selectedTag, setSelectedTag] = useState('all');
  const [newListName, setNewListName] = useState('');
  const [itemForm, setItemForm] = useState({ text: '', tags: '' });
  const [editingItemId, setEditingItemId] = useState('');
  const [editingItemForm, setEditingItemForm] = useState({ text: '', tags: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sharingBusy, setSharingBusy] = useState(false);
  const [sharedView, setSharedView] = useState(null);

  const isSharedRoute = window.location.pathname.startsWith('/share/');
  const shareToken = isSharedRoute ? window.location.pathname.split('/share/')[1] : '';

  const selectedList = useMemo(
    () => lists.find((list) => list.id === selectedListId) || lists[0] || null,
    [lists, selectedListId],
  );

  const sharedList = sharedView?.list || null;

  const visibleList = isSharedRoute ? sharedList : selectedList;
  const visibleItems = useMemo(() => {
    const items = visibleList?.items || [];
    if (!selectedTag || selectedTag === 'all') return items;
    return items.filter((item) => (item.tags || []).includes(selectedTag));
  }, [visibleList, selectedTag]);

  const tagStats = visibleList?.stats?.tagCounts || {};

  useEffect(() => {
    if (!token || isSharedRoute) {
      setLoading(false);
      return;
    }

    let active = true;
    request('/api/me', { token })
      .then((data) => {
        if (!active) return;
        setUser(data.user);
      })
      .catch(() => {
        window.localStorage.removeItem('todo-token');
        setToken('');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token, isSharedRoute]);

  useEffect(() => {
    if (!token || isSharedRoute) return;

    let active = true;
    request('/api/lists', { token })
      .then((data) => {
        if (!active) return;
        setLists(data.lists || []);
        if (!selectedListId && data.lists?.length) {
          setSelectedListId(data.lists[0].id);
        }
      })
      .catch((error) => setMessage(error.message))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token, isSharedRoute, selectedListId]);

  useEffect(() => {
    if (!isSharedRoute || !shareToken) return;

    let active = true;
    request(`/api/public/lists/${shareToken}`)
      .then((data) => {
        if (!active) return;
        setSharedView(data);
      })
      .catch((error) => setMessage(error.message))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isSharedRoute, shareToken]);

  useEffect(() => {
    if (!selectedList && lists.length) {
      setSelectedListId(lists[0].id);
    }
  }, [lists, selectedList]);

  useEffect(() => {
    setSelectedTag('all');
  }, [selectedListId]);

  useEffect(() => {
    if (!visibleList) return;
    setSelectedTag((currentTag) => (visibleList.stats.tagCounts[currentTag] ? currentTag : 'all'));
  }, [visibleList]);

  function showMessage(text) {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 3000);
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    const endpoint = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
    try {
      const data = await request(endpoint, {
        method: 'POST',
        body: authMode === 'signup' ? authForm : { email: authForm.email, password: authForm.password }
      });
      setToken(data.token);
      window.localStorage.setItem('todo-token', data.token);
      setUser(data.user);
      setAuthForm({ name: '', email: '', password: '' });
      const listResponse = await request('/api/lists', { token: data.token });
      setLists(listResponse.lists || []);
      setSelectedListId(listResponse.lists?.[0]?.id || '');
      showMessage(authMode === 'signup' ? 'Account created' : 'Logged in');
    } catch (error) {
      showMessage(error.message);
    }
  }

  async function handleLogout() {
    try {
      await request('/api/auth/logout', { token, method: 'POST' });
    } catch {
      // Ignore logout failures and clear the session locally.
    }
    window.localStorage.removeItem('todo-token');
    setToken('');
    setUser(null);
    setLists([]);
    setSelectedListId('');
    setMessage('');
  }

  async function createList() {
    if (!newListName.trim()) return showMessage('Enter a list name');
    try {
      const data = await request('/api/lists', {
        token,
        method: 'POST',
        body: { name: newListName }
      });
      setLists((currentLists) => [data.list, ...currentLists]);
      setSelectedListId(data.list.id);
      setNewListName('');
      showMessage('List created');
    } catch (error) {
      showMessage(error.message);
    }
  }

  async function renameList() {
    if (!selectedList) return;
    const nextName = window.prompt('Rename list', selectedList.name);
    if (!nextName || !nextName.trim()) return;
    try {
      const data = await request(`/api/lists/${selectedList.id}`, {
        token,
        method: 'PATCH',
        body: { name: nextName }
      });
      setLists((currentLists) => currentLists.map((list) => (list.id === data.list.id ? data.list : list)));
      showMessage('List renamed');
    } catch (error) {
      showMessage(error.message);
    }
  }

  async function deleteList(listId) {
    if (!window.confirm('Delete this todo list?')) return;
    try {
      await request(`/api/lists/${listId}`, { token, method: 'DELETE' });
      setLists((currentLists) => currentLists.filter((list) => list.id !== listId));
      setSelectedListId((current) => (current === listId ? '' : current));
      showMessage('List deleted');
    } catch (error) {
      showMessage(error.message);
    }
  }

  async function shareList() {
    if (!selectedList) return;
    setSharingBusy(true);
    try {
      const data = await request(`/api/lists/${selectedList.id}/share`, {
        token,
        method: 'POST'
      });
      const shareUrl = buildShareUrl(data.publicUrl);
      await navigator.clipboard.writeText(shareUrl);
      setLists((currentLists) =>
        currentLists.map((list) =>
          list.id === selectedList.id ? { ...list, shareToken: data.shareToken, publicUrl: data.publicUrl, isPublic: true } : list,
        ),
      );
      showMessage('Public link copied');
    } catch (error) {
      showMessage(error.message);
    } finally {
      setSharingBusy(false);
    }
  }

  async function unshareList() {
    if (!selectedList) return;
    try {
      await request(`/api/lists/${selectedList.id}/share`, {
        token,
        method: 'DELETE'
      });
      setLists((currentLists) =>
        currentLists.map((list) => (list.id === selectedList.id ? { ...list, shareToken: null, publicUrl: null, isPublic: false } : list)),
      );
      showMessage('Public link revoked');
    } catch (error) {
      showMessage(error.message);
    }
  }

  async function addItem() {
    if (!selectedList || !itemForm.text.trim()) return showMessage('Enter todo text');
    try {
      await request(`/api/lists/${selectedList.id}/items`, {
        token,
        method: 'POST',
        body: { text: itemForm.text, tags: parseTags(itemForm.tags) }
      });
      const data = await request('/api/lists', { token });
      setLists(data.lists || []);
      setItemForm({ text: '', tags: '' });
      showMessage('Todo item added');
    } catch (error) {
      showMessage(error.message);
    }
  }

  async function saveItem(itemId) {
    try {
      await request(`/api/items/${itemId}`, {
        token,
        method: 'PATCH',
        body: {
          text: editingItemForm.text,
          tags: parseTags(editingItemForm.tags)
        }
      });
      const data = await request('/api/lists', { token });
      setLists(data.lists || []);
      setEditingItemId('');
      showMessage('Todo item updated');
    } catch (error) {
      showMessage(error.message);
    }
  }

  async function toggleItem(item) {
    try {
      await request(`/api/items/${item.id}`, {
        token,
        method: 'PATCH',
        body: { completed: !item.completed }
      });
      const data = await request('/api/lists', { token });
      setLists(data.lists || []);
    } catch (error) {
      showMessage(error.message);
    }
  }

  async function deleteItem(itemId) {
    try {
      await request(`/api/items/${itemId}`, { token, method: 'DELETE' });
      const data = await request('/api/lists', { token });
      setLists(data.lists || []);
      showMessage('Todo item deleted');
    } catch (error) {
      showMessage(error.message);
    }
  }

  async function moveItem(itemId, direction) {
    try {
      await request(`/api/items/${itemId}/move`, {
        token,
        method: 'POST',
        body: { direction }
      });
      const data = await request('/api/lists', { token });
      setLists(data.lists || []);
    } catch (error) {
      showMessage(error.message);
    }
  }

  function beginEdit(item) {
    setEditingItemId(item.id);
    setEditingItemForm({ text: item.text, tags: item.tags.join(', ') });
  }

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (isSharedRoute) {
    return (
      <div className="app-shell shared-shell">
        <SharedBanner list={sharedList} />
        <DashboardFrame
          list={sharedList}
          visibleItems={visibleItems}
          tagStats={tagStats}
          selectedTag={selectedTag}
          onSelectTag={setSelectedTag}
          readOnly
          user={null}
          message={message}
        />
      </div>
    );
  }

  if (!token || !user) {
    return (
      <AuthScreen
        mode={authMode}
        onModeChange={setAuthMode}
        form={authForm}
        setForm={setAuthForm}
        onSubmit={handleAuthSubmit}
        message={message}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        lists={lists}
        selectedListId={selectedListId}
        onSelectList={setSelectedListId}
        onCreateList={createList}
        onDeleteList={deleteList}
        newListName={newListName}
        setNewListName={setNewListName}
      />

      <DashboardFrame
        list={selectedList}
        visibleItems={visibleItems}
        tagStats={tagStats}
        selectedTag={selectedTag}
        onSelectTag={setSelectedTag}
        onRenameList={renameList}
        onShareList={shareList}
        onUnshareList={unshareList}
        onItemFormChange={setItemForm}
        itemForm={itemForm}
        onAddItem={addItem}
        onToggleItem={toggleItem}
        onDeleteItem={deleteItem}
        onMoveItem={moveItem}
        onBeginEdit={beginEdit}
        editingItemId={editingItemId}
        editingItemForm={editingItemForm}
        setEditingItemForm={setEditingItemForm}
        onSaveItem={saveItem}
        onCancelEdit={() => setEditingItemId('')}
        sharingBusy={sharingBusy}
        onLogout={handleLogout}
        message={message}
        token={token}
      />
    </div>
  );
}

function AuthScreen({ mode, onModeChange, form, setForm, onSubmit, message }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-mark">TaskNest</div>
        <h1>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
        <p>Manage todo lists, tags, stats, and public links from one place.</p>

        <div className="auth-tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => onModeChange('login')} type="button">
            Log in
          </button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => onModeChange('signup')} type="button">
            Sign up
          </button>
        </div>

        <form onSubmit={onSubmit} className="auth-form">
          {mode === 'signup' ? (
            <label>
              Name
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
          ) : null}
          <label>
            Email
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          <label>
            Password
            <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </label>
          <button type="submit" className="primary-btn">
            {mode === 'signup' ? 'Create account' : 'Log in'}
          </button>
        </form>
        {message ? <p className="flash-message">{message}</p> : null}
      </div>
    </div>
  );
}

function Sidebar({ user, lists, selectedListId, onSelectList, onCreateList, onDeleteList, newListName, setNewListName }) {
  return (
    <aside className="sidebar-panel">
      <div className="sidebar-header">
        <div>
          <div className="user-name">{user.name}</div>
        </div>
        <button type="button" className="icon-button ghost" onClick={() => window.location.reload()} aria-label="Refresh">
          ↻
        </button>
      </div>

      <div className="sidebar-section-title">My Lists</div>
      <div className="list-stack">
        {lists.map((list) => (
          <div key={list.id} className={`list-item ${selectedListId === list.id ? 'selected' : ''}`}>
            <button type="button" className="list-item-main" onClick={() => onSelectList(list.id)}>
              <span>{list.name}</span>
              <strong>{list.stats.total}</strong>
            </button>
            <button type="button" className="list-item-delete" onClick={() => onDeleteList(list.id)} aria-label={`Delete ${list.name}`}>
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="new-list-box">
        <input value={newListName} onChange={(event) => setNewListName(event.target.value)} placeholder="New list name" />
        <button type="button" onClick={onCreateList} className="secondary-btn">
          + New List
        </button>
      </div>
    </aside>
  );
}

function DashboardFrame({
  list,
  visibleItems,
  tagStats,
  selectedTag,
  onSelectTag,
  onRenameList,
  onShareList,
  onUnshareList,
  onItemFormChange,
  itemForm,
  onAddItem,
  onToggleItem,
  onDeleteItem,
  onMoveItem,
  onBeginEdit,
  editingItemId,
  editingItemForm,
  setEditingItemForm,
  onSaveItem,
  onCancelEdit,
  sharingBusy,
  onLogout,
  message,
  token,
  readOnly = false,
  user = null,
}) {
  const shareLink = list?.publicUrl ? buildShareUrl(list.publicUrl) : '';
  const tagEntries = Object.entries(tagStats);

  return (
    <section className="workspace-panel">
      <div className="workspace-topbar">
        <div className="workspace-title">
          <h1>{list?.name || 'Todo List'}</h1>
          {list?.isPublic ? <span className="status-badge public">Public</span> : null}
          {readOnly ? <span className="status-badge shared">Shared view</span> : null}
          {!readOnly && list ? (
            <button type="button" className="icon-button" onClick={onRenameList} aria-label="Rename list">
              ✎
            </button>
          ) : null}
        </div>

        <div className="workspace-actions">
          {!readOnly && list ? (
            <>
              <button type="button" className="primary-black" onClick={onShareList} disabled={sharingBusy}>
                + New Task
              </button>
              {list.isPublic ? (
                <button type="button" className="secondary-btn" onClick={onUnshareList}>
                  Revoke Link
                </button>
              ) : null}
            </>
          ) : null}
          {!readOnly && token ? (
            <button type="button" className="ghost-link" onClick={onLogout}>
              Log out
            </button>
          ) : null}
        </div>
      </div>

      {shareLink ? (
        <div className="share-strip">
          <span>Public link</span>
          <a href={shareLink} target="_blank" rel="noreferrer">
            {shareLink}
          </a>
        </div>
      ) : null}

      {!readOnly && list ? (
        <div className="task-entry">
          <input
            value={itemForm.text}
            onChange={(event) => onItemFormChange((current) => ({ ...current, text: event.target.value }))}
            placeholder="Add a new todo item"
          />
          <input
            value={itemForm.tags}
            onChange={(event) => onItemFormChange((current) => ({ ...current, tags: event.target.value }))}
            placeholder="Tags, separated by commas"
          />
          <button type="button" className="primary-btn add-item-btn" onClick={onAddItem}>
            Add
          </button>
        </div>
      ) : null}

      <div className="task-filters">
        <button className={selectedTag === 'all' ? 'active' : ''} onClick={() => onSelectTag('all')} type="button">
          All
        </button>
        {tagEntries.map(([tag, count]) => (
          <button className={selectedTag === tag ? 'active' : ''} onClick={() => onSelectTag(tag)} type="button" key={tag}>
            #{tag} <span>{count}</span>
          </button>
        ))}
      </div>

      <div className="content-grid">
        <div className="task-list">
          {visibleItems.length ? (
            visibleItems.map((item) => (
              <article className={`task-row ${item.completed ? 'done' : ''}`} key={item.id}>
                <label className="task-main">
                  <input type="checkbox" checked={item.completed} onChange={() => (readOnly ? null : onToggleItem(item))} disabled={readOnly} />
                  {editingItemId === item.id ? (
                    <div className="edit-stack">
                      <input
                        value={editingItemForm.text}
                        onChange={(event) => setEditingItemForm((current) => ({ ...current, text: event.target.value }))}
                      />
                      <input
                        value={editingItemForm.tags}
                        onChange={(event) => setEditingItemForm((current) => ({ ...current, tags: event.target.value }))}
                      />
                    </div>
                  ) : (
                    <div className="task-body">
                      <div className="task-text">{item.text}</div>
                      <div className="tag-wrap">
                        {(item.tags || []).map((tag) => (
                          <span className="tag-chip" key={tag}>
                            #{tag}
                          </span>
                        ))}
                        {!item.tags?.length ? <span className="tag-chip muted">No tag</span> : null}
                      </div>
                    </div>
                  )}
                </label>

                {!readOnly ? (
                  <div className="task-actions">
                    {editingItemId === item.id ? (
                      <>
                        <button type="button" className="icon-button" onClick={() => onSaveItem(item.id)}>
                          Save
                        </button>
                        <button type="button" className="icon-button ghost" onClick={onCancelEdit}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="icon-button" onClick={() => onBeginEdit(item)}>
                          Edit
                        </button>
                        <button type="button" className="icon-button ghost" onClick={() => onMoveItem(item.id, 'up')}>
                          ↑
                        </button>
                        <button type="button" className="icon-button ghost" onClick={() => onMoveItem(item.id, 'down')}>
                          ↓
                        </button>
                        <button type="button" className="icon-button danger" onClick={() => onDeleteItem(item.id)}>
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <div className="empty-state">No todos match the current filter.</div>
          )}
        </div>

        <aside className="stats-panel">
          <div className="panel-card">
            <div className="panel-title">List Statistics</div>
            <div className="stat-line"><span>Total Tasks</span><strong>{list?.stats?.total || 0}</strong></div>
            <div className="stat-line"><span>Pending</span><strong className="pending">{list?.stats?.pending || 0}</strong></div>
            <div className="stat-line"><span>Completed</span><strong className="completed">{list?.stats?.completed || 0}</strong></div>
          </div>

          <div className="panel-card">
            {tagEntries.length ? (
              tagEntries.map(([tag, count]) => (
                <div className="stat-line compact" key={tag}>
                  <span>#{tag}</span>
                  <strong>{count}</strong>
                </div>
              ))
            ) : (
              <div className="stat-line compact"><span>No Tag</span><strong>0</strong></div>
            )}
            {list?.stats?.tagCounts?.['no tag'] ? (
              <div className="stat-line compact">
                <span>No Tag</span>
                <strong>{list.stats.tagCounts['no tag']}</strong>
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      {message ? <div className="toast">{message}</div> : null}
    </section>
  );
}

function SharedBanner({ list }) {
  return (
    <div className="shared-banner">
      <strong>Publicly shared todo list</strong>
      <span>{list?.name || 'Shared list'}</span>
    </div>
  );
}

export default App;
