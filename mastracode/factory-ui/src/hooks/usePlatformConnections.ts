import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  createPlatformConnectSession,
  createPlatformReconnectSession,
  isPlatformConnectUnavailableError,
  listPlatformConnections,
  runHeadlessAuth,
  waitForActiveConnection,
} from '../ui/domains/factory/services/platformConnect';
import type { PlatformConnectProviderId } from '../ui/domains/factory/services/platformConnect';

/**
 * The org's Platform connections for one provider. Server responds 403/404
 * when the feature is unavailable (auth off, no Platform credentials); the
 * query surfaces that as `error` and consumers hide the connect UI.
 */
export function usePlatformConnectionsQuery(provider: PlatformConnectProviderId, enabled: boolean = true) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.platformConnections(provider),
    queryFn: () => listPlatformConnections(baseUrl, provider),
    enabled,
    retry: false,
  });
}

/**
 * Whether the org has an active Platform connection to one provider. A deployment without Platform
 * (403/404) has none: that answer is data, not an error, so a page that reads it again doesn't ask
 * again. Keyed under the provider's connections, so connecting or disconnecting refreshes it.
 */
export function activePlatformConnectionQueryOptions(baseUrl: string, provider: PlatformConnectProviderId) {
  return queryOptions({
    queryKey: [...queryKeys.platformConnections(provider), 'active'],
    queryFn: async () => {
      try {
        const connections = await listPlatformConnections(baseUrl, provider);
        return connections.some(connection => connection.status === 'active');
      } catch (error) {
        if (isPlatformConnectUnavailableError(error)) return false;
        throw error;
      }
    },
    retry: false,
  });
}

/** Invalidate everything that reflects a provider's connection state. */
function useInvalidateProviderState(provider: PlatformConnectProviderId) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.platformConnections(provider) }),
      ...(provider === 'jira'
        ? [
            queryClient.invalidateQueries({ queryKey: queryKeys.jiraStatus() }),
            queryClient.invalidateQueries({ queryKey: queryKeys.jiraProjects() }),
          ]
        : []),
      ...(provider === 'incident-io'
        ? [
            queryClient.invalidateQueries({ queryKey: queryKeys.incidentioStatus() }),
            queryClient.invalidateQueries({ queryKey: queryKeys.incidentioSources() }),
          ]
        : []),
      ...(provider === 'gitlab'
        ? [
            queryClient.invalidateQueries({ queryKey: ['gitlab', 'status'] }),
            queryClient.invalidateQueries({ queryKey: ['gitlab', 'projects'] }),
          ]
        : []),
    ]);
  };
}

/**
 * Connect a new provider account: mint a session server-side, run the
 * headless Nango auth (OAuth popup, or direct API-key submission when
 * `credentials` are passed), then wait for the connection to activate.
 */
export function useConnectPlatformProviderMutation(provider: PlatformConnectProviderId) {
  const { baseUrl } = useApiConfig();
  const invalidate = useInvalidateProviderState(provider);
  return useMutation({
    mutationFn: async (input: { credentials?: Record<string, string> } = {}) => {
      const session = await createPlatformConnectSession(baseUrl, provider);
      await runHeadlessAuth({ session, ...(input.credentials ? { credentials: input.credentials } : {}) });
      return waitForActiveConnection(baseUrl, provider, session.connectionId);
    },
    onSettled: invalidate,
  });
}

/** Reauthorize an existing connection through the same headless flow. */
export function useReconnectPlatformProviderMutation(provider: PlatformConnectProviderId) {
  const { baseUrl } = useApiConfig();
  const invalidate = useInvalidateProviderState(provider);
  return useMutation({
    mutationFn: async (input: { connectionId: string; credentials?: Record<string, string> }) => {
      const session = await createPlatformReconnectSession(baseUrl, provider, input.connectionId);
      await runHeadlessAuth({ session, ...(input.credentials ? { credentials: input.credentials } : {}) });
      return waitForActiveConnection(baseUrl, provider, input.connectionId);
    },
    onSettled: invalidate,
  });
}
