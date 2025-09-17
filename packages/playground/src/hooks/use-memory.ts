import { toast } from 'sonner';
import { useSWRConfig } from 'swr';
import { useQuery } from '@tanstack/react-query';

import type { MemorySearchResponse, MemorySearchParams } from '@/types/memory';
import { useMastraClient } from '@mastra/playground-ui';

export const useMemory = (agentId?: string) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['memory', agentId],
    queryFn: () => (agentId ? client.getMemoryStatus(agentId) : null),
    enabled: Boolean(agentId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: false,
  });
};

export const useMemoryConfig = (agentId?: string) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['memory', 'config', agentId],
    queryFn: () => (agentId ? client.getMemoryConfig({ agentId }) : null),
    enabled: Boolean(agentId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: false,
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

  return useQuery({
    queryKey: ['memory', 'threads', resourceId, agentId],
    queryFn: () => (isMemoryEnabled ? client.getMemoryThreads({ resourceId, agentId }) : null),
    enabled: Boolean(isMemoryEnabled),
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 5000,
    retry: false,
  });
};

export const useMessages = ({ threadId, memory, agentId }: { threadId: string; memory: boolean; agentId: string }) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['memory', 'messages', threadId, agentId],
    queryFn: () => (memory ? client.getThreadMessages(threadId, { agentId }) : null),
    enabled: Boolean(memory),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
};

export const useDeleteThread = () => {
  const { mutate } = useSWRConfig();

  const deleteThread = async ({
    threadId,
    resourceId,
    agentId,
  }: {
    threadId: string;
    agentId: string;
    resourceId: string;
  }) => {
    const deletePromise = fetch(`/api/memory/threads/${threadId}?agentId=${agentId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-mastra-dev-playground': 'true',
      },
    });

    toast.promise(deletePromise, {
      loading: 'Deleting chat...',
      success: () => {
        mutate(`/api/memory/threads?resourceid=${resourceId}&agentId=${agentId}`);
        return 'Chat deleted successfully';
      },
      error: 'Failed to delete chat',
    });
  };

  return { deleteThread };
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
  const searchMemory = async (searchQuery: string, memoryConfig?: MemorySearchParams) => {
    if (!searchQuery.trim()) {
      return { results: [], count: 0, query: searchQuery };
    }

    const params = new URLSearchParams({
      searchQuery,
      resourceId,
      agentId,
    });

    if (threadId) {
      params.append('threadId', threadId);
    }

    if (memoryConfig) {
      params.append('memoryConfig', JSON.stringify(memoryConfig));
    }

    const response = await fetch(`/api/memory/search?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-mastra-dev-playground': 'true',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      console.error('Search memory error:', errorData);
      throw new Error(errorData.message || errorData.error || 'Failed to search memory');
    }

    return response.json() as Promise<MemorySearchResponse>;
  };

  return { searchMemory };
};
