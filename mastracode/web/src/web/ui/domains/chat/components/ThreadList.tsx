import type { AgentControllerThreadInfo } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { useApiConfig } from '../../../../../shared/api/config';
import { relativeTime } from '../../../../../shared/lib/date';
import { useKeyDown } from '../../../lib/hooks';
import { useOverlays } from '../../../lib/overlays';
import { useToast } from '../../../ui';
import { useActiveProjectContext } from '../../workspaces/context/ActiveProjectProvider';
import { deriveProjectPath } from '../../workspaces/hooks/useWorkspaces';
import { useChatTranscript } from '../context/ChatSessionProvider';
import {
  useCloneAgentControllerThreadMutation,
  useDeleteAgentControllerThreadMutation,
  useRenameAgentControllerThreadMutation,
  useSwitchAgentControllerThreadMutation,
} from '../hooks/useAgentControllerThreadMutations';
import { useAgentControllerThreads } from '../hooks/useAgentControllerThreads';
import { AGENT_CONTROLLER_ID } from '../services/constants';

const MAX_THREADS = 5;

export function ThreadList() {
  const { baseUrl } = useApiConfig();
  const { activeProject, resourceId, sessionEnabled } = useActiveProjectContext();
  const projectPath = deriveProjectPath(activeProject);
  const { resetCurrentThread, syncState, pushNotice } = useChatTranscript();
  const overlays = useOverlays();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { threadId: routeThreadId } = useParams<{ threadId: string }>();

  const hookArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    projectPath,
    baseUrl,
    enabled: sessionEnabled,
  };
  const threadsQuery = useAgentControllerThreads(hookArgs);
  const switchThreadMutation = useSwitchAgentControllerThreadMutation(hookArgs);
  const deleteThreadMutation = useDeleteAgentControllerThreadMutation(hookArgs);
  const renameThreadMutation = useRenameAgentControllerThreadMutation(hookArgs);
  const cloneThreadMutation = useCloneAgentControllerThreadMutation(hookArgs);

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
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuFor]);

  useKeyDown({ escape: () => setMenuFor(null) }, { target: 'document', enabled: !!menuFor });

  if (!activeProject) return null;

  const threads = threadsQuery.data ?? [];
  const activeThreadId = routeThreadId;

  const openThread = (threadId: string) => {
    resetCurrentThread(threadId);
    void switchThreadMutation
      .mutateAsync(threadId)
      .then(state => syncState(state))
      .catch(err => {
        resetCurrentThread();
        pushNotice(`Failed to switch thread: ${err instanceof Error ? err.message : String(err)}`, 'error');
      });
    void navigate(`/threads/${threadId}`);
    overlays.close('sidebar');
  };

  const startDraft = () => {
    overlays.close('sidebar');
    void navigate('/new');
  };

  const cloneThread = async (threadId: string) => {
    const thread = await cloneThreadMutation.mutateAsync({ sourceThreadId: threadId });
    resetCurrentThread(thread.id);
    toast('Thread cloned', 'success');
    void navigate(`/threads/${thread.id}`);
  };

  const deleteThread = async (threadId: string) => {
    await deleteThreadMutation.mutateAsync(threadId);
    toast('Thread deleted');
    if (threadId === routeThreadId) {
      resetCurrentThread();
      void navigate('/new');
    }
  };

  const startRename = (thread: AgentControllerThreadInfo) => {
    setMenuFor(null);
    setRenamingId(thread.id);
    setRenameDraft(thread.title ?? '');
  };

  const commitRename = (threadId: string) => {
    const title = renameDraft.trim();
    if (title) {
      void renameThreadMutation.mutateAsync({ threadId, title });
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
    <div role="listitem" className={`group relative rounded-md ${active ? 'bg-surface4' : 'hover:bg-surface3'}`}>
      <button type="button" className="flex w-full flex-col gap-0.5 rounded-md px-2 py-2 text-left" onClick={onSwitch}>
        <span className="truncate text-ui-sm text-icon6">{thread.title || 'Untitled thread'}</span>
        <span className="text-ui-xs text-icon3">{relativeTime(thread.updatedAt ?? thread.createdAt ?? '')}</span>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Thread actions"
        className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 data-[open=true]:opacity-100"
        data-open={menuOpen}
        onClick={e => {
          e.stopPropagation();
          onToggleMenu();
        }}
      >
        <MoreHorizontal size={15} />
      </Button>
      {menuOpen && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-1 top-8 z-20 flex min-w-28 flex-col rounded-md border border-border1 bg-surface3 p-1 shadow-lg"
        >
          <MenuButton onClick={onRename}>Rename</MenuButton>
          <MenuButton onClick={onClone}>Clone</MenuButton>
          <MenuButton onClick={onDelete}>Delete</MenuButton>
        </div>
      )}
    </div>
  );
}

function MenuButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      className="rounded px-2 py-1.5 text-left text-ui-sm text-icon5 hover:bg-surface4"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
