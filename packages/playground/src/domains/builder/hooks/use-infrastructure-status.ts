import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

interface UseInfrastructureStatusOptions {
  enabled?: boolean;
}

/**
 * Fetches runtime infrastructure status (channels, browser, workspaces) from
 * the server. Admin-only — the server requires the `*` permission.
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
