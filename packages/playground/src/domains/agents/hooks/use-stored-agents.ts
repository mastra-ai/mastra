import type { CreateStoredAgentParams, UpdateStoredAgentParams, ListStoredAgentsParams } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePlaygroundStore } from '@/store/playground-store';

export const useStoredAgents = (params?: ListStoredAgentsParams) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['stored-agents', params],
    queryFn: () => client.listStoredAgents(params),
  });
};

export const useStoredAgent = (agentId?: string, options?: { status?: 'draft' | 'published'; enabled?: boolean }) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();
  const { enabled = true, ...queryOptions } = options ?? {};

  return useQuery({
    queryKey: ['stored-agent', agentId, queryOptions.status, requestContext],
    queryFn: async () => {
      if (!agentId) return null;
      try {
        return await client.getStoredAgent(agentId).details(requestContext, queryOptions);
      } catch (error) {
        // 404 is expected for code-only agents that haven't been stored yet
        if (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: Boolean(agentId) && enabled,
  });
};

export type StoredAgent = NonNullable<ReturnType<typeof useStoredAgent>['data']>;

export const useStoredAgentMutations = (agentId?: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  const createMutation = useMutation({
    mutationFn: (params: CreateStoredAgentParams) => client.createStoredAgent(params),
    onSuccess: () => {
      // Invalidate both stored-agents list and the merged agents list
      void queryClient.invalidateQueries({ queryKey: ['stored-agents'] });
      void queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (params: UpdateStoredAgentParams) => {
      if (!agentId) throw new Error('agentId is required for update');
      return client.getStoredAgent(agentId).update(params, requestContext);
    },
    onSuccess: () => {
      // Invalidate lists
      void queryClient.invalidateQueries({ queryKey: ['stored-agents'] });
      void queryClient.invalidateQueries({ queryKey: ['agents'] });
      // Invalidate specific agent details
      if (agentId) {
        void queryClient.invalidateQueries({ queryKey: ['stored-agent', agentId] });
        void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!agentId) throw new Error('agentId is required for delete');
      return client.getStoredAgent(agentId).delete(requestContext);
    },
    onSuccess: () => {
      // Invalidate lists
      void queryClient.invalidateQueries({ queryKey: ['stored-agents'] });
      void queryClient.invalidateQueries({ queryKey: ['agents'] });
      // Invalidate specific agent details
      if (agentId) {
        void queryClient.invalidateQueries({ queryKey: ['stored-agent', agentId] });
        void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
      }
    },
  });

  return {
    createStoredAgent: createMutation,
    updateStoredAgent: updateMutation,
    deleteStoredAgent: deleteMutation,
  };
};
