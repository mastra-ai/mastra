import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { usePlaygroundStore } from '@/store/playground-store';
import type { CreateStoredAgentParams, UpdateStoredAgentParams } from '@mastra/client-js';

export const useStoredAgentMutations = (agentId?: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  const createMutation = useMutation({
    mutationFn: (params: CreateStoredAgentParams) => client.createStoredAgent(params, requestContext),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (params: UpdateStoredAgentParams) => {
      if (!agentId) throw new Error('agentId is required for update');
      return client.getStoredAgent(agentId).update(params, requestContext);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      if (agentId) {
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
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  return {
    createStoredAgent: createMutation,
    updateStoredAgent: updateMutation,
    deleteStoredAgent: deleteMutation,
  };
};
