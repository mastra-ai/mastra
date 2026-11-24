import { useMastraClient } from '@mastra/react';
import { useQueryThreads } from '@mastra/react/hooks/traces';
import type { ThreadQueryArgs, ThreadRow } from '@mastra/react/hooks/traces';
import { useMemo } from 'react';
import { useListAnchor, useListHeadPoll, windowEndingAt } from '@/domains/observability/hooks/use-list-head-poll';
import { observabilityListQueryOptions } from '@/domains/observability/hooks/use-observability-list-filters';
import { OBSERVABILITY_LIST_HEAD_LIMIT } from '@/domains/observability/list-polling';
import { mergeHeadRows } from '@/domains/observability/merge-head-rows';

export type UseThreadsListSourceArgs = {
  query: ThreadQueryArgs;
  /** The window ends at "now" (a preset rather than a custom range): only then can threads still change. */
  rolling: boolean;
  /** The user picked the start (a custom range with no end): polls and reloads keep it rather than sliding it. */
  fixedStart?: boolean;
  /** Polls for threads that started or got a new trace since the list loaded. Defaults to true. */
  autoRefetch?: boolean;
  limit?: number;
  enabled?: boolean;
};

export const threadRowId = (thread: ThreadRow) => thread.threadId;

type ThreadTimeRange = ThreadQueryArgs['timeRange'];

const windowOf = (timeRange: ThreadTimeRange) => ('traces' in timeRange ? timeRange.traces : timeRange.threads);

/** The same selector (trace or thread activity) with the window replaced. */
function withWindow(timeRange: ThreadTimeRange, window: { from: string; to: string }): ThreadTimeRange {
  return 'traces' in timeRange
    ? { traces: { ...timeRange.traces, ...window } }
    : { threads: { ...timeRange.threads, ...window } };
}

/** The list's own order: the requested field, then thread id ascending, like the server's keyset. */
function compareThreads(orderBy: ThreadQueryArgs['orderBy']) {
  const { field = 'endedAt', direction = 'desc' } = orderBy?.[0] ?? {};
  const sign = direction === 'asc' ? 1 : -1;
  return (a: ThreadRow, b: ThreadRow) => {
    const left = a[field];
    const right = b[field];
    if (left !== right) {
      // Empty values sort last in both directions.
      if (left === null || left === undefined) return 1;
      if (right === null || right === undefined) return -1;
      if (left < right) return -sign;
      if (left > right) return sign;
    }
    return a.threadId.localeCompare(b.threadId);
  };
}

/**
 * The threads list, kept live: the infinite query loads pages as the user scrolls, and while the window
 * is rolling a head poll brings in new threads and threads that got a new trace since then.
 */
export function useThreadsListSource({
  query,
  rolling,
  fixedStart = false,
  autoRefetch = true,
  limit,
  enabled = true,
}: UseThreadsListSourceArgs) {
  const client = useMastraClient();
  const { anchorWindow, reanchor } = useListAnchor(query, fixedStart);

  const listQuery = useMemo<ThreadQueryArgs>(
    () => (anchorWindow ? { ...query, timeRange: withWindow(query.timeRange, anchorWindow) } : query),
    [query, anchorWindow],
  );
  const list = useQueryThreads({ query: listQuery, limit, enabled, queryOptions: observabilityListQueryOptions });

  const { headRows } = useListHeadPoll<ThreadRow>({
    queryKey: ['threads', query],
    fetchHead: async to => {
      const result = await client.queryTraceThreads({
        ...query,
        timeRange: withWindow(query.timeRange, windowEndingAt(windowOf(query.timeRange), to, fixedStart)),
        orderBy: [{ field: 'endedAt', direction: 'desc' }],
        page: { limit: OBSERVABILITY_LIST_HEAD_LIMIT },
      });
      return result.threads;
    },
    getId: threadRowId,
    getEndedAt: thread => thread.endedAt,
    since: Date.parse(windowOf(listQuery.timeRange).to),
    enabled: enabled && rolling && autoRefetch && list.threads !== undefined && !list.isFetching && !list.isError,
    onOverflow: () => reanchor(windowOf(query.timeRange)),
  });

  const { orderBy } = query;
  const listThreads = list.threads;
  const threads = useMemo(
    () =>
      listThreads &&
      mergeHeadRows(listThreads, headRows, {
        getId: threadRowId,
        compare: compareThreads(orderBy),
        hasNextPage: list.hasNextPage,
      }),
    [listThreads, headRows, orderBy, list.hasNextPage],
  );

  return { ...list, threads };
}
