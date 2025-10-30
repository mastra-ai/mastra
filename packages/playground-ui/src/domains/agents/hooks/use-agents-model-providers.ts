import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const useAgentsModelProviders = () => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['agents-model-providers'],
    queryFn: () => client.listAgentsModelProviders(),
    retry: false,
  });
};
