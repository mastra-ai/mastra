import type { GetObservationalMemoryResponse, GetMemoryStatusResponse, MastraClient } from '@mastra/client-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraMutationOptions, MastraQueryOptions } from '../shared/query-options';

export interface MemorySearchParams {
  lastMessages?: number | false;
}

type MemoryStatusResponse = Awaited<ReturnType<MastraClient['getMemoryStatus']>> | null;
type MemoryConfigResponse = Awaited<ReturnType<MastraClient['getMemoryConfig']>> | null;
type ThreadResponse = Awaited<ReturnType<ReturnType<MastraClient['getMemoryThread']>['get']>>;
type ThreadsResponse = Awaited<ReturnType<MastraClient['listMemoryThreads']>>['threads'] | null;
type UpdateThreadResponse = Awaited<ReturnType<ReturnType<MastraClient['getMemoryThread']>['update']>>;
type CloneThreadResponse = Awaited<ReturnType<ReturnType<MastraClient['getMemoryThread']>['clone']>>;
type SearchMemoryResponse = Awaited<ReturnType<MastraClient['searchMemory']>>;
type ThreadVariables = { threadId: string; agentId: string };

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useMemory = <TData = MemoryStatusResponse>({
  agentId,
  requestContext,
  queryOptions,
}: {
  agentId?: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<MemoryStatusResponse, TData>;
} = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['memory', agentId, requestContext],
    queryFn: () => (agentId ? client.getMemoryStatus(agentId, requestContext) : null),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: false,
    ...queryOptions,
  });
};

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useMemoryConfig = <TData = MemoryConfigResponse>({
  agentId,
  requestContext,
  queryOptions,
}: {
  agentId?: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<MemoryConfigResponse, TData>;
} = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['memory', 'config', agentId, requestContext],
    queryFn: () => (agentId ? client.getMemoryConfig({ agentId, requestContext }) : null),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: false,
    refetchOnWindowFocus: false,
    ...queryOptions,
  });
};

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useThread = <TData = ThreadResponse>({
  threadId,
  agentId,
  requestContext,
  queryOptions,
}: {
  threadId?: string;
  agentId?: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<ThreadResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['memory', 'thread', threadId, agentId, requestContext],
    queryFn: () => client.getMemoryThread({ threadId: threadId!, agentId }).get({ requestContext }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
    ...queryOptions,
  });
};

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useThreads = <TData = ThreadsResponse>({
  resourceId,
  agentId,
  isMemoryEnabled,
  requestContext,
  queryOptions,
}: {
  resourceId: string;
  agentId: string;
  isMemoryEnabled: boolean;
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<ThreadsResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['memory', 'threads', resourceId, agentId, requestContext],
    queryFn: async () => {
      if (!isMemoryEnabled) return null;
      const result = await client.listMemoryThreads({ resourceId, agentId, requestContext });
      return result.threads;
    },
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    ...queryOptions,
  });
};

export type DeleteThreadResponse = Awaited<ReturnType<ReturnType<MastraClient['getMemoryThread']>['delete']>>;

export const useDeleteThread = ({
  requestContext,
  queryOptions,
}: {
  requestContext?: Record<string, any>;
  queryOptions?: MastraMutationOptions<DeleteThreadResponse, ThreadVariables>;
} = {}): UseMutationResult<DeleteThreadResponse, Error, ThreadVariables> => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

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
    },
    ...queryOptions,
  });
};

export const useUpdateThread = ({
  requestContext,
  queryOptions,
}: {
  requestContext?: Record<string, any>;
  queryOptions?: MastraMutationOptions<UpdateThreadResponse, ThreadVariables & { title: string }>;
} = {}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ threadId, agentId, title }: { threadId: string; agentId: string; title: string }) =>
      client.getMemoryThread({ threadId, agentId }).update({ title, agentId, requestContext }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['memory', 'threads'] });
      void queryClient.invalidateQueries({ queryKey: ['memory', 'thread'] });
    },
    ...queryOptions,
  });
};

export const useMemorySearch = ({
  agentId,
  resourceId,
  threadId,
  requestContext,
  queryOptions,
}: {
  agentId: string;
  resourceId: string;
  threadId?: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraMutationOptions<
    SearchMemoryResponse,
    { searchQuery: string; memoryConfig?: MemorySearchParams }
  >;
}) => {
  const client = useMastraClient();
  return useMutation({
    mutationFn: async ({ searchQuery, memoryConfig }: { searchQuery: string; memoryConfig?: MemorySearchParams }) => {
      return client.searchMemory({ agentId, resourceId, threadId, searchQuery, memoryConfig, requestContext });
    },
    ...queryOptions,
  });
};

export const useCloneThread = ({
  requestContext,
  queryOptions,
}: {
  requestContext?: Record<string, any>;
  queryOptions?: MastraMutationOptions<CloneThreadResponse, ThreadVariables & { title?: string }>;
} = {}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

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
    },
    ...queryOptions,
  });
};

/**
 * Hook to fetch Observational Memory data for an agent
 * Returns the current OM record and history for a given resource/thread
 * Polls more frequently when observing/reflecting is in progress
 *
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useObservationalMemoryWithHistory = <TData = GetObservationalMemoryResponse | null>({
  agentId,
  resourceId,
  threadId,
  isActive = false,
  requestContext,
  queryOptions,
}: {
  agentId: string;
  resourceId?: string;
  threadId?: string;
  isActive?: boolean;
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<GetObservationalMemoryResponse | null, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['observational-memory', agentId, resourceId, threadId, requestContext],
    queryFn: async (): Promise<GetObservationalMemoryResponse | null> => {
      if (!resourceId && !threadId) return null;
      return client.getObservationalMemory({
        agentId,
        resourceId,
        threadId,
        requestContext,
      });
    },
    staleTime: isActive ? 1000 : 30 * 1000, // 1 second when active, 30 seconds otherwise
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: isActive ? 2000 : false, // Poll every 2 seconds when active
    placeholderData: previousData => previousData, // Keep previous data during refetch to prevent skeleton flash
    ...queryOptions,
  });
};

/**
 * Hook to get OM-aware memory status
 * Extends useMemory with OM-specific status information
 * Polls more frequently when observing/reflecting is in progress
 *
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useMemoryWithOMStatus = ({
  agentId,
  resourceId,
  threadId,
  pollWhenActive = true,
  requestContext,
  queryOptions,
}: {
  agentId?: string;
  resourceId?: string;
  threadId?: string;
  pollWhenActive?: boolean;
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<GetMemoryStatusResponse | null>;
}) => {
  const client = useMastraClient();
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
    staleTime: isActive && pollWhenActive ? 1000 : 30 * 1000, // 1 second when active, 30 seconds otherwise
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: isActive && pollWhenActive ? 2000 : false, // Poll every 2 seconds when active
    placeholderData: previousData => previousData, // Keep previous data during refetch to prevent skeleton flash
    ...queryOptions,
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
