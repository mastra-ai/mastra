import type { QuerySpansResult } from '@mastra/client-js';
import {
  useListAnchor,
  useListHeadPoll,
  windowEndingAt,
} from '@mastra/playground-ui/domains/observability/hooks/use-list-head-poll';
import { OBSERVABILITY_LIST_HEAD_LIMIT } from '@mastra/playground-ui/domains/observability/list-polling';
import { mergeHeadRows } from '@mastra/playground-ui/domains/observability/merge-head-rows';
import { compareSpans, spanRowId } from '@mastra/playground-ui/domains/spans/hooks/use-spans-list-source';
import type { SpansExplorerSpans } from '@mastra/playground-ui/domains/spans/spans-explorer-data';
import { SPAN_QUERY_PER_PAGE } from '@mastra/react/hooks/traces';
import type { SpanQueryArgs, SpanRow } from '@mastra/react/hooks/traces';
import type { App } from '@modelcontextprotocol/ext-apps';
import { useCallback, useMemo, useRef } from 'react';
import { callTool } from '../../../shared/mcp-app';
import { toolRequest } from './tool-request';
import { useMcpQueryRows } from './use-mcp-query-rows';

const NO_SPANS: SpanRow[] = [];

export type UseMcpSpansListArgs = {
  app: App;
  query: SpanQueryArgs;
  /** The window ends at "now" (a preset rather than a custom range): only then can new spans show up. */
  rolling: boolean;
  /** The user picked the start (a custom range with no end): polls and reloads keep it rather than sliding it. */
  fixedStart: boolean;
  enabled: boolean;
};

/**
 * The spans list through `query_spans`, kept live like Studio's: pages load as the list scrolls, and while the
 * window is rolling a head poll brings the spans that ended since then into the rendered rows.
 */
export function useMcpSpansList({ app, query, rolling, fixedStart, enabled }: UseMcpSpansListArgs): SpansExplorerSpans {
  const { anchorWindow, reanchor } = useListAnchor(query, fixedStart);
  const listQuery = useMemo<SpanQueryArgs>(
    () => (anchorWindow ? { ...query, timeRange: { ...query.timeRange, ...anchorWindow } } : query),
    [query, anchorWindow],
  );
  const list = useMcpQueryRows<'spans', SpanRow>('spans', {
    app,
    tool: 'query_spans',
    query: listQuery,
    limit: SPAN_QUERY_PER_PAGE,
    enabled,
  });

  const { headRows } = useListHeadPoll<SpanRow>({
    queryKey: ['mcp-spans', query],
    fetchHead: async to => {
      // As in Studio: the server filters spans on startedAt, so a preset window slides with each poll.
      const result = await toolRequest<QuerySpansResult>(
        callTool(app, 'query_spans', {
          ...query,
          timeRange: { ...query.timeRange, ...windowEndingAt(query.timeRange, to, fixedStart) },
          orderBy: [{ field: 'endedAt', direction: 'desc' }],
          page: { limit: OBSERVABILITY_LIST_HEAD_LIMIT },
        }),
      );
      return result.spans;
    },
    getId: spanRowId,
    getEndedAt: span => span.endedAt,
    since: Date.parse(listQuery.timeRange.to),
    enabled: enabled && rolling && list.data !== undefined && !list.isFetching && !list.isError,
    onOverflow: () => reanchor(query.timeRange),
  });

  const { orderBy } = query;
  const listSpans = list.data;
  const spans = useMemo(
    () =>
      listSpans
        ? mergeHeadRows(listSpans, headRows, {
            getId: spanRowId,
            compare: compareSpans(orderBy),
            hasNextPage: list.hasNextPage,
          })
        : NO_SPANS,
    [listSpans, headRows, orderBy, list.hasNextPage],
  );

  // The list hands back a new `fetchNextPage` every render; keep `onLoadMore` stable for the list's effect.
  const fetchNextPage = useRef(list.fetchNextPage);
  fetchNextPage.current = list.fetchNextPage;
  const onLoadMore = useCallback(() => void fetchNextPage.current(), []);

  return {
    spans,
    isLoading: list.isLoading,
    isFetchingNextPage: list.isFetchingNextPage,
    hasNextPage: list.hasNextPage,
    isError: list.isError,
    error: list.error ?? undefined,
    onLoadMore,
  };
}
