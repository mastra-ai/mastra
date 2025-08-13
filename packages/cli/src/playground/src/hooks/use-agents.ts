import { client } from '@/lib/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { groq } from '@ai-sdk/groq';
import { xai } from '@ai-sdk/xai';
import { google } from '@ai-sdk/google';

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
    mutationFn: async ({ modelId, provider }: { modelId: string; provider: string }) => {
      try {
        let model = openai(modelId);

        if (provider === 'anthropic') {
          model = anthropic(modelId);
        } else if (provider === 'groq') {
          model = groq(modelId);
        } else if (provider === 'xai') {
          model = xai(modelId);
        } else if (provider === 'google') {
          model = google(modelId);
        }

        const res = await client.getAgent(agentId).updateModel({ model });

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
