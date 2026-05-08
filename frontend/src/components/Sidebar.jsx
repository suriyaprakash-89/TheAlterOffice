export default function Sidebar({ user, lists, selectedListId, onSelectList, onCreateList, onDeleteList, newListName, setNewListName }) {
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
