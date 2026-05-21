import { useMastraClient } from '@mastra/react';
import { useInfiniteQuery } from '@tanstack/react-query';

export interface UseInfiniteConnectionsOpts {
  /**
   * Server-side filter. Admins may pass an explicit authorId or `undefined`
   * to see connections across all authors. Non-admins should leave this
   * unset — the server resolves the caller from the auth context.
   */
  authorId?: string;
  /** Page size hint forwarded to the server. */
  limit?: number;
  /** Disable the query entirely. */
  enabled?: boolean;
  /**
   * Server-side scope filter. When a surface locks the picker to a single
   * scope (e.g. builder → per-author, editor → caller-supplied), forward it
   * so listings don't include rows that the picker would just hide
   * client-side.
   */
  scope?: 'per-author' | 'shared' | 'caller-supplied';
}

/**
 * Paginated lister for existing provider connections, scoped to a tool
 * service. Wraps `client.tool-integration.listConnections` with
 * `useInfiniteQuery` so the picker can render a "Load more" affordance once
 * the result set exceeds a single page.
 *
 * The connection owner is normally resolved server-side. Admin callers
 * may pass `authorId` to target a single author, or leave it unset to scan
 * every author known to `tool_integration_connections` for this provider/service.
 */
export const useInfiniteConnections = (
  providerId: string | null | undefined,
  toolkit: string | null | undefined,
  opts: UseInfiniteConnectionsOpts = {},
) => {
  const client = useMastraClient();
  const { authorId, limit, enabled = true, scope } = opts;

  return useInfiniteQuery({
    queryKey: ['tool-integration-connections', providerId, toolkit, { authorId, limit, scope }],
    enabled: enabled && !!providerId && !!toolkit,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      client.getToolProvider(providerId!).listConnections({
        toolkit: toolkit!,
        ...(authorId !== undefined ? { authorId } : {}),
        ...(limit !== undefined ? { limit } : {}),
        ...(scope ? { scope } : {}),
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: lastPage => (lastPage as { nextCursor?: string }).nextCursor ?? undefined,
  });
};
