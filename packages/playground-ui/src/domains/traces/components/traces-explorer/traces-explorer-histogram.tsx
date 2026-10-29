import type { AggregateTracesArgs } from '@mastra/client-js';
import { useTraceAggregateAvailable } from '@mastra/react/hooks/capabilities';
import { useTraceAggregate } from '@mastra/react/hooks/traces';
import { keepPreviousData } from '@tanstack/react-query';
import { useMemo } from 'react';
import { buildTracesQueryRequest } from './traces-explorer-actions';
import { useTracesConfig, useTracesFilters } from './traces-explorer-context';
import { ObservabilityHistogram } from '@/domains/observability/components/observability-histogram';
import {
  bucketCountRows,
  exceedsAggregateWindow,
  HISTOGRAM_MEASURES,
  histogramPlan,
  zoomWindow,
} from '@/domains/observability/lib/histogram-buckets';

/** Compares selections, not instants: only filter or date changes move the chart's `now`. */
const SELECTION_CLOCK = new Date(0);

/**
 * Trace and error counts over the list's time range, built from the same filters as the list query.
 * Renders nothing when the server can't aggregate traces, the window is wider than it aggregates,
 * or the filters ask for `running` traces (the query drops that status, so the counts wouldn't match).
 * Dragging across bars narrows the list to their time span as a custom range.
 */
export function TracesExplorerHistogram() {
  const { withQueryTrace, withRootDuration, withOutcomeFields } = useTracesConfig();
  const { filters, dateFrom, dateTo, runningSelected, setDatePreset, setDateRange } = useTracesFilters();
  const aggregateAvailable = useTraceAggregateAvailable();

  const selectionKey = JSON.stringify(
    buildTracesQueryRequest({
      filters,
      dateFrom,
      dateTo,
      withRootDuration,
      withOutcomeFields,
      now: SELECTION_CLOCK,
    }),
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `selectionKey` is the trigger, not an input.
  const now = useMemo(() => new Date(), [selectionKey]);

  const request = useMemo<AggregateTracesArgs>(() => {
    const { timeRange, where } = buildTracesQueryRequest({
      filters,
      dateFrom,
      dateTo,
      withRootDuration,
      withOutcomeFields,
      now,
    });
    return {
      timeRange,
      ...(where ? { where } : {}),
      interval: histogramPlan(timeRange).interval,
      measures: [...HISTOGRAM_MEASURES],
      // No groupBy means a single group; the default limit would multiply past the server's row cap.
      limit: 1,
    };
  }, [filters, dateFrom, dateTo, withRootDuration, withOutcomeFields, now]);

  const hidden =
    !withQueryTrace || !aggregateAvailable.enabled || runningSelected || exceedsAggregateWindow(request.timeRange);

  const { data, isLoading, isError, isPlaceholderData } = useTraceAggregate({
    request,
    enabled: !hidden,
    queryOptions: { placeholderData: keepPreviousData },
  });

  const buckets = useMemo(() => bucketCountRows(data?.rows ?? [], request.timeRange), [data, request.timeRange]);

  if (hidden) return null;

  return (
    <ObservabilityHistogram
      label="Traces over time"
      resourceLabel="Traces"
      buckets={buckets}
      isLoading={isLoading}
      isError={isError}
      isUpdating={isPlaceholderData}
      onZoom={range => {
        const { from, to } = zoomWindow(buckets, range, request.timeRange);
        setDatePreset('custom');
        setDateRange(from, to);
      }}
    />
  );
}
