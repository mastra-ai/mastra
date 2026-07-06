import type { AgentControllerThreadInfo } from '@mastra/client-js';
import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronsUpDown, Circle, Folder, LogOut, MoreHorizontal, Plus, Settings } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useApiConfig } from '../../shared/api/config';
import { redirectToLogout, useWebAuth } from './domains/auth';
import { useChatSession } from './domains/chat';
import type { Project } from './domains/workspaces';
import { useActiveProjectContext, WorkspacesSection } from './domains/workspaces';
import { useKeyDown } from './lib/hooks';
import { useOverlays } from './lib/overlays';
import { useToast } from './ui';

const MAX_THREADS = 5;

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

/**
 * Propless sidebar: reads project selection, chat session, and overlay state
 * from the domain contexts directly. Only the inner rows/sections below stay
 * presentational (prop-driven).
 */
export function Sidebar() {
  const session = useChatSession();
  const { projects, activeProjectId, resourceId } = useActiveProjectContext();
  const overlays = useOverlays();
  const { toast } = useToast();

  const activeProject = projects.find(p => p.id === activeProjectId);
  const open = overlays.isOpen('sidebar');
  const closeSidebar = () => overlays.close('sidebar');

  return (
    <div
      className={`fixed inset-y-0 left-0 z-40 flex h-full w-[82vw] max-w-[300px] shrink-0 flex-col gap-4 border-r border-border1 bg-surface2 p-3 shadow-lg transition-transform duration-200 md:static md:z-auto md:w-full md:max-w-none md:translate-x-0 md:border-r-0 md:bg-transparent md:shadow-none ${open ? 'translate-x-0' : '-translate-x-full'}`}
    >
      <ProjectSwitcher
        activeProject={activeProject}
        onManageProjects={() => {
          overlays.open('projects');
          closeSidebar();
        }}
      />

      <WorkspacesSection
        activeProject={activeProject}
        session={session}
        agentControllerId="code"
        resourceId={resourceId}
      />

      {activeProject && (
        <ThreadList
          threads={session.threads}
          activeThreadId={session.transcript.threadId}
          onSwitchThread={id => {
            void session.switchThread(id);
            closeSidebar();
          }}
          onCreateThread={title => {
            void session.createThread(title);
            toast('New thread created', 'success');
            closeSidebar();
          }}
          onDeleteThread={id => {
            void session.deleteThread(id);
            toast('Thread deleted');
          }}
          onRenameThread={(id, title) => {
            void session.renameThread(id, title);
            toast('Thread renamed', 'success');
          }}
          onCloneThread={id => {
            void session.cloneThread(id);
            toast('Thread cloned', 'success');
          }}
        />
      )}

      <SidebarFooter
        status={session.status}
        running={session.busy}
        onOpenSettings={() => {
          overlays.open('settings');
          closeSidebar();
        }}
      />
    </div>
  );
}

function ProjectSwitcher({
  activeProject,
  onManageProjects,
}: {
  activeProject?: Project;
  onManageProjects: () => void;
}) {
  return (
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
  );
}

interface ThreadListProps {
  threads: AgentControllerThreadInfo[];
  activeThreadId?: string;
  onSwitchThread: (threadId: string) => void;
  onCreateThread: (title?: string) => void;
  onDeleteThread: (threadId: string) => void;
  onRenameThread: (threadId: string, title: string) => void;
  onCloneThread: (threadId: string) => void;
}

