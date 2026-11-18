import type { AggregateTracesArgs } from '@mastra/client-js';
import { useProgressiveSearchAvailable, useTraceAggregateAvailable } from '@mastra/react/hooks/capabilities';
import { useProgressiveTraceAggregate, useTraceAggregate } from '@mastra/react/hooks/traces';
import { keepPreviousData } from '@tanstack/react-query';
import { useMemo } from 'react';
import { buildTracesQueryRequest } from '../components/traces-explorer/traces-explorer-actions';
import { useTracesConfig, useTracesFilters } from '../components/traces-explorer/traces-explorer-context';
import { useHistogramView } from '@/domains/observability/hooks/use-histogram-view';
import type { HistogramView } from '@/domains/observability/hooks/use-histogram-view';
import {
  exceedsAggregateWindow,
  HISTOGRAM_MEASURES,
  histogramPlan,
} from '@/domains/observability/lib/histogram-buckets';
import { hasWordSearch, searchesInChunks } from '@/domains/observability/lib/progressive-search';

/** Compares selections, not instants: only filter or date changes move the chart's `now`. */
const SELECTION_CLOCK = new Date(0);

/**
 * Trace and error counts over the list's time range, built from the same filters as the list query. A word search
 * over more than 7 days loads one chunk at a time when the server can (`progressiveTokenSearch`).
 */
export function useTracesHistogram(enabled: boolean): HistogramView {
  const {
    rootSource,
    withQueryTrace,
    withTokenSearch,
    withRootDuration,
    withTimeToFirstChunk,
    withTimeToFirstToken,
    withOutcomeFields,
  } = useTracesConfig();
  const { filters, dateFrom, dateTo, runningSelected } = useTracesFilters();
  const aggregateAvailable = useTraceAggregateAvailable();
  const progressiveSearch = useProgressiveSearchAvailable();

  const selectionKey = JSON.stringify(
    buildTracesQueryRequest({
      filters,
      dateFrom,
      dateTo,
      withTokenSearch,
      withRootDuration,
      withTimeToFirstChunk,
      withTimeToFirstToken,
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
      withTokenSearch,
      withRootDuration,
      withTimeToFirstChunk,
      withTimeToFirstToken,
      withOutcomeFields,
      now,
    });
    const progressive = progressiveSearch.enabled && hasWordSearch(where) && searchesInChunks(timeRange);
    return {
      timeRange,
      ...(where ? { where } : {}),
      interval: histogramPlan(timeRange).interval,
      measures: [...HISTOGRAM_MEASURES],
      // No groupBy means a single group; the default limit would multiply past the server's row cap.
      limit: 1,
      ...(progressive ? { progressive: true as const } : {}),
    };
  }, [
    filters,
    dateFrom,
    dateTo,
    withRootDuration,
    withTimeToFirstChunk,
    withTimeToFirstToken,
    withOutcomeFields,
    withTokenSearch,
    now,
    progressiveSearch.enabled,
  ]);

  const hidden =
    rootSource === 'aggregated' ||
    !withQueryTrace ||
    !aggregateAvailable.enabled ||
    runningSelected ||
    exceedsAggregateWindow(request.timeRange);
  const progressive = request.progressive === true;
  // Wait for the capability, so a long word search doesn't run once in full before it runs in chunks.
  const ready = enabled && !hidden && !progressiveSearch.isLoading;

  const plain = useTraceAggregate({
    request,
    enabled: ready && !progressive,
    queryOptions: { placeholderData: keepPreviousData },
  });
  const chunked = useProgressiveTraceAggregate({ request, enabled: ready && progressive });

  return useHistogramView({ timeRange: request.timeRange, hidden, progressive, plain, chunked });
}
