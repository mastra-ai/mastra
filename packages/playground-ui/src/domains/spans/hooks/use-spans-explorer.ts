import type { AggregateSpansArgs, AggregateSpansResponse } from '@mastra/client-js';
import type { TraceQueryScalarPredicate } from '@mastra/core/storage';
import { useSpanAggregate } from '@mastra/react/hooks/traces';
import type { SpanQueryArgs, SpanRow } from '@mastra/react/hooks/traces';
import { keepPreviousData } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';
import { buildSpanQueryWhere } from '../span-filters';
import type { SpansExplorerHistogramData, SpansExplorerSpans } from '../spans-explorer-data';
import { buildSpansListQuery, resolveSpansListView, resolveSpansSupport } from '../spans-explorer-support';
import type { SpansExplorerSupport } from '../spans-explorer-support';
import { useSpansFilterBarFields } from './use-spans-filter-bar';
import { useSpansListSource } from './use-spans-list-source';
import { useObservabilityCapabilities } from '@/domains/capabilities';
import { useObservabilityListFilters } from '@/domains/observability/hooks/use-observability-list-filters';
import type { ObservabilityListUrlState } from '@/domains/observability/hooks/use-observability-list-filters';
import {
  exceedsAggregateWindow,
  HISTOGRAM_MEASURES,
  histogramPlan,
} from '@/domains/observability/lib/histogram-buckets';
import { SPAN_LIST_SORT_FIELDS } from '@/domains/observability/observability-list-url-state';
import { useTraceColumnPreferences } from '@/domains/traces/hooks/use-trace-column-preferences';

const NO_SPANS: readonly SpanRow[] = [];
const NO_ROWS: AggregateSpansResponse['rows'] = [];

/** Studio's capabilities, read for the spans list. */
export function useSpansSupport(): SpansExplorerSupport {
  const { data, isLoading } = useObservabilityCapabilities();
  return useMemo(() => resolveSpansSupport({ data, isLoading }), [data, isLoading]);
}

export type UseSpansListQueryArgs = {
  query: SpanQueryArgs;
  /** The window ends at "now": only then can new spans show up. */
  rolling: boolean;
  /** The user picked the start: polls and reloads keep it rather than sliding it. */
  fixedStart?: boolean;
  enabled?: boolean;
};

/** Studio's spans list, through the Mastra client, polled for new spans. Pass it as the explorer's `spans`. */
export function useSpansListQuery({ query, rolling, fixedStart, enabled }: UseSpansListQueryArgs): SpansExplorerSpans {
  const list = useSpansListSource({ query, rolling, fixedStart, enabled });

  // The list hands back a new `fetchNextPage` every render; keep `onLoadMore` stable for the list's effect.
  const fetchNextPage = useRef(list.fetchNextPage);
  fetchNextPage.current = list.fetchNextPage;
  const onLoadMore = useCallback(() => fetchNextPage.current(), []);

  return {
    spans: list.spans ?? NO_SPANS,
    isLoading: list.isLoading,
    isFetchingNextPage: list.isFetchingNextPage,
    hasNextPage: list.hasNextPage,
    isError: list.isError,
    error: list.error ?? undefined,
    onLoadMore,
  };
}

export type UseSpansHistogramQueryArgs = {
  timeRange: SpanQueryArgs['timeRange'];
  where?: TraceQueryScalarPredicate;
  support: SpansExplorerSupport;
};

/**
 * Studio's span and error counts, through `aggregateSpans()` over the list's window and filters.
 * `undefined` when the store can't aggregate spans or the window is wider than it aggregates, so it never asks.
 */
export function useSpansHistogramQuery({
  timeRange,
  where,
  support,
}: UseSpansHistogramQueryArgs): SpansExplorerHistogramData | undefined {
  const request = useMemo<AggregateSpansArgs>(
    () => ({
      timeRange,
      ...(where ? { where } : {}),
      interval: histogramPlan(timeRange).interval,
      measures: [...HISTOGRAM_MEASURES],
      // No groupBy means a single group; the default limit would multiply past the server's row cap.
      limit: 1,
    }),
    [timeRange, where],
  );

  const shown = support.withAggregate && !exceedsAggregateWindow(timeRange);
  const { data, isLoading, isError, isPlaceholderData } = useSpanAggregate({
    request,
    enabled: shown,
    queryOptions: { placeholderData: keepPreviousData },
  });

  if (!shown) return undefined;
  return { timeRange, rows: data?.rows ?? NO_ROWS, isLoading, isError, isUpdating: isPlaceholderData };
}

/**
 * Everything Studio's spans explorer draws, through the Mastra client: capabilities, the URL-backed
 * filters, stored columns, the list, its histogram and the filter bar's fields. Spread the result into
 * `SpansExplorerBody`. Another host (e.g. an MCP app) builds the same props from its own data.
 */
export function useSpansExplorer(urlState?: ObservabilityListUrlState) {
  const support = useSpansSupport();
  const filters = useObservabilityListFilters(urlState, {
    sortFields: SPAN_LIST_SORT_FIELDS,
    withTokenSearch: support.withTokenSearch,
  });
  const columns = useTraceColumnPreferences({ scope: 'spans' });
  const { timeRange, tokens, groups } = filters;

  const { sort } = resolveSpansListView(filters.sort, columns.preferences, support);
  const where = useMemo(() => buildSpanQueryWhere(tokens, groups, support), [tokens, groups, support]);
  const query = useMemo(
    () => buildSpansListQuery(timeRange, sort, where),
    // `sort` is rebuilt each render; its field and direction are what the query reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timeRange, sort.field, sort.direction, where],
  );

  const spans = useSpansListQuery({
    query,
    rolling: filters.rolling,
    fixedStart: filters.datePreset === 'custom',
    enabled: !support.isLoading,
  });
  const histogram = useSpansHistogramQuery({ timeRange, where, support });
  const filterFields = useSpansFilterBarFields({ timeRange, withTokenSearch: support.withTokenSearch });

  return { support, filters, columns, spans, histogram, filterFields, urlState };
}
