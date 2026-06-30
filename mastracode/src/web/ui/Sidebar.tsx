import type { AgentControllerThreadInfo } from '@mastra/client-js';
import { useEffect, useRef, useState } from 'react';

import { ChevronIcon, CloseIcon, EllipsisIcon, FolderIcon, GithubIcon, PlusIcon, TargetIcon, Wordmark } from './icons';
import type { Project, Worktree } from './projects';

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
  /**
   * Open the GitHub connect / repo-picker modal. Only provided when the GitHub
   * App feature is enabled; otherwise the entry point is hidden.
   */
  onConnectGithub?: () => void;
  threads: AgentControllerThreadInfo[];
  activeThreadId?: string;
  onSwitchThread: (threadId: string) => void;
  onCreateThread: (title?: string) => void;
  onDeleteThread: (threadId: string) => void;
  onRenameThread: (threadId: string, title: string) => void;
  onCloneThread: (threadId: string) => void;
  /**
   * Worktrees (workspaces) of the active GitHub project. Empty for local
   * projects, which keep a flat thread list instead of the worktree tree.
   */
  worktrees?: Worktree[];
  /** Path of the currently selected worktree, if any. */
  selectedWorktreePath?: string;
  /** Switch the active workspace to an existing worktree. */
  onSelectWorktree?: (worktreePath: string) => void;
  /** Create a new worktree (feature branch) and select it. */
  onCreateWorktree?: (branch: string, baseBranch?: string) => Promise<unknown> | void;
  /**
   * Signed-in account info + sign-out handler. Only provided when the optional
   * WorkOS auth gate is active and the user is authenticated; otherwise the
   * account section is hidden entirely.
   */
  account?: {
    user?: { email?: string; name?: string };
    onSignOut: () => void;
  };
}

