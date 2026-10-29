import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import { useInfiniteQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { TERMINAL_PAGE_SIZE, listTerminalWorkItems } from '../ui/domains/factory/services/workItems';
import type { TerminalWorkItemsPage, WorkItem } from '../ui/domains/factory/services/workItems';

/**
 * The done or canceled cards of one board phase, a page at a time. The board
 * snapshot leaves these out, so a terminal column reads them on its own when it
 * opens. Not polled: the key sits under the board's, so the invalidation after a
 * transition or delete refreshes it along with the list.
 */
export function useTerminalWorkItems({
  factoryProjectId,
  board,
  stage,
  enabled = true,
}: {
  factoryProjectId: string | undefined;
  board: string;
  stage: string;
  enabled?: boolean;
}) {
  const { baseUrl } = useApiConfig();
  const query = useInfiniteQuery({
    queryKey: queryKeys.terminalWorkItems(factoryProjectId, board, stage),
    queryFn: ({ pageParam, signal }) =>
      listTerminalWorkItems(baseUrl, factoryProjectId!, { board, stage, offset: pageParam }, signal),
    initialPageParam: 0,
    getNextPageParam: (last: TerminalWorkItemsPage, pages) =>
      last.hasMore ? pages.length * TERMINAL_PAGE_SIZE : undefined,
    enabled: Boolean(factoryProjectId) && enabled,
    staleTime: 60_000,
  });
  return {
    items: query.data?.pages.flatMap(page => page.workItems) ?? [],
    total: query.data?.pages.at(-1)?.total,
    isPending: query.isPending,
    error: query.error ?? undefined,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => void query.fetchNextPage(),
  };
}

/** A card in any loaded terminal page of the project, for moves out of a done or canceled column. */
export function findLoadedTerminalWorkItem(
  queryClient: QueryClient,
  factoryProjectId: string | undefined,
  id: string,
): WorkItem | undefined {
  const pages = queryClient.getQueriesData<InfiniteData<TerminalWorkItemsPage>>({
    queryKey: [...queryKeys.workItems(factoryProjectId), 'terminal'],
  });
  for (const [, data] of pages) {
    const item = data?.pages.flatMap(page => page.workItems).find(candidate => candidate.id === id);
    if (item) return item;
  }
  return undefined;
}
