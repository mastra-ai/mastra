import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

interface UseInfrastructureStatusOptions {
  enabled?: boolean;
}

/**
 * Fetches Agent Builder infrastructure configuration and resolution status from
 * the server. Admin-only by default — the server requires `infrastructure:read`.
 */
export const useInfrastructureStatus = (options?: UseInfrastructureStatusOptions) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['infrastructure-status'],
    queryFn: () => client.getInfrastructureStatus(),
    enabled: options?.enabled ?? true,
    retry: false,
  });
};
