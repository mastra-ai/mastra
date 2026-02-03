import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { usePlaygroundStore } from '@/store/playground-store';
import type { ListIntegrationsParams } from '@mastra/client-js';

/**
 * Hook to fetch list of configured integrations.
 *
 * @param params - Optional query parameters for filtering and pagination
 * @returns Query result containing list of integrations
 *
 * @example
 * ```tsx
 * const { data: integrations, isLoading } = useIntegrations({
 *   provider: 'composio',
 *   enabled: true
 * });
 * ```
 */
export const useIntegrations = (params?: ListIntegrationsParams) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['integrations', params, requestContext],
    queryFn: () => client.listIntegrations(params),
  });
};

/**
 * Hook to fetch a single integration by ID.
 *
 * @param integrationId - The integration ID
 * @returns Query result containing the integration details
 *
 * @example
 * ```tsx
 * const { data: integration, isLoading } = useIntegration('integration-id');
 * ```
 */
export const useIntegration = (integrationId?: string) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['integration', integrationId, requestContext],
    queryFn: () => (integrationId ? client.getIntegration(integrationId) : null),
    enabled: Boolean(integrationId),
  });
};
