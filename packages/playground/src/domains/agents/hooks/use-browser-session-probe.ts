import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export interface BrowserSessionProbe {
  hasSession: boolean;
  screencastAvailable: boolean;
}

interface UseBrowserSessionProbeOptions {
  agentId?: string;
  threadId?: string;
  /**
   * Whether to actually issue the probe. Pass `false` for agents that aren't
   * configured with browser tools to avoid an unnecessary request.
   */
  enabled?: boolean;
  /** Poll interval in ms while the probe is active. Defaults to 5_000. */
  refetchInterval?: number;
}

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
 */
export function useBrowserSessionProbe({
  agentId,
  threadId,
  enabled = true,
  refetchInterval = 5_000,
}: UseBrowserSessionProbeOptions) {
  const client = useMastraClient();

  return useQuery<BrowserSessionProbe>({
    queryKey: ['browser-session-probe', agentId, threadId],
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
    enabled: enabled && Boolean(agentId),
    refetchInterval,
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: 1,
  });
}
