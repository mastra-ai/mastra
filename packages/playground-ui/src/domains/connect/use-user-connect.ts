import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type {
  UserConnectErrorBody,
  UserConnectProvidersResponse,
  UserConnectSessionResponse,
  UserConnectionStatusResponse,
  UserConnectionsResponse,
} from './types';

/** Default mount prefix of `userConnectRoutes()` on the dev server. */
export const CONNECT_BASE_PATH = '/connect';

export class UserConnectRequestError extends Error {
  status: number;
  code: string | null;

  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.name = 'UserConnectRequestError';
    this.status = status;
    this.code = code;
  }
}

type ConnectFetch = <T>(path: string, init?: RequestInit) => Promise<T>;

/**
 * Fetches against the dev server's mounted connect routes. Custom `apiRoutes`
 * live outside the `/api` prefix, so this goes around the SDK while reusing
 * its base URL, auth headers, credentials mode, and refresh-aware fetch.
 */
function useConnectFetch(): ConnectFetch {
  const client = useMastraClient();
  const { baseUrl, headers, credentials, fetch: customFetch } = client.options;

  return useCallback<ConnectFetch>(
    async (path, init) => {
      const fetchFn = customFetch ?? fetch;
      const response = await fetchFn(`${baseUrl}${CONNECT_BASE_PATH}${path}`, {
        ...init,
        headers: { ...headers, ...init?.headers },
        credentials,
      });
      if (!response.ok) {
        let code: string | null = null;
        let message = `Request failed with status ${response.status}`;
        try {
          const body = (await response.json()) as Partial<UserConnectErrorBody>;
          if (body?.error) {
            code = body.error.code ?? null;
            message = body.error.message ?? message;
          }
        } catch {
          // Non-JSON error body (e.g. a plain 404 for unmounted routes).
        }
        throw new UserConnectRequestError(response.status, code, message);
      }
      if (response.status === 204) return undefined as never;
      return (await response.json()) as never;
    },
    [baseUrl, headers, credentials, customFetch],
  );
}

/**
 * Resolves a server-relative launch-gate path (returned by the session route
 * as `launchUrl`) against the SDK's base URL for top-level popup navigation.
 * The launch route is authenticated by the browser's session cookie — the
 * server re-verifies that this browser owns the pending session before
 * redirecting into the vendor OAuth flow.
 */
export function useConnectLaunchHref(): (launchUrl: string) => string {
  const client = useMastraClient();
  const { baseUrl } = client.options;
  return useCallback((launchUrl: string) => (baseUrl ? `${baseUrl}${launchUrl}` : launchUrl), [baseUrl]);
}

export type ConnectSurface =
  | { status: 'ready'; providers: UserConnectProvidersResponse['providers'] }
  | { status: 'not-mounted' }
  | { status: 'unauthenticated' };

/**
 * Capability detection for the end-user connect surface: probes
 * `GET /connect/providers` and distinguishes a working surface from the two
 * setup gaps (routes not mounted → 404, no end-user identity → 401).
 */
export function useConnectSurface() {
  const connectFetch = useConnectFetch();

  return useQuery<ConnectSurface, UserConnectRequestError>({
    queryKey: ['user-connect', 'surface'],
    retry: false,
    queryFn: async () => {
      try {
        const body = await connectFetch<UserConnectProvidersResponse>('/providers');
        return { status: 'ready', providers: body.providers };
      } catch (error) {
        if (error instanceof UserConnectRequestError) {
          if (error.status === 404) return { status: 'not-mounted' };
          if (error.status === 401) return { status: 'unauthenticated' };
        }
        throw error;
      }
    },
  });
}

const connectionsQueryKey = ['user-connect', 'connections'] as const;

/** Lists the caller's visible connections (global + their own). */
export function useUserConnections({ enabled }: { enabled: boolean }) {
  const connectFetch = useConnectFetch();

  return useQuery<UserConnectionsResponse['connections'], UserConnectRequestError>({
    queryKey: connectionsQueryKey,
    enabled,
    retry: false,
    queryFn: async () => {
      const body = await connectFetch<UserConnectionsResponse>('/connections');
      return body.connections;
    },
  });
}

/** Creates a connect session for a provider; the caller drives the popup. */
export function useCreateConnectSession() {
  const connectFetch = useConnectFetch();

  return useMutation<UserConnectSessionResponse, UserConnectRequestError, { provider: string }>({
    mutationFn: ({ provider }) =>
      connectFetch<UserConnectSessionResponse>(`/${encodeURIComponent(provider)}/sessions`, { method: 'POST' }),
  });
}

/** 2s interval with a 5 minute cap, mirroring the hosted connect page. */
const STATUS_POLL_INTERVAL_MS = 2_000;
const STATUS_MAX_POLLS = 150;

/**
 * Polls a pending connection until it leaves `pending`. A 404 counts as still
 * pending — the platform row may not be visible until the provider handshake
 * lands. Polling stops once the status settles (or after the 5 minute cap);
 * the connections list is refreshed when it does.
 */
export function useConnectionStatus({ connectionId }: { connectionId: string | null }) {
  const connectFetch = useConnectFetch();
  const queryClient = useQueryClient();

  return useQuery<UserConnectionStatusResponse, UserConnectRequestError>({
    queryKey: ['user-connect', 'connection-status', connectionId],
    enabled: connectionId !== null,
    retry: false,
    refetchInterval: query => {
      const status = query.state.data?.status;
      if (status !== undefined && status !== 'pending') return false;
      if (query.state.dataUpdateCount >= STATUS_MAX_POLLS) return false;
      return STATUS_POLL_INTERVAL_MS;
    },
    queryFn: async () => {
      let status: UserConnectionStatusResponse;
      try {
        status = await connectFetch<UserConnectionStatusResponse>(
          `/connections/${encodeURIComponent(connectionId ?? '')}/status`,
        );
      } catch (error) {
        if (error instanceof UserConnectRequestError && error.status === 404) {
          return { id: connectionId ?? '', status: 'pending', scope: 'user' };
        }
        throw error;
      }
      if (status.status !== 'pending') {
        void queryClient.invalidateQueries({ queryKey: connectionsQueryKey });
      }
      return status;
    },
  });
}

/** Disconnects one of the caller's own connections. */
export function useDisconnectUserConnection() {
  const connectFetch = useConnectFetch();
  const queryClient = useQueryClient();

  return useMutation<void, UserConnectRequestError, { connectionId: string }>({
    mutationFn: ({ connectionId }) =>
      connectFetch<void>(`/connections/${encodeURIComponent(connectionId)}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: connectionsQueryKey }),
  });
}
