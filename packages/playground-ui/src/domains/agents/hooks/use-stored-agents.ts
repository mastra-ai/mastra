import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { usePlaygroundStore } from '@/store/playground-store';
import type { CreateStoredAgentParams, UpdateStoredAgentParams, ListStoredAgentsParams } from '@mastra/client-js';

export const useStoredAgents = (params?: ListStoredAgentsParams) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['stored-agents', params, requestContext],
    queryFn: () => client.listStoredAgents(params, requestContext),
  });
};

export const useStoredAgent = (agentId?: string) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['stored-agent', agentId, requestContext],
    queryFn: () => (agentId ? client.getStoredAgent(agentId).details(requestContext) : null),
    enabled: Boolean(agentId),
  });
};

export const useStoredAgentMutations = (agentId?: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  const createMutation = useMutation({
    mutationFn: (params: CreateStoredAgentParams) => client.createStoredAgent(params, requestContext),
    onSuccess: () => {
      // Invalidate both stored-agents list and the merged agents list
      queryClient.invalidateQueries({ queryKey: ['stored-agents'] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (params: UpdateStoredAgentParams) => {
      if (!agentId) throw new Error('agentId is required for update');
      return client.getStoredAgent(agentId).update(params, requestContext);
    },
    onSuccess: () => {
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: ['stored-agents'] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      // Invalidate specific agent details
      if (agentId) {
        queryClient.invalidateQueries({ queryKey: ['stored-agent', agentId] });
        queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
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
      queryClient.invalidateQueries({ queryKey: ['stored-agents'] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      // Invalidate specific agent details
      if (agentId) {
        queryClient.invalidateQueries({ queryKey: ['stored-agent', agentId] });
        queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
      }
    },
  });

  return {
    createStoredAgent: createMutation,
    updateStoredAgent: updateMutation,
    deleteStoredAgent: deleteMutation,
  };
};
