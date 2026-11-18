import { useMastraClient } from '@mastra/react';
import { useQuerySpans } from '@mastra/react/hooks/traces';
import type { SpanQueryArgs, SpanRow } from '@mastra/react/hooks/traces';
import { useMemo } from 'react';
import { useListAnchor, useListHeadPoll, windowEndingAt } from '@/domains/observability/hooks/use-list-head-poll';
import { observabilityListQueryOptions } from '@/domains/observability/hooks/use-observability-list-filters';
import { OBSERVABILITY_LIST_HEAD_LIMIT } from '@/domains/observability/list-polling';
import { mergeHeadRows } from '@/domains/observability/merge-head-rows';

export type UseSpansListSourceArgs = {
  query: SpanQueryArgs;
  /** The window ends at "now" (a preset rather than a custom range): only then can new spans show up. */
  rolling: boolean;
  /** The user picked the start (a custom range with no end): polls and reloads keep it rather than sliding it. */
  fixedStart?: boolean;
  /** Polls for spans that ended since the list loaded. Defaults to true. */
  autoRefetch?: boolean;
  limit?: number;
  enabled?: boolean;
};

export const spanRowId = (span: SpanRow) => `${span.traceId}:${span.spanId}`;

/** The list's own order: the requested field, then trace and span ids ascending, like the server's keyset. */
function compareSpans(orderBy: SpanQueryArgs['orderBy']) {
  const { field = 'startedAt', direction = 'desc' } = orderBy?.[0] ?? {};
  const sign = direction === 'asc' ? 1 : -1;
  return (a: SpanRow, b: SpanRow) => {
    const left = a[field as keyof SpanRow];
    const right = b[field as keyof SpanRow];
    if (left !== right) {
      // Empty values sort last in both directions.
      if (left === null || left === undefined) return 1;
      if (right === null || right === undefined) return -1;
      if (left < right) return -sign;
      if (left > right) return sign;
    }
    return a.traceId.localeCompare(b.traceId) || a.spanId.localeCompare(b.spanId);
  };
}

/**
 * The spans list, kept live: the infinite query loads pages as the user scrolls, and while the window
 * is rolling a head poll brings the spans that ended since then into the rendered rows.
 */
export function useSpansListSource({
  query,
  rolling,
  fixedStart = false,
  autoRefetch = true,
  limit,
  enabled = true,
}: UseSpansListSourceArgs) {
  const client = useMastraClient();
  const { anchorWindow, reanchor } = useListAnchor(query, fixedStart);

  const listQuery = useMemo<SpanQueryArgs>(
    () => (anchorWindow ? { ...query, timeRange: { ...query.timeRange, ...anchorWindow } } : query),
    [query, anchorWindow],
  );
  const list = useQuerySpans({ query: listQuery, limit, enabled, queryOptions: observabilityListQueryOptions });

  const { headRows } = useListHeadPoll<SpanRow>({
    queryKey: ['spans', query],
    fetchHead: async to => {
      // The server filters spans on startedAt in [from, to), whatever their endedAt, so a long-running
      // span is caught once it ends if it started inside the polled window. A preset window slides with
      // each poll, so a span that ran longer than the whole window is missed: the price of staying under
      // the server's cap on the window length.
      const result = await client.querySpans({
        ...query,
        timeRange: { ...query.timeRange, ...windowEndingAt(query.timeRange, to, fixedStart) },
        orderBy: [{ field: 'endedAt', direction: 'desc' }],
        page: { limit: OBSERVABILITY_LIST_HEAD_LIMIT },
      });
      return result.spans;
    },
    getId: spanRowId,
    getEndedAt: span => span.endedAt,
    since: Date.parse(listQuery.timeRange.to),
    enabled: enabled && rolling && autoRefetch && list.spans !== undefined && !list.isFetching && !list.isError,
    onOverflow: () => reanchor(query.timeRange),
  });

  const { orderBy } = query;
  const listSpans = list.spans;
  const spans = useMemo(
    () =>
      listSpans &&
      mergeHeadRows(listSpans, headRows, {
        getId: spanRowId,
        compare: compareSpans(orderBy),
        hasNextPage: list.hasNextPage,
      }),
    [listSpans, headRows, orderBy, list.hasNextPage],
  );

  return { ...list, spans };
}
