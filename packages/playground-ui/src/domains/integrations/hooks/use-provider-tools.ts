import { useInfiniteQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import type { IntegrationProvider, ListProviderToolsParams } from '@mastra/client-js';

/**
 * Hook to fetch tools from a specific integration provider with pagination support.
 *
 * @param provider - The integration provider name (e.g., 'composio', 'arcade')
 * @param options - Optional query options including params and enabled flag
 * @returns Infinite query result containing paginated list of tools from the provider
 *
 * @example
 * ```tsx
 * const { data, fetchNextPage, hasNextPage } = useProviderTools('composio', {
 *   params: { toolkitSlugs: ['github', 'slack'], limit: 50 },
 *   enabled: true
 * });
 * ```
 */
export const useProviderTools = (
  provider: string,
  options?: { params?: Omit<ListProviderToolsParams, 'cursor'>; enabled?: boolean },
) => {
  const client = useMastraClient();
  const { params, enabled = true } = options || {};

  return useInfiniteQuery({
    queryKey: ['integration-provider-tools', provider, params],
    queryFn: ({ pageParam }) => {
      if (!provider) throw new Error('Provider is required');
      return client.listProviderTools(provider as IntegrationProvider, {
        ...params,
        cursor: pageParam,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => {
      return lastPage.hasMore ? lastPage.nextCursor : undefined;
    },
    enabled: Boolean(provider) && enabled,
  });
};
