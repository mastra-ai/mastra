import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import type { IntegrationProvider, ListProviderToolsParams } from '@mastra/client-js';

/**
 * Hook to fetch tools from a specific integration provider.
 *
 * @param provider - The integration provider name (e.g., 'composio', 'arcade')
 * @param params - Optional query parameters for filtering by toolkit and pagination
 * @returns Query result containing list of tools from the provider
 *
 * @example
 * ```tsx
 * const { data: tools, isLoading } = useProviderTools('composio', {
 *   toolkitSlug: 'github',
 *   limit: 50
 * });
 * ```
 *
 * @example
 * ```tsx
 * // Fetch tools from multiple toolkits (comma-separated)
 * const { data: tools } = useProviderTools('composio', {
 *   toolkitSlugs: 'github,slack,gmail'
 * });
 * ```
 */
export const useProviderTools = (provider?: IntegrationProvider, params?: ListProviderToolsParams) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['integration-provider-tools', provider, params],
    queryFn: () => {
      if (!provider) throw new Error('Provider is required');
      return client.listProviderTools(provider, params);
    },
    enabled: Boolean(provider),
  });
};
