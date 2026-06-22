import type { HarnessThreadInfo } from '@mastra/client-js';
import { useState } from 'react';

interface ThreadSidebarProps {
  threads: HarnessThreadInfo[];
  activeThreadId?: string;
  onSwitch: (threadId: string) => void;
  onCreate: (title?: string) => void;
  onRename: (threadId: string, title: string) => void;
  onDelete: (threadId: string) => void;
  onClose: () => void;
}

export function ThreadSidebar({
  threads,
  activeThreadId,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
  onClose,
}: ThreadSidebarProps) {
  const [newTitle, setNewTitle] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const sorted = [...threads].sort((a, b) => {
    const ta = a.updatedAt ?? a.createdAt ?? '';
    const tb = b.updatedAt ?? b.createdAt ?? '';
    return tb.localeCompare(ta);
  });

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Threads</span>
        <button className="theme-toggle" onClick={onClose} title="Close sidebar">✕</button>
      </div>

      <form
        className="sidebar-new"
        onSubmit={e => {
          e.preventDefault();
          onCreate(newTitle.trim() || undefined);
          setNewTitle('');
        }}
      >
        <input
          className="input"
          style={{ fontSize: 12, padding: '5px 8px' }}
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="New thread title…"
        />
        <button className="btn btn-primary btn-sm" type="submit">+</button>
      </form>

      <div className="sidebar-list">
        {sorted.length === 0 && (
          <div className="sidebar-empty">No threads yet</div>
        )}
        {sorted.map(t => {
          const isActive = t.id === activeThreadId;
          const isRenaming = renamingId === t.id;

          return (
            <div
              key={t.id}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
            >
              {isRenaming ? (
                <form
                  className="sidebar-rename"
                  onSubmit={e => {
                    e.preventDefault();
                    if (renameValue.trim()) {
                      onRename(t.id, renameValue.trim());
                    }
                    setRenamingId(null);
                  }}
                >
                  <input
                    className="input"
                    style={{ fontSize: 12, padding: '3px 6px', flex: 1 }}
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    autoFocus
                    onBlur={() => setRenamingId(null)}
                  />
                </form>
              ) : (
                <>
                  <button
                    className="sidebar-item-btn"
                    onClick={() => onSwitch(t.id)}
                  >
                    <span className="sidebar-item-title">
                      {t.title || t.id.slice(0, 12)}
                    </span>
                    {t.updatedAt && (
                      <span className="sidebar-item-date">
                        {new Date(t.updatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </button>
                  <div className="sidebar-item-actions">
                    <button
                      className="sidebar-action"
                      title="Rename"
                      onClick={e => {
                        e.stopPropagation();
                        setRenamingId(t.id);
                        setRenameValue(t.title ?? '');
                      }}
                    >
                      ✏️
                    </button>
                    <button
                      className="sidebar-action"
                      title="Delete"
                      onClick={e => {
                        e.stopPropagation();
                        onDelete(t.id);
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
