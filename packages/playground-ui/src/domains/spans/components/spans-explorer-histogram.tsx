import type { AggregateSpansArgs } from '@mastra/client-js';
import type { TraceQueryScalarPredicate } from '@mastra/core/storage';
import { useSpanAggregateAvailable } from '@mastra/react/hooks/capabilities';
import { useSpanAggregate } from '@mastra/react/hooks/traces';
import type { SpanQueryArgs } from '@mastra/react/hooks/traces';
import { keepPreviousData } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ObservabilityHistogram } from '@/domains/observability/components/observability-histogram';
import {
  bucketCountRows,
  exceedsAggregateWindow,
  HISTOGRAM_MEASURES,
  histogramPlan,
} from '@/domains/observability/lib/histogram-buckets';

export type SpansExplorerHistogramProps = {
  /** The span list's resolved time range. */
  timeRange: SpanQueryArgs['timeRange'];
  /** The span list's filter predicate, from `buildSpanQueryWhere`. */
  where?: TraceQueryScalarPredicate;
};

/**
 * Span and error counts over the span list's time range and filters.
 * Renders nothing when the server can't aggregate spans or the window is wider than it aggregates.
 */
export function SpansExplorerHistogram({ timeRange, where }: SpansExplorerHistogramProps) {
  const aggregateAvailable = useSpanAggregateAvailable();

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

  const hidden = !aggregateAvailable.enabled || exceedsAggregateWindow(timeRange);

  const { data, isLoading, isError, isPlaceholderData } = useSpanAggregate({
    request,
    enabled: !hidden,
    queryOptions: { placeholderData: keepPreviousData },
  });

  const buckets = useMemo(() => bucketCountRows(data?.rows ?? [], timeRange), [data, timeRange]);

  if (hidden) return null;

  return (
    <ObservabilityHistogram
      label="Spans over time"
      resourceLabel="Spans"
      buckets={buckets}
      isLoading={isLoading}
      isError={isError}
      isUpdating={isPlaceholderData}
    />
  );
}
