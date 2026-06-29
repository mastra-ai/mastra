import type { AgentControllerThreadInfo } from '@mastra/client-js';
import { useEffect, useRef, useState } from 'react';

import { CloseIcon, EllipsisIcon, FolderIcon, PlusIcon, Wordmark } from './icons';
import type { Project } from './projects';

const MAX_THREADS = 5;

/** Compact relative time, e.g. "just now", "5m", "3h", "2d", or a date. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface SidebarProps {
  projects: Project[];
  activeProjectId: string | null;
  /** Open the app-level Projects modal (add / manage / switch). */
  onManageProjects: () => void;
  threads: AgentControllerThreadInfo[];
  activeThreadId?: string;
  onSwitchThread: (threadId: string) => void;
  onCreateThread: (title?: string) => void;
  onDeleteThread: (threadId: string) => void;
  onRenameThread: (threadId: string, title: string) => void;
  onCloneThread: (threadId: string) => void;
}

export function Sidebar({
  projects,
  activeProjectId,
  onManageProjects,
  threads,
  activeThreadId,
  onSwitchThread,
  onCreateThread,
  onDeleteThread,
  onRenameThread,
  onCloneThread,
}: SidebarProps) {
  // Per-thread action menu (⋯): which thread's menu is open, and inline-rename state.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close the action menu on outside click / Escape.
  useEffect(() => {
    if (!menuFor) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuFor(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuFor(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuFor]);

  const startRename = (t: AgentControllerThreadInfo) => {
    setMenuFor(null);
    setRenamingId(t.id);
    setRenameDraft(t.title ?? '');
  };

  const commitRename = (threadId: string) => {
    const title = renameDraft.trim();
    if (title) onRenameThread(threadId, title);
    setRenamingId(null);
    setRenameDraft('');
  };
  // ── Threads: sorted by most recent, limited to 5 ─────────────────────

  const sortedThreads = [...threads]
    .sort((a, b) => {
      const ta = a.updatedAt ?? a.createdAt ?? '';
      const tb = b.updatedAt ?? b.createdAt ?? '';
      return tb.localeCompare(ta);
    })
    .slice(0, MAX_THREADS);

  const activeProject = projects.find(p => p.id === activeProjectId);

  return (
    <div className="sidebar">
      {/* ── Brand ─────────────────────────────────────────────────────── */}
      <div className="sidebar-brand">
        <Wordmark compact className="sidebar-wordmark" />
      </div>

      {/* ── Project switcher (opens the app-level Projects modal) ─────── */}
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span className="sidebar-section-title">Project</span>
          <button
            className="sidebar-icon-btn"
            title="Manage projects"
            aria-label="Manage projects"
            onClick={onManageProjects}
          >
            <PlusIcon size={15} />
          </button>
        </div>

        <button
          className={`project-switcher ${activeProject ? '' : 'empty'}`}
          onClick={onManageProjects}
          title={activeProject ? activeProject.path : 'Select a project'}
        >
          <FolderIcon size={16} className="project-switcher-icon" />
          <span className="project-switcher-text">
            {activeProject ? (
              <>
                <span className="project-switcher-name">{activeProject.name}</span>
                <span className="project-switcher-path">{activeProject.path}</span>
              </>
            ) : (
              <span className="project-switcher-name">Select a project…</span>
            )}
          </span>
          <CloseIcon size={13} className="project-switcher-chevron" />
        </button>
      </div>

      {/* ── Threads (scoped to active project) ────────────────────────── */}
      {activeProject && (
        <div className="sidebar-section sidebar-section-grow">
          <div className="sidebar-section-header">
            <span className="sidebar-section-title">
              Threads {threads.length > 0 && <span className="sidebar-count">{threads.length}</span>}
            </span>
            <button
              className="sidebar-icon-btn"
              title="New thread"
              aria-label="New thread"
              onClick={() => onCreateThread()}
            >
              <PlusIcon size={15} />
            </button>
          </div>

          <div className="sidebar-list">
            {sortedThreads.length === 0 && <div className="sidebar-empty">No threads yet</div>}
            {sortedThreads.map(t =>
              renamingId === t.id ? (
                <div key={t.id} className="sidebar-thread renaming">
                  <input
                    className="sidebar-rename-input"
                    autoFocus
                    value={renameDraft}
                    placeholder="Thread title"
                    onChange={e => setRenameDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename(t.id);
                      if (e.key === 'Escape') {
                        setRenamingId(null);
                        setRenameDraft('');
                      }
                    }}
                    onBlur={() => commitRename(t.id)}
                  />
                </div>
              ) : (
                <div key={t.id} className={`sidebar-thread ${t.id === activeThreadId ? 'active' : ''}`}>
                  <button className="sidebar-thread-main" onClick={() => onSwitchThread(t.id)}>
                    <span className={`sidebar-thread-title ${t.title ? '' : 'untitled'}`}>{t.title || 'Untitled'}</span>
                    {t.updatedAt && <span className="sidebar-thread-date">{relativeTime(t.updatedAt)}</span>}
                  </button>
                  <div className="sidebar-thread-menu" ref={menuFor === t.id ? menuRef : undefined}>
                    <button
                      className="sidebar-thread-action"
                      title="Thread actions"
                      aria-label="Thread actions"
                      aria-haspopup="menu"
                      aria-expanded={menuFor === t.id}
                      onClick={e => {
                        e.stopPropagation();
                        setMenuFor(prev => (prev === t.id ? null : t.id));
                      }}
                    >
                      <EllipsisIcon size={15} />
                    </button>
                    {menuFor === t.id && (
                      <div className="sidebar-menu-popover" role="menu">
                        <button role="menuitem" onClick={() => startRename(t)}>
                          Rename
                        </button>
                        <button
                          role="menuitem"
                          onClick={() => {
                            setMenuFor(null);
                            onCloneThread(t.id);
                          }}
                        >
                          Clone
                        </button>
                        <button
                          role="menuitem"
                          className="danger"
                          onClick={() => {
                            setMenuFor(null);
                            onDeleteThread(t.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}
            {threads.length > MAX_THREADS && (
              <div className="sidebar-overflow">+{threads.length - MAX_THREADS} more</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
