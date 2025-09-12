import { client } from '@/lib/client';
import { UpdateModelParams } from '@mastra/client-js';
import { usePlaygroundStore } from '@mastra/playground-ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useAgents = () => {
  const { runtimeContext } = usePlaygroundStore();
  const query = useQuery({
    queryKey: ['agents', JSON.stringify(runtimeContext)],
    queryFn: () => client.getAgents(runtimeContext),
  });

  return {
    ...query,
    data: query.data ?? {},
  };
};

export const useAgent = (agentId: string) => {
  const { runtimeContext } = usePlaygroundStore();
  return useQuery({
    queryKey: ['agent', agentId, JSON.stringify(runtimeContext)],
    queryFn: () => client.getAgent(agentId).details(runtimeContext),
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
