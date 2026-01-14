import { useInfiniteQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import type { IntegrationProvider, ListProviderToolkitsParams } from '@mastra/client-js';

/**
 * Hook to fetch toolkits from a specific integration provider with pagination support.
 *
 * @param provider - The integration provider name (e.g., 'composio', 'arcade')
 * @param options - Optional query options including params and enabled flag
 * @returns Infinite query result containing paginated list of toolkits from the provider
 *
 * @example
 * ```tsx
 * const { data, fetchNextPage, hasNextPage } = useProviderToolkits('composio', {
 *   params: { search: 'github', limit: 20 },
 *   enabled: true
 * });
 * ```
 */
export const useProviderToolkits = (
  provider: string,
  options?: { params?: Omit<ListProviderToolkitsParams, 'cursor'>; enabled?: boolean },
) => {
  const client = useMastraClient();
  const { params, enabled = true } = options || {};

  return useInfiniteQuery({
    queryKey: ['integration-provider-toolkits', provider, params],
    queryFn: ({ pageParam }) => {
      if (!provider) throw new Error('Provider is required');
      return client.listProviderToolkits(provider as IntegrationProvider, {
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
