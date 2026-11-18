import type { AggregateSpansArgs } from '@mastra/client-js';
import type { TraceQueryScalarPredicate } from '@mastra/core/storage';
import { useProgressiveSearchAvailable, useSpanAggregateAvailable } from '@mastra/react/hooks/capabilities';
import { useProgressiveSpanAggregate, useSpanAggregate } from '@mastra/react/hooks/traces';
import type { SpanQueryArgs } from '@mastra/react/hooks/traces';
import { keepPreviousData } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useHistogramView } from '@/domains/observability/hooks/use-histogram-view';
import type { HistogramView } from '@/domains/observability/hooks/use-histogram-view';
import {
  exceedsAggregateWindow,
  HISTOGRAM_MEASURES,
  histogramPlan,
} from '@/domains/observability/lib/histogram-buckets';
import { hasWordSearch, searchesInChunks } from '@/domains/observability/lib/progressive-search';

export type UseSpansHistogramArgs = {
  /** The span list's resolved time range. */
  timeRange: SpanQueryArgs['timeRange'];
  /** The span list's filter predicate, from `buildSpanQueryWhere`. */
  where?: TraceQueryScalarPredicate;
  enabled?: boolean;
};

/**
 * Span and error counts over the span list's time range and filters. When the server searches in chunks
 * (`observabilityProgressiveSearch`), a word search over more than 7 days loads one chunk at a time, newest first,
 * and `progress` reports how far it got.
 */
export function useSpansHistogram({ timeRange, where, enabled = true }: UseSpansHistogramArgs): HistogramView {
  const aggregateAvailable = useSpanAggregateAvailable();
  const progressiveSearch = useProgressiveSearchAvailable();

  const progressive = progressiveSearch.enabled && hasWordSearch(where) && searchesInChunks(timeRange);
  const request = useMemo<AggregateSpansArgs>(
    () => ({
      timeRange,
      ...(where ? { where } : {}),
      interval: histogramPlan(timeRange).interval,
      measures: [...HISTOGRAM_MEASURES],
      // No groupBy means a single group; the default limit would multiply past the server's row cap.
      limit: 1,
      ...(progressive ? { progressive: true as const } : {}),
    }),
    [timeRange, where, progressive],
  );

  const hidden = !aggregateAvailable.enabled || exceedsAggregateWindow(timeRange);
  // Wait for the capability, so a long word search doesn't run once in full before it runs in chunks.
  const ready = enabled && !hidden && !progressiveSearch.isLoading;

  const plain = useSpanAggregate({
    request,
    enabled: ready && !progressive,
    queryOptions: { placeholderData: keepPreviousData },
  });
  const chunked = useProgressiveSpanAggregate({ request, enabled: ready && progressive });

  return useHistogramView({ timeRange, hidden, progressive, plain, chunked });
}