export function Sidebar({
  projects,
  activeProjectId,
  onManageProjects,
  onConnectGithub,
  threads,
  activeThreadId,
  onSwitchThread,
  onCreateThread,
  onDeleteThread,
  onRenameThread,
  onCloneThread,
  worktrees,
  selectedWorktreePath,
  onSelectWorktree,
  onCreateWorktree,
  account,
}: SidebarProps) {
  // Per-thread action menu (⋯): which thread's menu is open, and inline-rename state.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Worktree tree (GitHub projects): collapse toggle + inline "new workspace" input.
  const [treeCollapsed, setTreeCollapsed] = useState(false);
  const [creatingWorktree, setCreatingWorktree] = useState(false);
  const [newBranchDraft, setNewBranchDraft] = useState('');
  const [creatingBusy, setCreatingBusy] = useState(false);
  const [worktreeError, setWorktreeError] = useState<string | null>(null);

  const submitNewWorktree = async () => {
    const branch = newBranchDraft.trim();
    if (!branch || !onCreateWorktree) return;
    setCreatingBusy(true);
    setWorktreeError(null);
    try {
      await onCreateWorktree(branch);
      setNewBranchDraft('');
      setCreatingWorktree(false);
    } catch (err) {
      setWorktreeError(err instanceof Error ? err.message : 'Failed to create worktree');
    } finally {
      setCreatingBusy(false);
    }
  };

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
  const isGithubProject = activeProject?.source === 'github';
  const worktreeList = worktrees ?? [];
  // The worktree these threads belong to: the explicit selection, else the first.
  const activeWorktreePath = selectedWorktreePath ?? worktreeList[0]?.worktreePath;

  // A single thread row (button + ⋯ menu, or inline-rename input). Shared by the
  // flat local list and the per-worktree nested list.
  const renderThread = (t: AgentControllerThreadInfo) =>
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
    );

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
          title={activeProject ? (activeProject.path ?? activeProject.name) : 'Select a project'}
        >
          {activeProject?.source === 'github' ? (
            <GithubIcon size={16} className="project-switcher-icon" />
          ) : (
            <FolderIcon size={16} className="project-switcher-icon" />
          )}
          <span className="project-switcher-text">
            {activeProject ? (
              <>
                <span className="project-switcher-name">{activeProject.name}</span>
                <span className="project-switcher-path">
                  {activeProject.source === 'github' ? 'GitHub repo' : activeProject.path}
                </span>
              </>
            ) : (
              <span className="project-switcher-name">Select a project…</span>
            )}
          </span>
          {activeProject && (
            <span className={`project-switcher-source ${activeProject.source === 'github' ? 'github' : 'local'}`}>
              {activeProject.source === 'github' ? 'GitHub' : 'Local'}
            </span>
          )}
          <CloseIcon size={13} className="project-switcher-chevron" />
        </button>
      </div>

      {/* ── Local project: flat thread list ───────────────────────────── */}
      {activeProject && !isGithubProject && (
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
            {sortedThreads.map(renderThread)}
            {threads.length > MAX_THREADS && (
              <div className="sidebar-overflow">+{threads.length - MAX_THREADS} more</div>
            )}
          </div>
        </div>
      )}

      {/* ── GitHub project: project → worktree → threads tree ─────────── */}
      {activeProject && isGithubProject && (
        <div className="sidebar-section sidebar-section-grow">
          <div className="sidebar-section-header">
            <button
              className="sidebar-tree-toggle"
              aria-expanded={!treeCollapsed}
              onClick={() => setTreeCollapsed(c => !c)}
            >
              <ChevronIcon size={13} className={`sidebar-tree-chevron ${treeCollapsed ? '' : 'open'}`} />
              <span className="sidebar-section-title">Worktrees</span>
              {worktreeList.length > 0 && <span className="sidebar-count">{worktreeList.length}</span>}
            </button>
            <button
              className="sidebar-icon-btn"
              title="New worktree"
              aria-label="New worktree"
              onClick={() => setCreatingWorktree(v => !v)}
              disabled={!onCreateWorktree}
            >
              <PlusIcon size={15} />
            </button>
          </div>

          {creatingWorktree && (
            <div className="sidebar-newworkspace">
              <input
                className="sidebar-rename-input"
                autoFocus
                value={newBranchDraft}
                placeholder="new-branch-name"
                aria-label="New worktree branch name"
                disabled={creatingBusy}
                onChange={e => {
                  setNewBranchDraft(e.target.value);
                  if (worktreeError) setWorktreeError(null);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') void submitNewWorktree();
                  if (e.key === 'Escape') {
                    setCreatingWorktree(false);
                    setNewBranchDraft('');
                    setWorktreeError(null);
                  }
                }}
                onBlur={() => {
                  if (!newBranchDraft.trim() && !worktreeError) setCreatingWorktree(false);
                }}
              />
              {worktreeError && (
                <div className="sidebar-newworkspace-error" role="alert">
                  {worktreeError}
                </div>
              )}
            </div>
          )}

          {!treeCollapsed && (
            <div className="sidebar-tree">
              {worktreeList.length === 0 && <div className="sidebar-empty">Preparing worktree…</div>}
              {worktreeList.map(w => {
                const isActive = w.worktreePath === activeWorktreePath;
                return (
                  <div key={w.worktreePath} className="sidebar-worktree-group">
                    <button
                      className={`sidebar-worktree ${isActive ? 'active' : ''}`}
                      title={w.worktreePath}
                      onClick={() => onSelectWorktree?.(w.worktreePath)}
                    >
                      <TargetIcon size={13} className="sidebar-worktree-icon" />
                      <span className="sidebar-worktree-branch">{w.branch}</span>
                    </button>

                    {isActive && (
                      <div className="sidebar-worktree-threads">
                        <div className="sidebar-worktree-threads-header">
                          <span className="sidebar-worktree-threads-title">Threads</span>
                          <button
                            className="sidebar-icon-btn"
                            title="New thread"
                            aria-label="New thread"
                            onClick={() => onCreateThread()}
                          >
                            <PlusIcon size={14} />
                          </button>
                        </div>
                        {sortedThreads.length === 0 && <div className="sidebar-empty">No threads yet</div>}
                        {sortedThreads.map(renderThread)}
                        {threads.length > MAX_THREADS && (
                          <div className="sidebar-overflow">+{threads.length - MAX_THREADS} more</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Connect GitHub repo (sits just above the account footer) ──── */}
      {onConnectGithub && (
        <button className="sidebar-github-btn" onClick={onConnectGithub} title="Connect a GitHub repository">
          <span>Connect GitHub repo</span>
        </button>
      )}

      {/* ── Account (only when WorkOS auth is active) ─────────────────── */}
      {account && (
        <div className="sidebar-section sidebar-account">
          <div className="sidebar-account-info">
            <span className="sidebar-account-name">{account.user?.name || account.user?.email || 'Signed in'}</span>
            {account.user?.email && account.user?.name && (
              <span className="sidebar-account-email">{account.user.email}</span>
            )}
          </div>
          <button className="sidebar-signout-btn" onClick={account.onSignOut} title="Sign out">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
