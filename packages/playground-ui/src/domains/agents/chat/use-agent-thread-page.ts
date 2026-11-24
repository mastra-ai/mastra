import { useDeleteThread, useMemory, useThreads } from '@mastra/react/hooks/memory';
import { useRef } from 'react';
import type { ThreadDraftHandle } from './drafts/ThreadInputContext';
import { useAgentThreadNavigation } from './use-agent-thread-navigation';
import { toast } from '@/utils/toast';

export interface AgentThreadPageOptions {
  agentId: string;
  resourceId: string;
  threadId?: string;
  requestContext?: Record<string, unknown>;
  draftScope: [string | undefined, string | undefined, string | undefined, string];
  canPersistDraft: boolean;
  navigateToThread: (threadId: string) => void;
  navigateToNewThread: () => void;
  expandThreadsPanel?: () => void;
}

export function useAgentThreadPage(options: AgentThreadPageOptions) {
  const { agentId, resourceId, requestContext } = options;
  const draftHandle = useRef<ThreadDraftHandle>(null);
  const { data: memory, isLoading: isMemoryLoading } = useMemory({
    agentId,
    requestContext,
    queryOptions: { enabled: Boolean(agentId) },
  });
  const hasMemory = Boolean(memory?.result);
  const {
    data,
    isLoading: isThreadsLoading,
    error: threadsError,
    refetch: refreshThreads,
  } = useThreads({
    agentId,
    resourceId,
    isMemoryEnabled: hasMemory,
    requestContext,
    queryOptions: { enabled: hasMemory },
  });
  const navigation = useAgentThreadNavigation({ ...options, draftHandle, refreshThreads });
  const { mutateAsync } = useDeleteThread({ requestContext });
  const threads = (data ?? []).map(thread => ({
    ...thread,
    createdAt: new Date(thread.createdAt),
    updatedAt: new Date(thread.updatedAt),
  }));

  const deleteThread = async (threadId: string) => {
    try {
      await mutateAsync({ threadId, agentId });
    } catch {
      toast.error('Failed to delete chat');
      return;
    }
    await refreshThreads();
    toast.success('Chat deleted successfully');
    if (threadId === navigation.actualThreadId) options.navigateToNewThread();
  };

  return {
    ...navigation,
    draftScope: options.draftScope,
    draftHandle,
    hasMemory,
    isMemoryLoading,
    threads,
    isThreadsLoading,
    threadsError,
    refreshThreads,
    deleteThread,
  };
}
