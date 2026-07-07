import type { AgentControllerThreadInfo } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { relativeTime } from '../../../../../shared/lib/date';
import { useKeyDown } from '../../../lib/hooks';
import { useOverlays } from '../../../lib/overlays';
import { useToast } from '../../../ui';
// Deep import (not the workspaces barrel) to keep the cross-domain graph acyclic.
import { useActiveProjectContext } from '../../workspaces/context/ActiveProjectProvider';
import { useChatSession } from '../context/ChatSessionProvider';

const MAX_THREADS = 5;

/**
 * Propless thread list: owns the chat-thread section of the sidebar. Reads
 * threads from the chat session, gates itself on the active project, closes
 * the sidebar drawer on navigation, and toasts on thread CRUD.
 */
export function ThreadList() {
  const session = useChatSession();
  const { activeProject } = useActiveProjectContext();
  const overlays = useOverlays();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { threadId: routeThreadId } = useParams<{ threadId: string }>();

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

  if (!activeProject) return null;

  const threads = session.threads;
  // The URL is the source of truth: nothing is highlighted on the /new draft
  // page even if the session is still bound to a thread server-side.
  const activeThreadId = routeThreadId;

  const openThread = (threadId: string) => {
    void session.switchThread(threadId);
    void navigate(`/threads/${threadId}`);
    overlays.close('sidebar');
  };

  const startDraft = () => {
    overlays.close('sidebar');
    void navigate('/new');
  };

  const cloneThread = async (threadId: string) => {
    const newThreadId = await session.cloneThread(threadId);
    toast('Thread cloned', 'success');
    void navigate(`/threads/${newThreadId}`);
  };

  const deleteThread = async (threadId: string) => {
    await session.deleteThread(threadId);
    toast('Thread deleted');
    if (threadId === routeThreadId) void navigate('/new');
  };

  const startRename = (thread: AgentControllerThreadInfo) => {
    setMenuFor(null);
    setRenamingId(thread.id);
    setRenameDraft(thread.title ?? '');
  };

  const commitRename = (threadId: string) => {
    const title = renameDraft.trim();
    if (title) {
      void session.renameThread(threadId, title);
      toast('Thread renamed', 'success');
    }
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
      <ThreadListHeader threadCount={threads.length} onCreateThread={startDraft} />

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
              onSwitch={() => openThread(thread.id)}
              onToggleMenu={() => setMenuFor(prev => (prev === thread.id ? null : thread.id))}
              onRename={() => startRename(thread)}
              onClone={() => {
                setMenuFor(null);
                void cloneThread(thread.id);
              }}
              onDelete={() => {
                setMenuFor(null);
                void deleteThread(thread.id);
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

function ThreadListHeader({ threadCount, onCreateThread }: { threadCount: number; onCreateThread: () => void }) {
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
      <Button variant="ghost" size="icon-sm" aria-label="New thread" onClick={onCreateThread}>
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
