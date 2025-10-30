import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { MemorySearchParams } from '@/types/memory';
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
    queryFn: () => (isMemoryEnabled ? client.listMemoryThreads({ resourceId, agentId, runtimeContext }) : null),
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
    mutationFn: ({ threadId, agentId }: { threadId: string; agentId: string }) => {
      const thread = client.getMemoryThread({ threadId, agentId });
      return thread.delete({ runtimeContext });
    },
    onSuccess: (_, variables) => {
      const { agentId } = variables;
      if (agentId) {
        queryClient.invalidateQueries({ queryKey: ['memory', 'threads', agentId, agentId] });
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
  const client = useMastraClient();
  return useMutation({
    mutationFn: async ({ searchQuery, memoryConfig }: { searchQuery: string; memoryConfig?: MemorySearchParams }) => {
      return client.searchMemory({ agentId, resourceId, threadId, searchQuery, memoryConfig, runtimeContext });
    },
  });
};
