import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import type { IntegrationProvider, ListProviderToolkitsParams } from '@mastra/client-js';

/**
 * Hook to fetch toolkits from a specific integration provider.
 *
 * @param provider - The integration provider name (e.g., 'composio', 'arcade')
 * @param params - Optional query parameters for filtering and pagination
 * @returns Query result containing list of toolkits from the provider
 *
 * @example
 * ```tsx
 * const { data: toolkits, isLoading } = useProviderToolkits('composio', {
 *   search: 'github',
 *   limit: 20
 * });
 * ```
 */
export const useProviderToolkits = (provider?: IntegrationProvider, params?: ListProviderToolkitsParams) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['integration-provider-toolkits', provider, params],
    queryFn: () => {
      if (!provider) throw new Error('Provider is required');
      return client.listProviderToolkits(provider, params);
    },
    enabled: Boolean(provider),
  });
};
