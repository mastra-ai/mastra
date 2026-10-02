import { useQuery } from '@tanstack/react-query';
import { DISCOVERY_STALE_TIME } from './discovery-cache';
import { useMastraClient } from '@/mastra-client-context';

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
    staleTime: DISCOVERY_STALE_TIME,
  });
};
