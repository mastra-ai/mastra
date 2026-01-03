import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { MemorySearchParams } from '@/types/memory';
import { useMastraClient } from '@mastra/react';
import { usePlaygroundStore } from '@/store/playground-store';

export const useMemory = (agentId?: string) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['memory', agentId],
    queryFn: () => (agentId ? client.getMemoryStatus(agentId, requestContext) : null),
    enabled: Boolean(agentId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: false,
  });
};

export const useMemoryConfig = (agentId?: string) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['memory', 'config', agentId],
    queryFn: () => (agentId ? client.getMemoryConfig({ agentId, requestContext }) : null),
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
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['memory', 'threads', resourceId, agentId],
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
  const { requestContext } = usePlaygroundStore();

  return useMutation({
    mutationFn: ({ threadId, agentId }: { threadId: string; agentId: string }) => {
      const thread = client.getMemoryThread({ threadId, agentId });
      return thread.delete({ requestContext });
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
  const { requestContext } = usePlaygroundStore();
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
  const { requestContext } = usePlaygroundStore();

  return useMutation({
    mutationFn: async ({ threadId, agentId, title }: { threadId: string; agentId: string; title?: string }) => {
      const thread = client.getMemoryThread({ threadId, agentId });
      return thread.clone({ title, requestContext });
    },
    onSuccess: (_, variables) => {
      const { agentId } = variables;
      if (agentId) {
        queryClient.invalidateQueries({ queryKey: ['memory', 'threads', agentId, agentId] });
      }
      toast.success('Thread cloned successfully');
    },
    onError: () => {
      toast.error('Failed to clone thread');
    },
  });
};

export const useBranchThread = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation({
    mutationFn: async ({
      threadId,
      agentId,
      branchPointMessageId,
      title,
    }: {
      threadId: string;
      agentId: string;
      branchPointMessageId?: string;
      title?: string;
    }) => {
      const thread = client.getMemoryThread({ threadId, agentId });
      return thread.branch({ branchPointMessageId, title, requestContext });
    },
    onSuccess: (_, variables) => {
      const { agentId } = variables;
      if (agentId) {
        queryClient.invalidateQueries({ queryKey: ['memory', 'threads', agentId, agentId] });
      }
      toast.success('Thread branched successfully');
    },
    onError: () => {
      toast.error('Failed to branch thread');
    },
  });
};

export const usePromoteBranch = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation({
    mutationFn: async ({
      threadId,
      agentId,
      deleteParentMessages,
    }: {
      threadId: string;
      agentId: string;
      deleteParentMessages?: boolean;
    }) => {
      const thread = client.getMemoryThread({ threadId, agentId });
      return thread.promote({ deleteParentMessages, requestContext });
    },
    onSuccess: (_, variables) => {
      const { agentId } = variables;
      if (agentId) {
        queryClient.invalidateQueries({ queryKey: ['memory', 'threads', agentId, agentId] });
      }
      toast.success('Branch promoted successfully');
    },
    onError: () => {
      toast.error('Failed to promote branch');
    },
  });
};

export const useListBranches = ({
  threadId,
  agentId,
  enabled = true,
}: {
  threadId: string;
  agentId: string;
  enabled?: boolean;
}) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['memory', 'branches', threadId, agentId],
    queryFn: async () => {
      const thread = client.getMemoryThread({ threadId, agentId });
      const result = await thread.listBranches(requestContext);
      return result.branches;
    },
    enabled: Boolean(enabled && threadId && agentId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
};

export const useParentThread = ({
  threadId,
  agentId,
  enabled = true,
}: {
  threadId: string;
  agentId: string;
  enabled?: boolean;
}) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['memory', 'parent', threadId, agentId],
    queryFn: async () => {
      const thread = client.getMemoryThread({ threadId, agentId });
      const result = await thread.getParent(requestContext);
      return result.thread;
    },
    enabled: Boolean(enabled && threadId && agentId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
};

export const useBranchHistory = ({
  threadId,
  agentId,
  enabled = true,
}: {
  threadId: string;
  agentId: string;
  enabled?: boolean;
}) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['memory', 'branchHistory', threadId, agentId],
    queryFn: async () => {
      const thread = client.getMemoryThread({ threadId, agentId });
      const result = await thread.getBranchHistory(requestContext);
      return result.history;
    },
    enabled: Boolean(enabled && threadId && agentId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
};
