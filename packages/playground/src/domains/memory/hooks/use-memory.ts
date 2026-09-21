import type {
  GetObservationalMemoryResponse,
  GetMemoryStatusResponse,
  GetMemoryThreadBranchHistoryResponse,
  ListMemoryThreadBranchesResponse,
} from '@mastra/client-js';
import { MastraClientError } from '@mastra/client-js';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useMergedRequestContext } from '@/domains/request-context';

import type { MemorySearchParams } from '@/types/memory';

export const useMemory = (agentId?: string) => {
  const client = useMastraClient();
  const requestContext = useMergedRequestContext();

  return useQuery({
    queryKey: ['memory', agentId, requestContext],
    queryFn: () => (agentId ? client.getMemoryStatus(agentId, requestContext) : null),
    enabled: Boolean(agentId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: false,
  });
};

export const useMemoryConfig = (agentId?: string) => {
  const client = useMastraClient();
  const requestContext = useMergedRequestContext();

  return useQuery({
    queryKey: ['memory', 'config', agentId, requestContext],
    queryFn: () => (agentId ? client.getMemoryConfig({ agentId, requestContext }) : null),
    enabled: Boolean(agentId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: false,
    refetchOnWindowFocus: false,
  });
};

export const useThread = ({ threadId, agentId }: { threadId?: string; agentId?: string }) => {
  const client = useMastraClient();
  const requestContext = useMergedRequestContext();

  return useQuery({
    queryKey: ['memory', 'thread', threadId, agentId, requestContext],
    queryFn: () => client.getMemoryThread({ threadId: threadId!, agentId }).get({ requestContext }),
    enabled: Boolean(threadId) && threadId !== 'new' && Boolean(agentId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
};

export const useThreads = ({
  resourceId,
  agentId,
  isMemoryEnabled,
}: {
  resourceId: string;
  agentId: string;
  isMemoryEnabled: boolean;
}) => {
  const client = useMastraClient();
  const requestContext = useMergedRequestContext();

  return useQuery({
    queryKey: ['memory', 'threads', resourceId, agentId, requestContext],
    queryFn: async () => {
      if (!isMemoryEnabled) return null;
      const result = await client.listMemoryThreads({ resourceId, agentId, requestContext });
      return result.threads;
    },
    enabled: Boolean(isMemoryEnabled),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
};

export const useDeleteThread = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const requestContext = useMergedRequestContext();

  return useMutation({
    mutationFn: ({ threadId, agentId }: { threadId: string; agentId: string }) => {
      const thread = client.getMemoryThread({ threadId, agentId });
      return thread.delete({ requestContext });
    },
    onSuccess: (_, variables) => {
      const { agentId } = variables;
      if (agentId) {
        void queryClient.invalidateQueries({ queryKey: ['memory', 'threads', agentId, agentId] });
      }
      toast.success('Chat deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete chat');
    },
  });
};

export const useMemorySearch = ({
  agentId,
  resourceId,
  threadId,
}: {
  agentId: string;
  resourceId: string;
  threadId?: string;
}) => {
  const requestContext = useMergedRequestContext();
  const client = useMastraClient();
  return useMutation({
    mutationFn: async ({ searchQuery, memoryConfig }: { searchQuery: string; memoryConfig?: MemorySearchParams }) => {
      return client.searchMemory({ agentId, resourceId, threadId, searchQuery, memoryConfig, requestContext });
    },
  });
};

export const useCloneThread = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const requestContext = useMergedRequestContext();

  return useMutation({
    mutationFn: async ({ threadId, agentId, title }: { threadId: string; agentId: string; title?: string }) => {
      const thread = client.getMemoryThread({ threadId, agentId });
      return thread.clone({ title, requestContext });
    },
    onSuccess: (_, variables) => {
      const { agentId } = variables;
      if (agentId) {
        void queryClient.invalidateQueries({ queryKey: ['memory', 'threads', agentId, agentId] });
      }
      toast.success('Thread cloned successfully');
    },
    onError: () => {
      toast.error('Failed to clone thread');
    },
  });
};

type BranchHistoryEntry = GetMemoryThreadBranchHistoryResponse['history'][number];

export interface ThreadBranchesInfo {
  isSupported: boolean;
  parentThread: BranchHistoryEntry['thread'] | null;
  fork: BranchHistoryEntry['branch'];
  branches: ListMemoryThreadBranchesResponse['branches'];
}

const NO_BRANCHING: ThreadBranchesInfo = { isSupported: false, parentThread: null, fork: null, branches: [] };

/**
 * Extracts the server error code from a client error. client-js keeps the
 * parsed error envelope on `MastraClientError.body` (`{error:{code}}`), which
 * is more durable than matching the stringified message.
 */
const getServerErrorCode = (error: unknown): string | undefined => {
  if (error instanceof MastraClientError) {
    const body = error.body;
    if (body && typeof body === 'object' && 'error' in body) {
      const code = (body as { error?: { code?: unknown } }).error?.code;
      if (typeof code === 'string') return code;
    }
  }
  return undefined;
};

const isBranchingUnsupportedError = (error: unknown): boolean => {
  const code = getServerErrorCode(error);
  if (code) return code === 'BRANCHING_UNSUPPORTED';
  return error instanceof Error && error.message.includes('BRANCHING_UNSUPPORTED');
};

const isBranchThreadNotFoundError = (error: unknown): boolean => {
  const code = getServerErrorCode(error);
  if (code) return code === 'BRANCH_NOT_FOUND';
  return error instanceof Error && error.message.includes('BRANCH_NOT_FOUND');
};

/**
 * Loads the shared-history lineage of a thread: its parent + own fork metadata
 * (from the root-to-current branch history) and its direct child branches.
 * Reports `isSupported: false` instead of erroring when the configured memory
 * has no branch support, so branch UI simply stays hidden for custom Memory.
 */
export const useThreadBranches = ({ threadId, agentId }: { threadId?: string; agentId?: string }) => {
  const client = useMastraClient();
  const requestContext = useMergedRequestContext();

  return useQuery({
    queryKey: ['memory', 'thread-branches', threadId, agentId, requestContext],
    queryFn: async (): Promise<ThreadBranchesInfo | null> => {
      if (!threadId || !agentId) return null;
      const thread = client.getMemoryThread({ threadId, agentId });
      try {
        const [historyResult, childrenResult] = await Promise.all([
          thread.getBranchHistory({ requestContext }),
          thread.listBranches({ perPage: false, requestContext }),
        ]);
        const own = historyResult.history[historyResult.history.length - 1];
        const parentThread = own?.branch
          ? (historyResult.history[historyResult.history.length - 2]?.thread ?? null)
          : null;
        return { isSupported: true, parentThread, fork: own?.branch ?? null, branches: childrenResult.branches };
      } catch (error) {
        if (isBranchingUnsupportedError(error)) return NO_BRANCHING;
        throw error;
      }
    },
    enabled: Boolean(threadId) && threadId !== 'new' && Boolean(agentId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    // The thread row may not be persisted yet right after navigating away from
    // /threads/new — retry the not-found window, but never retry hard failures.
    retry: (failureCount, error) => isBranchThreadNotFoundError(error) && failureCount < 5,
    refetchOnWindowFocus: false,
  });
};

export const useBranchThread = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const requestContext = useMergedRequestContext();

  return useMutation({
    mutationFn: async ({
      threadId,
      agentId,
      branchPointMessageId,
      title,
    }: {
      threadId: string;
      agentId: string;
      branchPointMessageId: string;
      title?: string;
    }) => {
      const thread = client.getMemoryThread({ threadId, agentId });
      return thread.branch({ branchPointMessageId, title, requestContext });
    },
    onSuccess: (_, variables) => {
      const { agentId } = variables;
      if (agentId) {
        void queryClient.invalidateQueries({ queryKey: ['memory', 'threads', agentId, agentId] });
        void queryClient.invalidateQueries({ queryKey: ['memory', 'thread-branches'] });
      }
      toast.success('Thread branched successfully');
    },
    onError: () => {
      toast.error('Failed to branch thread');
    },
  });
};

/**
 * Hook to fetch Observational Memory data for an agent
 * Returns the current OM record and history for a given resource/thread
 * Polls more frequently when observing/reflecting is in progress
 */
export const useObservationalMemory = ({
  agentId,
  resourceId,
  threadId,
  enabled = true,
  isActive = false,
}: {
  agentId: string;
  resourceId?: string;
  threadId?: string;
  enabled?: boolean;
  isActive?: boolean;
}) => {
  const client = useMastraClient();
  const requestContext = useMergedRequestContext();

  return useQuery<GetObservationalMemoryResponse | null>({
    queryKey: ['observational-memory', agentId, resourceId, threadId, requestContext],
    queryFn: async () => {
      if (!resourceId && !threadId) return null;
      return client.getObservationalMemory({
        agentId,
        resourceId,
        threadId,
        requestContext,
      });
    },
    enabled: enabled && Boolean(agentId) && (Boolean(resourceId) || Boolean(threadId)),
    staleTime: isActive ? 1000 : 30 * 1000, // 1 second when active, 30 seconds otherwise
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: isActive ? 2000 : false, // Poll every 2 seconds when active
    placeholderData: previousData => previousData, // Keep previous data during refetch to prevent skeleton flash
  });
};

/**
 * Hook to get OM-aware memory status
 * Extends useMemory with OM-specific status information
 * Polls more frequently when observing/reflecting is in progress
 */
export const useMemoryWithOMStatus = ({
  agentId,
  resourceId,
  threadId,
  pollWhenActive = true,
}: {
  agentId?: string;
  resourceId?: string;
  threadId?: string;
  pollWhenActive?: boolean;
}) => {
  const client = useMastraClient();
  const requestContext = useMergedRequestContext();
  const [isActive, setIsActive] = useState(false);

  const query = useQuery<GetMemoryStatusResponse | null>({
    queryKey: ['memory-status', agentId, resourceId, threadId, requestContext],
    queryFn: () =>
      agentId
        ? client.getMemoryStatus(agentId, requestContext, {
            resourceId,
            threadId,
          })
        : null,
    enabled: Boolean(agentId),
    staleTime: isActive && pollWhenActive ? 1000 : 30 * 1000, // 1 second when active, 30 seconds otherwise
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: isActive && pollWhenActive ? 2000 : false, // Poll every 2 seconds when active
    placeholderData: previousData => previousData, // Keep previous data during refetch to prevent skeleton flash
  });

  // Update isActive state when data changes
  const isObserving = query.data?.observationalMemory?.isObserving;
  const isReflecting = query.data?.observationalMemory?.isReflecting;

  useEffect(() => {
    const newIsActive = isObserving || isReflecting || false;
    setIsActive(newIsActive);
  }, [isObserving, isReflecting]);

  return query;
};
