import type { QueryTraceThreadsResult } from '@mastra/client-js';
import {
  useListAnchor,
  useListHeadPoll,
  windowEndingAt,
} from '@mastra/playground-ui/domains/observability/hooks/use-list-head-poll';
import { OBSERVABILITY_LIST_HEAD_LIMIT } from '@mastra/playground-ui/domains/observability/list-polling';
import { mergeHeadRows } from '@mastra/playground-ui/domains/observability/merge-head-rows';
import {
  compareThreads,
  threadRowId,
  windowOf,
  withWindow,
} from '@mastra/playground-ui/domains/threads/hooks/use-threads-list-source';
import type { ThreadsExplorerThreads } from '@mastra/playground-ui/domains/threads/threads-explorer-data';
import { THREAD_QUERY_PER_PAGE } from '@mastra/react/hooks/traces';
import type { ThreadQueryArgs, ThreadRow } from '@mastra/react/hooks/traces';
import type { App } from '@modelcontextprotocol/ext-apps';
import { useCallback, useMemo, useRef } from 'react';
import { callTool } from '../../../shared/mcp-app';
import { toolRequest } from './tool-request';
import { useMcpQueryRows } from './use-mcp-query-rows';

const NO_THREADS: ThreadRow[] = [];

export type UseMcpThreadsListArgs = {
  app: App;
  query: ThreadQueryArgs;
  /** The window ends at "now" (a preset rather than a custom range): only then can threads still change. */
  rolling: boolean;
  /** The user picked the start (a custom range with no end): polls and reloads keep it rather than sliding it. */
  fixedStart: boolean;
  enabled: boolean;
};

/**
 * The threads list through `query_threads`, kept live like Studio's: pages load as the list scrolls, and while
 * the window is rolling a head poll brings in new threads and threads that got a new trace since then.
 */
export function useMcpThreadsList({
  app,
  query,
  rolling,
  fixedStart,
  enabled,
}: UseMcpThreadsListArgs): ThreadsExplorerThreads {
  const { anchorWindow, reanchor } = useListAnchor(query, fixedStart);
  const listQuery = useMemo<ThreadQueryArgs>(
    () => (anchorWindow ? { ...query, timeRange: withWindow(query.timeRange, anchorWindow) } : query),
    [query, anchorWindow],
  );
  const list = useMcpQueryRows<'threads', ThreadRow>('threads', {
    app,
    tool: 'query_threads',
    query: listQuery,
    limit: THREAD_QUERY_PER_PAGE,
    enabled,
  });

  const { headRows } = useListHeadPoll<ThreadRow>({
    queryKey: ['mcp-threads', query],
    fetchHead: async to => {
      const result = await toolRequest<QueryTraceThreadsResult>(
        callTool(app, 'query_threads', {
          ...query,
          timeRange: withWindow(query.timeRange, windowEndingAt(windowOf(query.timeRange), to, fixedStart)),
          orderBy: [{ field: 'endedAt', direction: 'desc' }],
          page: { limit: OBSERVABILITY_LIST_HEAD_LIMIT },
        }),
      );
      return result.threads as ThreadRow[];
    },
    getId: threadRowId,
    getEndedAt: thread => thread.endedAt,
    since: Date.parse(windowOf(listQuery.timeRange).to),
    enabled: enabled && rolling && list.data !== undefined && !list.isFetching && !list.isError,
    onOverflow: () => reanchor(windowOf(query.timeRange)),
  });

  const { orderBy } = query;
  const listThreads = list.data;
  const threads = useMemo(
    () =>
      listThreads
        ? mergeHeadRows(listThreads, headRows, {
            getId: threadRowId,
            compare: compareThreads(orderBy),
            hasNextPage: list.hasNextPage,
          })
        : NO_THREADS,
    [listThreads, headRows, orderBy, list.hasNextPage],
  );

  // The list hands back a new `fetchNextPage` every render; keep `onLoadMore` stable for the list's effect.
  const fetchNextPage = useRef(list.fetchNextPage);
  fetchNextPage.current = list.fetchNextPage;
  const onLoadMore = useCallback(() => void fetchNextPage.current(), []);

  return {
    threads,
    isLoading: list.isLoading,
    isFetchingNextPage: list.isFetchingNextPage,
    hasNextPage: list.hasNextPage,
    isError: list.isError,
    error: list.error ?? undefined,
    onLoadMore,
  };
}
