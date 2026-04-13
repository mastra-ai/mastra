import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const useLLMProviders = () => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['llm-providers'],
    queryFn: () => client.listAgentsModelProviders(),
    retry: false,
  });
};
