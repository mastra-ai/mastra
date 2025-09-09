import { client } from '@/lib/client';
import { ReorderModelListParams, UpdateModelInModelListParams, UpdateModelParams } from '@mastra/client-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useAgents = () => {
  const query = useQuery({
    queryKey: ['agents'],
    queryFn: () => client.getAgents(),
  });

  return {
    ...query,
    data: query.data ?? {},
  };
};

export const useAgent = (agentId: string) => {
  return useQuery({
    queryKey: ['agent', agentId],
    queryFn: () => client.getAgent(agentId).details(),
    enabled: !!agentId,
  });
};

export const useModelProviders = () => {
  return useQuery({
    queryKey: ['model-providers'],
    queryFn: () => client.getModelProviders(),
  });
};

export const useUpdateAgentModel = (agentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateModelParams) => client.getAgent(agentId).updateModel(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
    onError: err => {
      console.error('Error updating model', err);
    },
  });
};

export const useReorderModelList = (agentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ReorderModelListParams) => client.getAgent(agentId).reorderModelList(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
    onError: err => {
      console.error('Error reordering model list', err);
    },
  });
};

export const useUpdateModelInModelList = (agentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateModelInModelListParams) =>
      client.getAgent(agentId).updateModelInModelList(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
    onError: err => {
      console.error('Error updating model in model list', err);
    },
  });
};
