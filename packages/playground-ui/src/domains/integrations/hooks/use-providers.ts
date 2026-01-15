import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';

/**
 * Hook to fetch all available integration providers with their connection status.
 *
 * @returns Query result containing list of providers with connection status
 *
 * @example
 * ```tsx
 * const { data: providers, isLoading } = useProviders();
 * ```
 */
export const useProviders = () => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['integration-providers'],
    queryFn: () => client.listProviders(),
  });
};