function ThreadList({
  threads,
  activeThreadId,
  onSwitchThread,
  onCreateThread,
  onDeleteThread,
  onRenameThread,
  onCloneThread,
}: ThreadListProps) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuFor) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuFor(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
    };
  }, [menuFor]);

  useKeyDown({ escape: () => setMenuFor(null) }, { target: 'document', enabled: !!menuFor });

  const startRename = (thread: AgentControllerThreadInfo) => {
    setMenuFor(null);
    setRenamingId(thread.id);
    setRenameDraft(thread.title ?? '');
  };

  const commitRename = (threadId: string) => {
    const title = renameDraft.trim();
    if (title) onRenameThread(threadId, title);
    setRenamingId(null);
    setRenameDraft('');
  };

  const sortedThreads = [...threads]
    .sort((a, b) => {
      const ta = a.updatedAt ?? a.createdAt ?? '';
      const tb = b.updatedAt ?? b.createdAt ?? '';
      return tb.localeCompare(ta);
    })
    .slice(0, MAX_THREADS);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <ThreadListHeader threadCount={threads.length} onCreateThread={onCreateThread} />

      <div role="list" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {sortedThreads.length === 0 && (
          <Txt as="div" variant="ui-sm" className="px-2 py-3 text-icon3">
            No threads yet
          </Txt>
        )}
        {sortedThreads.map(thread =>
          renamingId === thread.id ? (
            <RenameThreadRow
              key={thread.id}
              draft={renameDraft}
              onDraftChange={setRenameDraft}
              onCommit={() => commitRename(thread.id)}
              onCancel={() => {
                setRenamingId(null);
                setRenameDraft('');
              }}
            />
          ) : (
            <ThreadRow
              key={thread.id}
              thread={thread}
              active={thread.id === activeThreadId}
              menuOpen={menuFor === thread.id}
              menuRef={menuFor === thread.id ? menuRef : undefined}
              onSwitch={() => onSwitchThread(thread.id)}
              onToggleMenu={() => setMenuFor(prev => (prev === thread.id ? null : thread.id))}
              onRename={() => startRename(thread)}
              onClone={() => {
                setMenuFor(null);
                onCloneThread(thread.id);
              }}
              onDelete={() => {
                setMenuFor(null);
                onDeleteThread(thread.id);
              }}
            />
          ),
        )}
        {threads.length > MAX_THREADS && (
          <Txt as="div" variant="ui-xs" className="px-2 py-1.5 text-icon3">
            +{threads.length - MAX_THREADS} more
          </Txt>
        )}
      </div>
    </div>
  );
}

function ThreadListHeader({
  threadCount,
  onCreateThread,
}: {
  threadCount: number;
  onCreateThread: (title?: string) => void;
}) {
  return (
    <div className="flex items-center justify-between px-1">
      <Txt as="span" variant="ui-xs" className="flex items-center gap-1.5 text-icon3 uppercase tracking-wide">
        Threads
        {threadCount > 0 && (
          <Badge variant="default" size="xs">
            {threadCount}
          </Badge>
        )}
      </Txt>
      <Button variant="ghost" size="icon-sm" aria-label="New thread" onClick={() => onCreateThread()}>
        <Plus size={15} />
      </Button>
    </div>
  );
}

function RenameThreadRow({
  draft,
  onDraftChange,
  onCommit,
  onCancel,
}: {
  draft: string;
  onDraftChange: (draft: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <div role="listitem" className="px-1 py-0.5">
      <Input
        aria-label="Thread title"
        autoFocus
        value={draft}
        placeholder="Thread title"
        onChange={e => onDraftChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') onCommit();
          if (e.key === 'Escape') onCancel();
        }}
        onBlur={onCommit}
      />
    </div>
  );
}

function ThreadRow({
  thread,
  active,
  menuOpen,
  menuRef,
  onSwitch,
  onToggleMenu,
  onRename,
  onClone,
  onDelete,
}: {
  thread: AgentControllerThreadInfo;
  active: boolean;
  menuOpen: boolean;
  menuRef?: React.RefObject<HTMLDivElement | null>;
  onSwitch: () => void;
  onToggleMenu: () => void;
  onRename: () => void;
  onClone: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="listitem"
      className={`group flex items-center rounded-md transition-colors hover:bg-surface4 ${active ? 'bg-surface4' : ''}`}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center justify-between gap-2 px-2.5 py-1.5 text-left"
        onClick={onSwitch}
      >
        <Txt as="span" variant="ui-sm" className={`truncate ${thread.title ? 'text-icon6' : 'text-icon3 italic'}`}>
          {thread.title || 'Untitled'}
        </Txt>
        {thread.updatedAt && (
          <Txt as="span" variant="ui-xs" className="shrink-0 text-icon3">
            {relativeTime(thread.updatedAt)}
          </Txt>
        )}
      </button>
      <div className="relative pr-1" ref={menuRef}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Thread actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={e => {
            e.stopPropagation();
            onToggleMenu();
          }}
        >
          <MoreHorizontal size={15} />
        </Button>
        {menuOpen && <ThreadActionsMenu onRename={onRename} onClone={onClone} onDelete={onDelete} />}
      </div>
    </div>
  );
}

