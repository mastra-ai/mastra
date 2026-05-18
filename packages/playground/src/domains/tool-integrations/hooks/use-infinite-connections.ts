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
}

/**
 * Paginated lister for existing provider connections, scoped to a tool
 * service. Wraps `client.tool-integration.listConnections` with
 * `useInfiniteQuery` so the picker can render a "Load more" affordance once
 * the result set exceeds a single page.
 *
 * The connection owner is normally resolved server-side. Admin callers
 * may pass `authorId` to target a single author, or leave it unset to scan
 * every author known to `tool_connections` for this provider/service.
 */
export const useInfiniteConnections = (
  integrationId: string | null | undefined,
  toolService: string | null | undefined,
  opts: UseInfiniteConnectionsOpts = {},
) => {
  const client = useMastraClient();
  const { authorId, limit, enabled = true } = opts;

  return useInfiniteQuery({
    queryKey: ['tool-integration-connections', integrationId, toolService, { authorId, limit }],
    enabled: enabled && !!integrationId && !!toolService,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      client.getToolIntegration(integrationId!).listConnections({
        toolService: toolService!,
        ...(authorId !== undefined ? { authorId } : {}),
        ...(limit !== undefined ? { limit } : {}),
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: lastPage => (lastPage as { nextCursor?: string }).nextCursor ?? undefined,
  });
};
