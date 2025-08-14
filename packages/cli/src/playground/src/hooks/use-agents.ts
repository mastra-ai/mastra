import { client } from '@/lib/client';
import { UpdateModelParams } from '@mastra/client-js';
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
    mutationFn: async (payload: UpdateModelParams) => {
      try {
        const res = await client.getAgent(agentId).updateModel(payload);

        return res;
      } catch (error) {
        console.error('Error updating model', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
  });
};
