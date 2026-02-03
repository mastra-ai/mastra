import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import type { SearchSmitheryServersParams } from '@mastra/client-js';

/**
 * Hook to search for MCP servers in the Smithery registry with infinite scroll support.
 *
 * @param params - Search parameters including query and pageSize
 * @returns Infinite query result containing paginated list of servers
 *
 * @example
 * ```tsx
 * const { data, fetchNextPage, hasNextPage } = useSmitheryServers({ q: 'filesystem', pageSize: 10 });
 * const servers = data?.pages.flatMap(p => p.servers) ?? [];
 * ```
 */
export const useSmitheryServers = (params?: Omit<SearchSmitheryServersParams, 'page'>) => {
  const client = useMastraClient();

  return useInfiniteQuery({
    queryKey: ['smithery-servers', params],
    queryFn: ({ pageParam = 1 }) =>
      client.searchSmitheryServers({
        ...params,
        page: pageParam,
      }),
    initialPageParam: 1,
    getNextPageParam: lastPage => {
      const { currentPage, totalPages } = lastPage.pagination;
      return currentPage < totalPages ? currentPage + 1 : undefined;
    },
  });
};

/**
 * Hook to get detailed information about a specific Smithery server.
 *
 * @param qualifiedName - The server's qualified name (e.g., "@anthropics/mcp-server-filesystem")
 * @returns Query result containing server details including connection information
 *
 * @example
 * ```tsx
 * const { data: server, isLoading } = useSmitheryServer('@anthropics/mcp-server-filesystem');
 * ```
 */
export const useSmitheryServer = (qualifiedName?: string) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['smithery-server', qualifiedName],
    queryFn: () => (qualifiedName ? client.getSmitheryServer(qualifiedName) : null),
    enabled: Boolean(qualifiedName),
  });
};
