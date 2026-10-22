import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  HeadlessAuthError,
  headlessAuthFields,
  headlessAuthRequiresForm,
  splitHeadlessAuthValues,
  startHeadlessAuth,
  supportsHeadlessAuth,
} from './headless-connect';
import type { HeadlessAuthHandle } from './headless-connect';
import type {
  UserConnectErrorBody,
  UserConnectLaunchTokenResponse,
  UserConnectProvider,
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

/**
 * Redeems the launch gate for a headless session token (`Accept:
 * application/json`) instead of following its hosted 302. The gate runs the
 * same ownership assertion in both modes; a `null` token means the server
 * could not extract one and the caller falls back to the hosted popup.
 */
function useRedeemLaunchToken(): (launchUrl: string) => Promise<UserConnectLaunchTokenResponse> {
  const client = useMastraClient();
  const { baseUrl, headers, credentials, fetch: customFetch } = client.options;

  return useCallback(
    async launchUrl => {
      const fetchFn = customFetch ?? fetch;
      // `launchUrl` is the full server-relative gate path (it already carries
      // the connect mount prefix), so it resolves against the bare base URL.
      const response = await fetchFn(`${baseUrl ?? ''}${launchUrl}`, {
        headers: { ...headers, accept: 'application/json' },
        credentials,
      });
      if (!response.ok) {
        throw new UserConnectRequestError(response.status, null, `Request failed with status ${response.status}`);
      }
      return (await response.json()) as UserConnectLaunchTokenResponse;
    },
    [baseUrl, headers, credentials, customFetch],
  );
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

export interface PendingConnect {
  provider: string;
  connectionId: string;
  /**
   * `headless` — the Nango SDK drives the provider's own consent popup (or no
   * popup at all for collected credentials). `hosted` — a popup navigated
   * through the launch gate's 302 into the hosted connect page.
   */
  mode: 'headless' | 'hosted';
  /** Shown when the popup was blocked so the user can finish the flow manually. */
  fallbackUrl: string | null;
}

/**
 * What a caller passes to `connect()`: the provider's id plus the auth shape
 * when known. Callers that only know the id (older payloads) always get the
 * hosted flow.
 */
export type ConnectTarget = Pick<UserConnectProvider, 'id'> &
  Partial<Pick<UserConnectProvider, 'authType' | 'authFields'>>;

/**
 * Grace period after the vendor popup closes before an unsettled flow is
 * abandoned — the activation webhook often lands a few seconds after the
 * vendor window closes itself.
 */
const POPUP_CLOSE_GRACE_MS = 15_000;
/** Wall-clock cap matching the status poll's 5 minute budget. */
const PENDING_TIMEOUT_MS = STATUS_POLL_INTERVAL_MS * STATUS_MAX_POLLS;

export interface UsePendingConnectOptions {
  /** Overrides for the abandonment timings (primarily for tests). */
  popupCloseGraceMs?: number;
  pendingTimeoutMs?: number;
}

/**
 * Outcome of the most recently settled flow: `active` when the connection
 * activated, `failed` for everything else (non-active settle, poll failure,
 * abandoned popup, poll budget). Cleared when a new flow starts.
 */
export interface SettledConnect {
  provider: string;
  status: 'active' | 'failed';
  /** Human-readable failure detail (blocked popup, closed window, rejected credentials). */
  message?: string;
}

/** Window features for the hosted connect popup. */
const POPUP_FEATURES = 'popup,width=600,height=720';

/**
 * Drives one add-connection flow end to end. Providers whose auth the browser
 * can complete headlessly go through the launch gate's JSON redemption: the
 * released session token keys the Nango SDK, which opens the provider's own
 * consent popup (or submits collected credentials with no popup). Everything
 * else gets the hosted flow — a popup opened synchronously in the click
 * gesture (so popup blockers allow it) and navigated through the launch
 * gate's 302. Either way the connection status is polled until it settles.
 * The pending state always resolves — on settle, on a poll or auth failure,
 * when the popup closes without settling (after a grace period), or at the
 * poll budget — so the Connect action is never stuck disabled.
 */
export function usePendingConnect(options: UsePendingConnectOptions = {}) {
  const { popupCloseGraceMs = POPUP_CLOSE_GRACE_MS, pendingTimeoutMs = PENDING_TIMEOUT_MS } = options;
  const session = useCreateConnectSession();
  const resolveLaunchHref = useConnectLaunchHref();
  const redeemLaunchToken = useRedeemLaunchToken();
  const [pending, setPending] = useState<PendingConnect | null>(null);
  const [settled, setSettled] = useState<SettledConnect | null>(null);
  const [connectedProviders, setConnectedProviders] = useState<ReadonlySet<string>>(new Set());
  const popupRef = useRef<Pick<Window, 'closed'> | null>(null);
  const headlessRef = useRef<HeadlessAuthHandle | null>(null);
  // Mirrors `pending` for async guards (the SDK promise settles outside the
  // render cycle); written directly at every transition so a cancel is never
  // raced by a trailing rejection.
  const pendingRef = useRef<PendingConnect | null>(null);
  const status = useConnectionStatus({ connectionId: pending?.connectionId ?? null });

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  // Close the provider popup if the surface unmounts mid-flow.
  useEffect(
    () => () => {
      headlessRef.current?.close();
      headlessRef.current = null;
    },
    [],
  );

  // Settle only on a status response for the connection currently pending —
  // a stale result from a previous flow must not clear or mark a newer one.
  const statusData = status.data;
  useEffect(() => {
    if (!pending || statusData === undefined) return;
    if (statusData.id !== pending.connectionId || statusData.status === 'pending') return;
    const { provider } = pending;
    if (statusData.status === 'active') {
      setConnectedProviders(previous => (previous.has(provider) ? previous : new Set([...previous, provider])));
    }
    // The provider window closes itself on active settles; drop the handle so
    // a trailing SDK rejection cannot re-settle this flow.
    headlessRef.current = null;
    pendingRef.current = null;
    setSettled({ provider, status: statusData.status === 'active' ? 'active' : 'failed' });
    setPending(null);
  }, [pending, statusData]);

  // A failed poll hands the Connect action back instead of leaving it stuck.
  useEffect(() => {
    if (!status.isError || !pending) return;
    // The ref is cleared before close() so the rejection it triggers no-ops.
    pendingRef.current = null;
    headlessRef.current?.close();
    headlessRef.current = null;
    setSettled({ provider: pending.provider, status: 'failed' });
    setPending(null);
  }, [status.isError, pending]);

  // Abandonment: the popup closed without the flow settling (grace period for
  // the trailing webhook) or the poll budget ran out.
  useEffect(() => {
    if (!pending) return;
    const startedAt = Date.now();
    let closedAt: number | null = null;
    const tickMs = Math.min(1_000, popupCloseGraceMs);
    const timer = window.setInterval(() => {
      if (popupRef.current?.closed) closedAt ??= Date.now();
      const abandoned = closedAt !== null && Date.now() - closedAt >= popupCloseGraceMs;
      const timedOut = Date.now() - startedAt >= pendingTimeoutMs;
      if (abandoned || timedOut) {
        // The ref is cleared before close() so the rejection it triggers no-ops.
        pendingRef.current = null;
        headlessRef.current?.close();
        headlessRef.current = null;
        setSettled({ provider: pending.provider, status: 'failed' });
        setPending(null);
      }
    }, tickMs);
    return () => window.clearInterval(timer);
  }, [pending, popupCloseGraceMs, pendingTimeoutMs]);

  const beginHeadless = useCallback(
    async (provider: ConnectTarget, created: UserConnectSessionResponse, values?: Record<string, string>) => {
      let sessionToken: string | null = null;
      try {
        sessionToken = (await redeemLaunchToken(created.launchUrl)).sessionToken;
      } catch {
        // Redemption failure (older platform, transient error) is not fatal —
        // the hosted flow below still works through the gate's 302.
      }
      if (!sessionToken) {
        // Opened after an await, so a blocker may stop it; the fallback link
        // in the pending state covers that.
        const launchHref = resolveLaunchHref(created.launchUrl);
        const popup = window.open(launchHref, 'mastra-connect', POPUP_FEATURES);
        popupRef.current = popup;
        const next: PendingConnect = {
          provider: provider.id,
          connectionId: created.connectionId,
          mode: 'hosted',
          fallbackUrl: popup ? null : launchHref,
        };
        pendingRef.current = next;
        setPending(next);
        return;
      }

      const split = values ? splitHeadlessAuthValues(headlessAuthFields(provider), values) : {};
      const handle = startHeadlessAuth({
        sessionToken,
        integrationId: created.integrationId,
        authType: provider.authType,
        credentials: split.credentials,
        params: split.params,
      });
      headlessRef.current = handle;
      const next: PendingConnect = {
        provider: provider.id,
        connectionId: created.connectionId,
        mode: 'headless',
        fallbackUrl: null,
      };
      pendingRef.current = next;
      setPending(next);
      // Success needs no action here — the activation webhook lands on the
      // platform and the status poll settles the flow. Failures settle it now.
      handle.result.catch((error: unknown) => {
        if (pendingRef.current?.connectionId !== created.connectionId) return;
        headlessRef.current = null;
        pendingRef.current = null;
        const message = error instanceof HeadlessAuthError ? error.message : 'Could not authorize this connection.';
        setSettled({ provider: provider.id, status: 'failed', message });
        setPending(null);
      });
    },
    [redeemLaunchToken, resolveLaunchHref],
  );

  const connect = useCallback(
    (provider: ConnectTarget, values?: Record<string, string>) => {
      setSettled(null);
      headlessRef.current?.close();
      headlessRef.current = null;

      // Headless needs both the capability and the inputs: a caller without a
      // form (no `values`) can only run flows whose fields are all optional —
      // anything else falls back to the hosted page, which renders the form.
      const headless =
        supportsHeadlessAuth(provider.authType, provider.authFields) &&
        (values !== undefined || !headlessAuthRequiresForm(provider));
      // Hosted flows open the popup synchronously in the click gesture so
      // popup blockers allow it; headless flows never navigate to a hosted
      // page, so no window opens here.
      const popup = headless ? null : window.open('', 'mastra-connect', POPUP_FEATURES);
      popupRef.current = popup;
      session.mutate(
        { provider: provider.id },
        {
          onSuccess: created => {
            if (headless) {
              void beginHeadless(provider, created, values);
              return;
            }
            // The popup enters OAuth through the server's launch gate, which
            // verifies this browser owns the pending session before
            // redirecting — the raw vendor URL never reaches the page.
            const launchHref = resolveLaunchHref(created.launchUrl);
            if (popup) {
              popup.location.href = launchHref;
            }
            const next: PendingConnect = {
              provider: provider.id,
              connectionId: created.connectionId,
              mode: 'hosted',
              fallbackUrl: popup ? null : launchHref,
            };
            pendingRef.current = next;
            setPending(next);
          },
          onError: () => {
            popup?.close();
            popupRef.current = null;
          },
        },
      );
    },
    [session, resolveLaunchHref, beginHeadless],
  );

  /** Abandons the in-flight flow: closes the provider window, hands the Connect action back. */
  const cancel = useCallback(() => {
    headlessRef.current?.close();
    headlessRef.current = null;
    popupRef.current = null;
    pendingRef.current = null;
    setPending(null);
    setSettled(null);
  }, []);

  return {
    pending,
    connect,
    cancel,
    /** Outcome of the most recently settled flow; null while none settled or a flow is in progress. */
    settled,
    /** Providers whose connection settled `active` during this hook's lifetime. */
    connectedProviders,
    isCreating: session.isPending,
    createError: session.isError ? session.error : null,
  };
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
