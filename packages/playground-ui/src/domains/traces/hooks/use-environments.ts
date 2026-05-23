import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

type UseEnvironmentsOptions = {
  enabled?: boolean;
};

export const useEnvironments = ({ enabled = true }: UseEnvironmentsOptions = {}) => {
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
    enabled,
  });
};
