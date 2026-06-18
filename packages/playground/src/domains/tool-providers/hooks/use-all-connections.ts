import { useMastraClient } from '@mastra/react';
import { useQueries } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { useToolProviders } from './use-tool-providers';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';

/**
 * Stale time long enough to avoid refetching on every picker re-render but
 * short enough that an OAuth completion in a sibling tab is reflected
 * promptly (React Query also re-fetches on window focus by default).
 */
const STALE_TIME_MS = 30_000;

export interface UseAllConnectionsOptions {
  /**
   * When `true`, the hook forces the server-side `authorId` filter to the
   * caller's own userId. Builder edit view passes `scopeToSelf: true` so
   * admins see only their own connections, never other authors' rows.
   *
   * Non-admin callers see the same result either way — the server already
   * scopes to the caller's bucket — but the explicit filter keeps caches
   * consistent and prevents admin cross-author leakage.
   */
  scopeToSelf?: boolean;
}

/**
 * Fans out across every registered ToolProvider and every toolkit it
 * exposes to determine whether the caller has an existing connection for a
 * given `(providerId, toolkit)` pair.
 *
 * Used by the Builder tool picker to gate integration tool rows: if the
 * pair has no connection, the card cannot be selected and surfaces an
 * inline "Connect" button instead.
 *
 * Distinct from `useExistingConnections` (per-pair, used by `/integrations`)
 * to keep their query caches independent.
 */
export const useAllConnections = (options?: UseAllConnectionsOptions) => {
  const client = useMastraClient();
  const providersQuery = useToolProviders();
  const providers = useMemo(() => providersQuery.data?.providers ?? [], [providersQuery.data?.providers]);

  const scopeToSelf = options?.scopeToSelf ?? false;
  const currentUserQuery = useCurrentUser();
  const callerAuthorId = currentUserQuery.data?.id;
  // When self-scoping, wait until the current-user query has settled rather
  // than requiring an id. If auth is disabled the query settles with no user;
  // we then omit the `authorId` filter and let the server scope by request
  // context, so the picker still gates correctly instead of stalling.
  const callerReady = !scopeToSelf || !currentUserQuery.isPending;

  // 1. For every provider, list its toolkits.
  const toolkitsQueries = useQueries({
    queries: providers.map(provider => ({
      queryKey: ['tool-integration-services', provider.id],
      queryFn: () => client.getToolProvider(provider.id).listToolkits(),
    })),
  });

  // 2. Flatten to (providerId, toolkit) pairs.
  const pairs = useMemo(() => {
    const out: Array<{ providerId: string; toolkit: string }> = [];
    providers.forEach((provider, idx) => {
      const toolkits = toolkitsQueries[idx]?.data?.data ?? [];
      for (const toolkit of toolkits) {
        out.push({ providerId: provider.id, toolkit: toolkit.slug });
      }
    });
    return out;
  }, [providers, toolkitsQueries]);

  // 3. One listConnections call per pair. Include `authorId` in queryKey when
  // self-scoped so the cache is distinct from any unscoped admin reads.
  const connectionsQueries = useQueries({
    queries: pairs.map(pair => ({
      queryKey: scopeToSelf
        ? ['tool-integration-connections-all', pair.providerId, pair.toolkit, callerAuthorId]
        : ['tool-integration-connections-all', pair.providerId, pair.toolkit],
      queryFn: () =>
        client.getToolProvider(pair.providerId).listConnections({
          toolkit: pair.toolkit,
          ...(scopeToSelf && callerAuthorId ? { authorId: callerAuthorId } : {}),
        }),
      enabled: callerReady,
      staleTime: STALE_TIME_MS,
    })),
  });

  const isLoading =
    providersQuery.isLoading ||
    (scopeToSelf && currentUserQuery.isLoading) ||
    toolkitsQueries.some(q => q.isLoading) ||
    connectionsQueries.some(q => q.isLoading);

  // Build a per-pair list of connection summaries so callers can both gate
  // ("does this row have any connection?") and auto-pin ("if exactly one
  // exists, write it into the form on toggle-on").
  const connectionsByKey = useMemo(() => {
    const map = new Map<string, Array<{ connectionId: string; label?: string | null; status?: string }>>();
    pairs.forEach((pair, idx) => {
      const items = connectionsQueries[idx]?.data?.items ?? [];
      map.set(`${pair.providerId}:${pair.toolkit}`, items);
    });
    return map;
  }, [pairs, connectionsQueries]);

  // A toolkit "has a connection" only when at least one connection is active.
  // Pending/failed rows don't count — this keeps the card hint in sync with the
  // toolkit row control, which also treats only active connections as usable.
  const hasConnection = useCallback(
    (providerId: string, toolkit: string) =>
      (connectionsByKey.get(`${providerId}:${toolkit}`) ?? []).some(connection => connection.status === 'active'),
    [connectionsByKey],
  );

  const getConnections = useCallback(
    (providerId: string, toolkit: string) => connectionsByKey.get(`${providerId}:${toolkit}`) ?? [],
    [connectionsByKey],
  );

  return { hasConnection, getConnections, isLoading };
};
