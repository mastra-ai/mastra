import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

export interface BrowserSessionProbe {
  hasSession: boolean;
  screencastAvailable: boolean;
}

interface UseBrowserSessionProbeOptions<TData> {
  agentId?: string;
  threadId?: string;
  /** TanStack overrides spread last, e.g. `{ enabled: false }` for agents without browser tools. */
  queryOptions?: MastraQueryOptions<BrowserSessionProbe, TData>;
}

export const browserSessionProbeQueryKey = (agentId?: string, threadId?: string) =>
  ['browser-session-probe', agentId, threadId] as const;

const LEGACY_FALLBACK: BrowserSessionProbe = { hasSession: true, screencastAvailable: true };

const isNotFoundError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  if ('status' in error && (error as { status: unknown }).status === 404) return true;
  if ('statusCode' in error && (error as { statusCode: unknown }).statusCode === 404) return true;
  return false;
};

/**
 * Query hook that probes the server for the agent's browser session state.
 *
 * Used by {@link BrowserSessionProvider} to decide whether to open a screencast
 * WebSocket. The probe avoids two failure modes:
 *
 * 1. `screencastAvailable: false` — the server doesn't have `ws` / `@hono/node-ws`
 *    installed (or the route was never registered). Opening a WS would fail and
 *    trigger a reconnect loop.
 * 2. `hasSession: false` — no active browser session for this thread yet. Opening
 *    a WS would succeed but sit idle, holding resources for no reason.
 *
 * When the endpoint itself returns 404 (older server that predates this probe),
 * the hook assumes screencast is available and a session is active so behavior
 * matches the legacy unconditional connect.
 *
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export function useBrowserSessionProbe<TData = BrowserSessionProbe>({
  agentId,
  threadId,
  queryOptions,
}: UseBrowserSessionProbeOptions<TData>): UseQueryResult<TData, Error> {
  const client = useMastraClient();

  return useQuery<BrowserSessionProbe, Error, TData>({
    queryKey: browserSessionProbeQueryKey(agentId, threadId),
    queryFn: async () => {
      if (!agentId) {
        return { hasSession: false, screencastAvailable: false };
      }

      try {
        return await client.getAgent(agentId).browserSession(threadId);
      } catch (error) {
        if (isNotFoundError(error)) {
          // Older server without the probe endpoint — fall back to legacy behavior.
          return LEGACY_FALLBACK;
        }
        throw error;
      }
    },
    // No polling: the probe fires once on mount, on window focus, and is
    // updated via `setQueriesData` from `tool-fallback.tsx` when a browser
    // tool call transitions. This avoids idle 5s polls and lets the probe
    // flip to `hasSession: true` the instant a tool call is seen.
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: 1,
    ...queryOptions,
  });
}
