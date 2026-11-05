import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  createPlatformConnectSession,
  createPlatformReconnectSession,
  listAllPlatformConnections,
  listPlatformCatalog,
  listPlatformConnections,
  runHeadlessAuth,
  waitForActiveConnection,
} from '../ui/domains/factory/services/platformConnect';
import type { HeadlessAuthInput, PlatformConnectProviderId } from '../ui/domains/factory/services/platformConnect';

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

export function useAllPlatformConnectionsQuery(enabled: boolean) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.platformConnectionsAll(),
    queryFn: () => listAllPlatformConnections(baseUrl),
    enabled,
    retry: false,
  });
}

export function usePlatformCatalogQuery(enabled: boolean) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.platformCatalog(),
    queryFn: () => listPlatformCatalog(baseUrl),
    enabled,
    retry: false,
  });
}

/** Invalidate everything that reflects a provider's connection state. */
function useInvalidateProviderState(provider: string) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.platformConnectionsAll() }),
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
 * headless Nango auth (OAuth popup, or direct credential submission when
 * `credentials` are passed), then wait for the connection to activate.
 */
export function useConnectPlatformProviderMutation(provider: string) {
  const { baseUrl } = useApiConfig();
  const invalidate = useInvalidateProviderState(provider);
  return useMutation({
    mutationFn: async (auth: HeadlessAuthInput) => {
      const session = await createPlatformConnectSession(baseUrl, provider);
      await runHeadlessAuth({ session, ...auth });
      return waitForActiveConnection(baseUrl, provider, session.connectionId);
    },
    onSettled: invalidate,
  });
}

/** Reauthorize an existing connection through the same headless flow. */
export function useReconnectPlatformProviderMutation(provider: string) {
  const { baseUrl } = useApiConfig();
  const invalidate = useInvalidateProviderState(provider);
  return useMutation({
    mutationFn: async ({ connectionId, ...auth }: HeadlessAuthInput & { connectionId: string }) => {
      const session = await createPlatformReconnectSession(baseUrl, provider, connectionId);
      await runHeadlessAuth({ session, ...auth });
      return waitForActiveConnection(baseUrl, provider, connectionId);
    },
    onSettled: invalidate,
  });
}
