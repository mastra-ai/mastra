import type { ListAgentsModelProvidersResponse } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';

export const useLLMProviders = () => {
  const client = useMastraClient();

  return useQuery<ListAgentsModelProvidersResponse>({
    queryKey: ['llm-providers'],
    queryFn: async () => client.listAgentsModelProviders(),
    retry: false,
  });
};
