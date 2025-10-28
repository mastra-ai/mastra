import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { MemorySearchResponse, MemorySearchParams } from '@/types/memory';
import { useMastraClient } from '@mastra/react';
import { usePlaygroundStore } from '@/store/playground-store';

export const useMemory = (agentId?: string) => {
  const client = useMastraClient();
  const { runtimeContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['memory', agentId],
    queryFn: () => (agentId ? client.getMemoryStatus(agentId, runtimeContext) : null),
    enabled: Boolean(agentId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: false,
  });
};

export const useMemoryConfig = (agentId?: string) => {
  const client = useMastraClient();
  const { runtimeContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['memory', 'config', agentId],
    queryFn: () => (agentId ? client.getMemoryConfig({ agentId, runtimeContext }) : null),
    enabled: Boolean(agentId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
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
  const { runtimeContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['memory', 'threads', resourceId, agentId],
    queryFn: () => (isMemoryEnabled ? client.getMemoryThreads({ resourceId, agentId, runtimeContext }) : null),
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
  const { runtimeContext } = usePlaygroundStore();

  return useMutation({
    mutationFn: ({ threadId, agentId, networkId }: { threadId: string; agentId?: string; networkId?: string }) =>
      client.deleteThread(threadId, { agentId, networkId, runtimeContext }),
    onSuccess: (_, variables) => {
      const { agentId, networkId } = variables;
      if (agentId) {
        queryClient.invalidateQueries({ queryKey: ['memory', 'threads', agentId, agentId] });
      }
      if (networkId) {
        queryClient.invalidateQueries({ queryKey: ['network', 'threads', networkId, networkId] });
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
  const { runtimeContext } = usePlaygroundStore();
  const searchMemory = async (searchQuery: string, memoryConfig?: MemorySearchParams) => {
    if (!searchQuery.trim()) {
      return { results: [], count: 0, query: searchQuery };
    }

    const params = new URLSearchParams({
      searchQuery,
      resourceId,
      agentId,
      runtimeContext: btoa(JSON.stringify(runtimeContext)),
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
