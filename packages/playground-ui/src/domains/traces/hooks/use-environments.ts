import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const useEnvironments = () => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['observability-environments'],
    queryFn: async () => {
      try {
        return await client.getEnvironments();
      } catch {
        return { environments: [] };
      }
    },
    select: data => data?.environments ?? [],
    retry: false,
  });
};
