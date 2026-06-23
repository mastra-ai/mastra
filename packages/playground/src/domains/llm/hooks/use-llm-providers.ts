import type { ListAgentsModelProvidersResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const useLLMProviders = () => {
  const client = useMastraClient();

  return useQuery<ListAgentsModelProvidersResponse>({
    queryKey: ['llm-providers'],
    queryFn: async () => client.listAgentsModelProviders(),
    retry: false,
  });
};
