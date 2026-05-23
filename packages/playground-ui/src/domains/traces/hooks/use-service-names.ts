import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

type UseServiceNamesOptions = {
  enabled?: boolean;
};

export const useServiceNames = ({ enabled = true }: UseServiceNamesOptions = {}) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['observability-service-names'],
    queryFn: async () => {
      try {
        return await client.getServiceNames();
      } catch {
        return { serviceNames: [] };
      }
    },
    select: data => data?.serviceNames ?? [],
    retry: false,
    enabled,
  });
};
