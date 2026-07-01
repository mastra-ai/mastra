import type { AgentControllerThreadInfo } from '@mastra/client-js';
import { Badge, Button, Input, Txt } from '@mastra/playground-ui';
import { ChevronsUpDown, Folder, MoreHorizontal, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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
  /** Whether the off-canvas drawer is open on narrow screens. */
  open?: boolean;
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
  open = false,
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
    <div
      className={`fixed inset-y-0 left-0 z-40 flex h-full w-[82vw] max-w-[300px] shrink-0 flex-col gap-4 border-r border-border1 bg-surface2 p-3 shadow-lg transition-transform duration-200 md:static md:z-auto md:w-64 md:max-w-none md:translate-x-0 md:shadow-none ${open ? 'translate-x-0' : '-translate-x-full'}`}
    >
      {/* ── Project switcher (opens the app-level Projects modal) ─────── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <Txt as="span" variant="ui-xs" className="text-icon3 uppercase tracking-wide">
            Project
          </Txt>
          <Button variant="ghost" size="icon-sm" aria-label="Manage projects" onClick={onManageProjects}>
            <Plus size={15} />
          </Button>
        </div>

        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md border border-border1 bg-surface3 px-2.5 py-2 text-left transition-colors hover:bg-surface4"
          onClick={onManageProjects}
          title={activeProject ? activeProject.path : 'Select a project'}
        >
          <Folder size={16} className="shrink-0 text-icon3" />
          <span className="flex min-w-0 flex-1 flex-col">
            {activeProject ? (
              <>
                <Txt as="span" variant="ui-sm" className="truncate text-icon6">
                  {activeProject.name}
                </Txt>
                <Txt as="span" variant="ui-xs" className="truncate text-icon3">
                  {activeProject.path}
                </Txt>
              </>
            ) : (
              <Txt as="span" variant="ui-sm" className="text-icon3">
                Select a project…
              </Txt>
            )}
          </span>
          <ChevronsUpDown size={13} className="shrink-0 text-icon3" />
        </button>
      </div>

      {/* ── Threads (scoped to active project) ────────────────────────── */}
      {activeProject && (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <Txt as="span" variant="ui-xs" className="flex items-center gap-1.5 text-icon3 uppercase tracking-wide">
              Threads
              {threads.length > 0 && (
                <Badge variant="default" size="xs">
                  {threads.length}
                </Badge>
              )}
            </Txt>
            <Button variant="ghost" size="icon-sm" aria-label="New thread" onClick={() => onCreateThread()}>
              <Plus size={15} />
            </Button>
          </div>

          <div role="list" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
            {sortedThreads.length === 0 && (
              <Txt as="div" variant="ui-sm" className="px-2 py-3 text-icon3">
                No threads yet
              </Txt>
            )}
            {sortedThreads.map(t =>
              renamingId === t.id ? (
                <div key={t.id} role="listitem" className="px-1 py-0.5">
                  <Input
                    aria-label="Thread title"
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
                <div
                  key={t.id}
                  role="listitem"
                  className={`group flex items-center rounded-md transition-colors hover:bg-surface4 ${
                    t.id === activeThreadId ? 'bg-surface4' : ''
                  }`}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center justify-between gap-2 px-2.5 py-1.5 text-left"
                    onClick={() => onSwitchThread(t.id)}
                  >
                    <Txt
                      as="span"
                      variant="ui-sm"
                      className={`truncate ${t.title ? 'text-icon6' : 'text-icon3 italic'}`}
                    >
                      {t.title || 'Untitled'}
                    </Txt>
                    {t.updatedAt && (
                      <Txt as="span" variant="ui-xs" className="shrink-0 text-icon3">
                        {relativeTime(t.updatedAt)}
                      </Txt>
                    )}
                  </button>
                  <div className="relative pr-1" ref={menuFor === t.id ? menuRef : undefined}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Thread actions"
                      aria-haspopup="menu"
                      aria-expanded={menuFor === t.id}
                      onClick={e => {
                        e.stopPropagation();
                        setMenuFor(prev => (prev === t.id ? null : t.id));
                      }}
                    >
                      <MoreHorizontal size={15} />
                    </Button>
                    {menuFor === t.id && (
                      <div
                        role="menu"
                        className="absolute right-0 top-full z-10 mt-1 flex min-w-32 flex-col rounded-md border border-border1 bg-surface4 p-1 shadow-lg"
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          role="menuitem"
                          className="justify-start"
                          onClick={() => startRename(t)}
                        >
                          Rename
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          role="menuitem"
                          className="justify-start"
                          onClick={() => {
                            setMenuFor(null);
                            onCloneThread(t.id);
                          }}
                        >
                          Clone
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          role="menuitem"
                          className="justify-start text-accent2"
                          onClick={() => {
                            setMenuFor(null);
                            onDeleteThread(t.id);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}
            {threads.length > MAX_THREADS && (
              <Txt as="div" variant="ui-xs" className="px-2 py-1.5 text-icon3">
                +{threads.length - MAX_THREADS} more
              </Txt>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
