import type { AgentControllerThreadInfo } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { relativeTime } from '../../../../../shared/lib/date';
import { useOverlays } from '../../../lib/overlays';
import { useToast } from '../../../ui';
import { useActiveProjectContext } from '../../workspaces/context/ActiveProjectProvider';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import {
  useCloneAgentControllerThreadMutation,
  useDeleteAgentControllerThreadMutation,
  useRenameAgentControllerThreadMutation,
} from '../hooks/useAgentControllerThreadMutations';
import { useAgentControllerThreads } from '../hooks/useAgentControllerThreads';
import { AGENT_CONTROLLER_ID } from '../services/constants';

const MAX_THREADS = 5;

export function ThreadList() {
  const { activeProject } = useActiveProjectContext();
  const { resourceId, sessionEnabled, projectPath, baseUrl } = useChatSessionContext();
  const { threadId: routeThreadId } = useParams<{ threadId: string }>();

  const threadsQuery = useAgentControllerThreads({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    projectPath,
    baseUrl,
    enabled: sessionEnabled,
  });

  const [renamingId, setRenamingId] = useState<string | null>(null);

  if (!activeProject) return null;

  const threads = threadsQuery.data ?? [];
  const activeThreadId = routeThreadId;
  const sortedThreads = [...threads]
    .sort((a, b) => {
      const ta = a.updatedAt ?? a.createdAt ?? '';
      const tb = b.updatedAt ?? b.createdAt ?? '';
      return tb.localeCompare(ta);
    })
    .slice(0, MAX_THREADS);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <ThreadListHeader threadCount={threads.length} />
      <div role="list" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {sortedThreads.length === 0 && (
          <Txt as="div" variant="ui-sm" className="px-2 py-3 text-icon3">
            No threads yet
          </Txt>
        )}
        {sortedThreads.map(thread =>
          renamingId === thread.id ? (
            <RenameThreadRow key={thread.id} thread={thread} onDone={() => setRenamingId(null)} />
          ) : (
            <ThreadRow
              key={thread.id}
              thread={thread}
              active={thread.id === activeThreadId}
              onStartRename={() => setRenamingId(thread.id)}
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

function useThreadHookArgs() {
  const { resourceId, sessionEnabled, projectPath, baseUrl } = useChatSessionContext();
  return {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    projectPath,
    baseUrl,
    enabled: sessionEnabled,
  };
}

function ThreadListHeader({ threadCount }: { threadCount: number }) {
  const overlays = useOverlays();
  const navigate = useNavigate();

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
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="New thread"
        onClick={() => {
          overlays.close('sidebar');
          void navigate('/new');
        }}
      >
        <Plus size={15} />
      </Button>
    </div>
  );
}

function RenameThreadRow({ thread, onDone }: { thread: AgentControllerThreadInfo; onDone: () => void }) {
  const hookArgs = useThreadHookArgs();
  const renameThreadMutation = useRenameAgentControllerThreadMutation(hookArgs);
  const { toast } = useToast();
  const [draft, setDraft] = useState(() => thread.title ?? '');

  const commit = () => {
    const title = draft.trim();
    if (title) {
      void renameThreadMutation.mutateAsync({ threadId: thread.id, title });
      toast('Thread renamed', 'success');
    }
    onDone();
  };

  return (
    <div role="listitem" className="px-1 py-0.5">
      <Input
        aria-label="Thread title"
        autoFocus
        value={draft}
        placeholder="Thread title"
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') onDone();
        }}
        onBlur={commit}
      />
    </div>
  );
}

function ThreadRow({
  thread,
  active,
  onStartRename,
}: {
  thread: AgentControllerThreadInfo;
  active: boolean;
  onStartRename: () => void;
}) {
  const hookArgs = useThreadHookArgs();
  const { reset } = useChatTranscript();
  const overlays = useOverlays();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { threadId: routeThreadId } = useParams<{ threadId: string }>();

  const deleteThreadMutation = useDeleteAgentControllerThreadMutation(hookArgs);
  const cloneThreadMutation = useCloneAgentControllerThreadMutation(hookArgs);

  const openThread = () => {
    void navigate(`/threads/${thread.id}`);
    overlays.close('sidebar');
  };

  const cloneThread = async () => {
    const clonedThread = await cloneThreadMutation.mutateAsync({ sourceThreadId: thread.id });
    reset(clonedThread.id);
    toast('Thread cloned', 'success');
    void navigate(`/threads/${clonedThread.id}`);
  };

  const deleteThread = async () => {
    await deleteThreadMutation.mutateAsync(thread.id);
    toast('Thread deleted');
    if (thread.id === routeThreadId) {
      reset();
      void navigate('/new');
    }
  };

  return (
    <div role="listitem" className={`group relative rounded-md ${active ? 'bg-surface4' : 'hover:bg-surface3'}`}>
      <button
        type="button"
        className="flex w-full flex-col gap-0.5 rounded-md px-2 py-2 text-left"
        onClick={openThread}
      >
        <span className="truncate text-ui-sm text-icon6">{thread.title || 'Untitled thread'}</span>
        <span className="text-ui-xs text-icon3">{relativeTime(thread.updatedAt ?? thread.createdAt ?? '')}</span>
      </button>
      <DropdownMenu>
        <DropdownMenu.Trigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Thread actions"
              className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 data-[popup-open]:opacity-100"
            >
              <MoreHorizontal size={15} />
            </Button>
          }
        />
        <DropdownMenu.Content align="end" className="min-w-28">
          <DropdownMenu.Item onClick={onStartRename}>Rename</DropdownMenu.Item>
          <DropdownMenu.Item onClick={() => void cloneThread()}>Clone</DropdownMenu.Item>
          <DropdownMenu.Item variant="destructive" onClick={() => void deleteThread()}>
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
}
