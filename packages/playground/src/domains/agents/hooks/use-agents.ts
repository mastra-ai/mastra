import type { ReorderModelListParams, UpdateModelInModelListParams, UpdateModelParams } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { isModelNotAllowedError } from '@/domains/builder';
import { usePlaygroundStore } from '@/store/playground-store';

const handleModelMutationError = (queryClient: ReturnType<typeof useQueryClient>, fallbackMessage: string) => {
  return (err: unknown) => {
    const details = isModelNotAllowedError(err);
    if (details) {
      toast.error(details.message);
      // Refresh policy + agent so the UI re-renders with the latest server truth.
      void queryClient.invalidateQueries({ queryKey: ['builder-settings'] });
      return;
    }
    console.error(fallbackMessage, err);
  };
};

export const useAgents = (options?: { enabled?: boolean }) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['agents', requestContext],
    queryFn: () => client.listAgents(requestContext),
    enabled: options?.enabled ?? true,
  });
};

export const useUpdateAgentModel = (agentId: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateModelParams) => client.getAgent(agentId).updateModel(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
    onError: handleModelMutationError(queryClient, 'Error updating model'),
  });
};

export const useReorderModelList = (agentId: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ReorderModelListParams) => client.getAgent(agentId).reorderModelList(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
    onError: handleModelMutationError(queryClient, 'Error reordering model list'),
  });
};

export const useUpdateModelInModelList = (agentId: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateModelInModelListParams) =>
      client.getAgent(agentId).updateModelInModelList(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
    onError: handleModelMutationError(queryClient, 'Error updating model in model list'),
  });
};

export const useResetAgentModel = (agentId: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => client.getAgent(agentId).resetModel(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
    onError: handleModelMutationError(queryClient, 'Error resetting model'),
  });
};
