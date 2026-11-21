import { observabilityListQueryOptions } from '@mastra/playground-ui/domains/observability/hooks/use-observability-list-filters';
import type { App } from '@modelcontextprotocol/ext-apps';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { callCursorPage } from '../../../shared/mcp-tools';
import { toolRequest } from './tool-request';

type RowsPage<Key extends string, Row> = Record<Key, Row[]> & { page: { next?: string | null } };

export type UseMcpQueryRowsArgs = {
  app: App;
  /** The cursor-paged query tool, e.g. `query_spans`. */
  tool: string;
  query: object;
  limit: number;
  enabled: boolean;
};

/**
 * A query tool's rows, paged by cursor as the list scrolls: the tool-call twin of `useQuerySpans` and
 * `useQueryThreads`, with the same key shape, placeholder and recovery refetch.
 */
export function useMcpQueryRows<Key extends string, Row>(
  rowsKey: Key,
  { app, tool, query, limit, enabled }: UseMcpQueryRowsArgs,
) {
  return useInfiniteQuery({
    queryKey: ['mcp-query-rows', tool, query, limit],
    queryFn: ({ pageParam }) =>
      toolRequest<RowsPage<Key, Row>>(
        callCursorPage(app, tool, rowsKey, { ...query, page: pageParam ? { limit, after: pageParam } : { limit } }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => lastPage.page.next ?? undefined,
    select: data => data.pages.flatMap(page => page[rowsKey]),
    retry: false,
    placeholderData: keepPreviousData,
    enabled,
    ...observabilityListQueryOptions,
  });
}
