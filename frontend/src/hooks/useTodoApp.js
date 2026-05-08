import { useEffect, useMemo, useState } from 'react';
import { buildShareUrl, request } from '../lib/api';
import { parseTags } from '../lib/todoUtils';

export function useTodoApp() {
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
    [lists, selectedListId]
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

  async function refreshLists(activeToken = token) {
    const data = await request('/api/lists', { token: activeToken });
    setLists(data.lists || []);
    return data.lists || [];
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
      const listResponse = await refreshLists(data.token);
      setSelectedListId(listResponse[0]?.id || '');
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
          list.id === selectedList.id ? { ...list, shareToken: data.shareToken, publicUrl: data.publicUrl, isPublic: true } : list
        )
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
        currentLists.map((list) => (list.id === selectedList.id ? { ...list, shareToken: null, publicUrl: null, isPublic: false } : list))
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
      await refreshLists();
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
      await refreshLists();
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
      await refreshLists();
    } catch (error) {
      showMessage(error.message);
    }
  }

  async function deleteItem(itemId) {
    try {
      await request(`/api/items/${itemId}`, { token, method: 'DELETE' });
      await refreshLists();
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
      await refreshLists();
    } catch (error) {
      showMessage(error.message);
    }
  }

  function beginEdit(item) {
    setEditingItemId(item.id);
    setEditingItemForm({ text: item.text, tags: item.tags.join(', ') });
  }

  return {
    authMode,
    setAuthMode,
    authForm,
    setAuthForm,
    token,
    user,
    lists,
    selectedListId,
    setSelectedListId,
    selectedTag,
    setSelectedTag,
    newListName,
    setNewListName,
    itemForm,
    setItemForm,
    editingItemId,
    setEditingItemId,
    editingItemForm,
    setEditingItemForm,
    message,
    loading,
    sharingBusy,
    isSharedRoute,
    sharedList,
    visibleList,
    visibleItems,
    tagStats,
    selectedList,
    sharedView,
    handleAuthSubmit,
    handleLogout,
    createList,
    renameList,
    deleteList,
    shareList,
    unshareList,
    addItem,
    saveItem,
    toggleItem,
    deleteItem,
    moveItem,
    beginEdit,
    showMessage
  };
}
