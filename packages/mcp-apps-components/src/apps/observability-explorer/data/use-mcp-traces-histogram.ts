import type { AggregateTracesResponse } from '@mastra/client-js';
import {
  buildTracesHistogramRequest,
  buildTracesListQuery,
  canShowTracesHistogram,
  resolveTracesSupport,
  sanitizeTracesFiltersFor,
  useTracesDateWindow,
} from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import type { TracesExplorerHistogram } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import { selectsRunningStatus } from '@mastra/playground-ui/domains/traces/components/traces-explorer/traces-explorer-actions';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { callTool } from '../../../shared/mcp-app';
import { withOpenedFilter } from '../../../shared/mcp-tools';
import { toolRequest } from './tool-request';
import type { UseMcpTracesArgs } from './use-mcp-traces-args';

/** Compares selections, not instants: only filter or date changes move the histogram's `now`. */
const SELECTION_CLOCK = new Date(0);
const NO_ROWS: AggregateTracesResponse['rows'] = [];

/**
 * Trace and error counts over the list's window, through `aggregate_traces` with the opened query. Like Studio's
 * it doesn't poll: it refetches when the selection changes.
 */
export function useMcpTracesHistogram({
  app,
  opened,
  filters: rawFilters,
  capabilities,
  features,
}: UseMcpTracesArgs): TracesExplorerHistogram | undefined {
  const support = resolveTracesSupport(capabilities, features);
  const filters = sanitizeTracesFiltersFor(rawFilters, support);
  const { dateFrom, dateTo } = useTracesDateWindow(rawFilters);
  const selection = JSON.stringify(buildTracesListQuery({ filters, dateFrom, dateTo, support, now: SELECTION_CLOCK }));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `selection` is the trigger, not an input.
  const now = useMemo(() => new Date(), [selection]);
  const request = useMemo(
    () => buildTracesHistogramRequest({ filters, dateFrom, dateTo, support, now }),
    // `filters` and `support` are rebuilt each render; `selection` is what the request reads from them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selection, now],
  );
  const shown = canShowTracesHistogram({
    runningSelected: selectsRunningStatus(rawFilters),
    support,
    timeRange: request.timeRange,
  });
  const { data, isLoading, isError, isPlaceholderData } = useQuery({
    queryKey: ['mcp-trace-aggregate', request, opened ?? null],
    queryFn: () =>
      toolRequest<AggregateTracesResponse>(callTool(app, 'aggregate_traces', withOpenedFilter(request, opened))),
    placeholderData: keepPreviousData,
    retry: false,
    refetchOnWindowFocus: false,
    enabled: shown,
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
