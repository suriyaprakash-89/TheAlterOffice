import { buildShareUrl } from '../lib/api';

export default function DashboardFrame({
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
