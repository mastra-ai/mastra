import type { AggregateTracesResponse } from '@mastra/client-js';
import { useTraceAggregate } from '@mastra/react/hooks/traces';
import { keepPreviousData } from '@tanstack/react-query';
import { useMemo } from 'react';
import { selectsRunningStatus } from '../components/traces-explorer/traces-explorer-actions';
import type { TracesFilters } from '../components/traces-explorer/traces-explorer-actions';
import type {
  TracesExplorerCapabilities,
  TracesExplorerHistogram,
} from '../components/traces-explorer/traces-explorer-data';
import {
  buildTracesHistogramRequest,
  buildTracesListQuery,
  canShowTracesHistogram,
  resolveTracesSupport,
  sanitizeTracesFiltersFor,
} from '../components/traces-explorer/traces-explorer-support';
import type { TracesExplorerFeatures, TracesRootSource } from '../components/traces-explorer/traces-explorer-support';
import { useTracesDateWindow } from '../components/traces-explorer/use-traces-date-window';

/** Compares selections, not instants: only filter or date changes move the chart's `now`. */
const SELECTION_CLOCK = new Date(0);
const NO_ROWS: AggregateTracesResponse['rows'] = [];

export type UseTracesHistogramQueryArgs = {
  filters: TracesFilters;
  capabilities: TracesExplorerCapabilities;
  features?: TracesExplorerFeatures;
  rootSource?: TracesRootSource;
};

/**
 * Studio's histogram counts, through the Mastra client: `aggregateTraces()` over the list's window with
 * the list's filters. `undefined` when the chart can't show (see `canShowTracesHistogram`), so it never
 * asks. Pass the result as `TracesExplorer.Histogram`'s `data`.
 */
export function useTracesHistogramQuery({
  filters: rawFilters,
  capabilities,
  features,
  rootSource,
}: UseTracesHistogramQueryArgs): TracesExplorerHistogram | undefined {
  const {
    withQueryTrace,
    withTraceAggregate,
    withTokenSearch,
    withRootDuration,
    withTimeToFirstChunk,
    withTimeToFirstToken,
    withOutcomeFields,
  } = resolveTracesSupport(capabilities, features);
  const querySupport = {
    withTokenSearch,
    withRootDuration,
    withTimeToFirstChunk,
    withTimeToFirstToken,
    withOutcomeFields,
  };
  const filters = sanitizeTracesFiltersFor(rawFilters, querySupport);
  const { dateFrom, dateTo } = useTracesDateWindow(rawFilters);

  const selectionKey = JSON.stringify(
    buildTracesListQuery({ filters, dateFrom, dateTo, support: querySupport, now: SELECTION_CLOCK }),
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `selectionKey` is the trigger, not an input.
  const now = useMemo(() => new Date(), [selectionKey]);

  // Memoized for its identity: the chart re-buckets when its window changes.
  const request = useMemo(
    () =>
      buildTracesHistogramRequest({
        filters,
        dateFrom,
        dateTo,
        support: { withTokenSearch, withRootDuration, withTimeToFirstChunk, withTimeToFirstToken, withOutcomeFields },
        now,
      }),
    [
      filters,
      dateFrom,
      dateTo,
      withTokenSearch,
      withRootDuration,
      withTimeToFirstChunk,
      withTimeToFirstToken,
      withOutcomeFields,
      now,
    ],
  );

  const shown = canShowTracesHistogram({
    runningSelected: selectsRunningStatus(rawFilters),
    support: { withQueryTrace, withTraceAggregate },
    rootSource,
    timeRange: request.timeRange,
  });
  const { data, isLoading, isError, isPlaceholderData } = useTraceAggregate({
    request,
    enabled: shown,
    queryOptions: { placeholderData: keepPreviousData },
  });

  if (!shown) return undefined;
  return {
    timeRange: request.timeRange,
    rows: data?.rows ?? NO_ROWS,
    isLoading,
    isError,
    isUpdating: isPlaceholderData,
  };
}