function ThreadActionsMenu({
  onRename,
  onClone,
  onDelete,
}: {
  onRename: () => void;
  onClone: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="menu"
      className="absolute right-0 top-full z-10 mt-1 flex min-w-32 flex-col rounded-md border border-border1 bg-surface4 p-1 shadow-lg"
    >
      <Button variant="ghost" size="sm" role="menuitem" className="justify-start" onClick={onRename}>
        Rename
      </Button>
      <Button variant="ghost" size="sm" role="menuitem" className="justify-start" onClick={onClone}>
        Clone
      </Button>
      <Button variant="ghost" size="sm" role="menuitem" className="justify-start text-accent2" onClick={onDelete}>
        Delete
      </Button>
    </div>
  );
}

function statusLabel(status: string, running: boolean): string {
  if (running) return 'Working…';
  if (status === 'reconnecting') return 'Reconnecting…';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusDotClass(status: string): string {
  if (status === 'ready') return 'fill-accent1 text-accent1';
  if (status === 'reconnecting') return 'animate-pulse fill-warning1 text-warning1';
  if (status === 'error') return 'fill-error text-error';
  return 'animate-pulse fill-icon2 text-icon2';
}

function SidebarFooter({
  status = 'ready',
  running = false,
  onOpenSettings,
}: {
  status?: string;
  running?: boolean;
  onOpenSettings: () => void;
}) {
  return (
    <div className="mt-auto flex flex-col gap-2 border-t border-border1 pt-2">
      <div
        className="grid h-10 grid-cols-[2.75rem_1fr_auto] items-center text-ui-sm text-icon3"
        role="status"
        aria-live="polite"
      >
        <span className="flex items-center justify-center">
          <Circle size={10} className={statusDotClass(status)} />
        </span>
        <span>{statusLabel(status, running)}</span>
      </div>
      <SidebarAuth />
      <Button
        variant="ghost"
        size="sm"
        className="grid h-10 w-full grid-cols-[2.75rem_1fr_auto] items-center justify-normal gap-0 px-0"
        onClick={onOpenSettings}
        aria-label="Open settings"
      >
        <span className="flex items-center justify-center">
          <Settings size={18} />
        </span>
        <span className="justify-self-start">Settings</span>
      </Button>
    </div>
  );
}

function SidebarAuth() {
  const auth = useWebAuth();
  const { baseUrl } = useApiConfig();

  if (auth.isLoading) {
    return (
      <Txt as="div" variant="ui-sm" className="grid h-10 grid-cols-[2.75rem_1fr_auto] items-center text-icon3">
        <span className="col-start-2">Checking sign-in…</span>
      </Txt>
    );
  }

  // Unauthenticated sessions never reach the app (the router bounces them to
  // `/signin`), so the sidebar only renders the signed-in identity.
  const state = auth.data;
  if (!state?.authEnabled || !state.authenticated) return null;

  const identity = state.user?.name ?? state.user?.email ?? 'Signed in';

  return (
    <div className="grid h-10 grid-cols-[2.75rem_1fr_auto] items-center">
      <span className="flex items-center justify-center">
        <Avatar name={identity} size="sm" />
      </span>
      <Txt as="span" variant="ui-sm" className="min-w-0 truncate text-icon6" title={identity}>
        {identity}
      </Txt>
      <Button variant="ghost" size="icon-sm" onClick={() => redirectToLogout(baseUrl)} aria-label="Sign out">
        <LogOut size={15} />
      </Button>
    </div>
  );
}
