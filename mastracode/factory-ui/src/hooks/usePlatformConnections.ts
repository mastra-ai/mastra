import type { PlatformConnectActions } from '@mastra/playground-ui/domains/factory';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

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
async function invalidateProviderState(queryClient: QueryClient, provider: PlatformConnectProviderId) {
  const gitlab = provider === 'gitlab' || provider === 'gitlab-self-hosted';
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
    ...(provider === 'linear'
      ? [
          queryClient.invalidateQueries({ queryKey: queryKeys.linearStatus() }),
          queryClient.invalidateQueries({ queryKey: queryKeys.linearProjects() }),
          queryClient.invalidateQueries({ queryKey: queryKeys.linearTeams() }),
          queryClient.invalidateQueries({ queryKey: ['linear', 'issue'] }),
        ]
      : []),
    ...(gitlab
      ? [
          // GitLab lists self-hosted connections too, so either flow changes both listings.
          queryClient.invalidateQueries({ queryKey: queryKeys.platformConnections('gitlab') }),
          queryClient.invalidateQueries({ queryKey: queryKeys.platformConnections('gitlab-self-hosted') }),
          queryClient.invalidateQueries({ queryKey: ['gitlab', 'status'] }),
          queryClient.invalidateQueries({ queryKey: ['gitlab', 'projects'] }),
        ]
      : []),
  ]);
}

/**
 * How Factory connects provider accounts, for the shared Platform connect
 * buttons. Connect mints a session server-side, runs the headless Nango auth
 * (OAuth popup, or direct API-key submission when `credentials` are passed),
 * then waits for the connection to activate. Reconnect reauthorizes an
 * existing connection through the same flow.
 */
export function usePlatformConnectActions(): PlatformConnectActions {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      connect: async (provider, input) => {
        try {
          const session = await createPlatformConnectSession(baseUrl, provider);
          await runHeadlessAuth({
            session,
            ...(input.credentials ? { credentials: input.credentials } : {}),
            ...(input.params ? { params: input.params } : {}),
          });
          return await waitForActiveConnection(baseUrl, provider, session.connectionId);
        } finally {
          await invalidateProviderState(queryClient, provider);
        }
      },
      reconnect: async (provider, input) => {
        try {
          const session = await createPlatformReconnectSession(baseUrl, provider, input.connectionId);
          // A reconnect renews the credential only: connection settings come from
          // the server, so the connection cannot be moved to another instance.
          await runHeadlessAuth({
            session,
            ...(input.credentials ? { credentials: input.credentials } : {}),
            ...(session.params ? { params: session.params } : {}),
          });
          return await waitForActiveConnection(baseUrl, provider, input.connectionId);
        } finally {
          await invalidateProviderState(queryClient, provider);
        }
      },
    }),
    [baseUrl, queryClient],
  );
}

/** Connect a new provider account (see `usePlatformConnectActions`). */
export function useConnectPlatformProviderMutation(provider: PlatformConnectProviderId) {
  const actions = usePlatformConnectActions();
  return useMutation({
    mutationFn: (input: { credentials?: Record<string, string>; params?: Record<string, string> } = {}) =>
      actions.connect(provider, input),
  });
}
