import type { MastraClient, TraceQueryKeysetTraceResponse } from '@mastra/client-js';
import {
  fixedWindowRefetchInterval,
  OBSERVABILITY_LIST_REFETCH_INTERVAL_MS,
} from '@mastra/playground-ui/domains/observability/list-polling';
import {
  buildTracesListLegacyFilters,
  buildTracesListQuery,
  resolveTracesSort,
  resolveTracesSupport,
  sanitizeTracesFiltersFor,
  useTracesDateWindow,
} from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import type { TracesExplorerTraces, TracesSort } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import { toTracesListViewTraces } from '@mastra/playground-ui/domains/traces/components/traces-list-view-adapter';
import type { TraceColumnPreferences } from '@mastra/playground-ui/domains/traces/trace-list-columns';
import {
  getTraceQueryNextPageParam,
  selectLegacyTraceQueryTraces,
  selectTraceQueryTraces,
  TRACE_QUERY_PER_PAGE,
} from '@mastra/react/hooks/traces';
import type { TraceQueryArgs } from '@mastra/react/hooks/traces';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { callCursorPage, callOffsetPage, toQueryArgs, withOpenedFilter } from '../../../shared/mcp-tools';
import { toolRequest } from './tool-request';
import type { UseMcpTracesArgs } from './use-mcp-traces-args';

type ListTracesLightResponse = Awaited<ReturnType<MastraClient['listTracesLight']>>;

/** Fixed clock for comparing selections: filter and date changes move the query, time passing does not. */
const SELECTION_CLOCK = new Date(0);

/**
 * The traces list through `query_traces`, or `list_traces` on servers without the trace query, kept live the way
 * Studio keeps it without delta polling (which the app never offers): a rolling window reloads in place every
 * `OBSERVABILITY_LIST_REFETCH_INTERVAL_MS`, a fixed window refetches on that interval. The opened query narrows
 * every trace query.
 */
export function useMcpTracesList({
  app,
  opened,
  filters: rawFilters,
  sort: hostSort,
  columns,
  capabilities,
  features,
}: UseMcpTracesArgs & { sort: TracesSort; columns: TraceColumnPreferences }): TracesExplorerTraces {
  const support = resolveTracesSupport(capabilities, features);
  const filters = sanitizeTracesFiltersFor(rawFilters, support);
  const { dateFrom, dateTo } = useTracesDateWindow(rawFilters);
  const sort = resolveTracesSort(hostSort, support, columns);
  const rolling = !dateTo;
  const enabled = !support.isCapabilitiesLoading;
  const withQueryTrace = support.withQueryTrace;

  // A rolling window ticks `now` forward; a selection change anchors a new one.
  const [tickNow, setTickNow] = useState(() => new Date());
  const selection = JSON.stringify(buildTracesListQuery({ filters, dateFrom, dateTo, support, now: SELECTION_CLOCK }));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `selection` is the trigger, not an input.
  const anchoredNow = useMemo(() => new Date(), [selection]);
  const now = tickNow > anchoredNow ? tickNow : anchoredNow;
  const orderBy = [sort];
  const query: TraceQueryArgs = { ...buildTracesListQuery({ filters, dateFrom, dateTo, support, now }), orderBy };

  const traceQuery = useInfiniteQuery({
    queryKey: ['mcp-trace-query', query, TRACE_QUERY_PER_PAGE, opened ?? null],
    queryFn: ({ pageParam }) =>
      toolRequest<TraceQueryKeysetTraceResponse>(
        callCursorPage(
          app,
          'query_traces',
          'traces',
          withOpenedFilter({ ...query, page: { limit: TRACE_QUERY_PER_PAGE, after: pageParam ?? null } }, opened),
        ),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: getTraceQueryNextPageParam,
    select: selectTraceQueryTraces,
    retry: false,
    placeholderData: keepPreviousData,
    // A fixed window polls in place until the server refuses it; a rolling one moves its key instead.
    refetchInterval: rolling ? false : ({ state }) => fixedWindowRefetchInterval(state.error),
    refetchOnWindowFocus: true,
    enabled: enabled && withQueryTrace,
  });

  const legacyFilters = buildTracesListLegacyFilters({ filters, dateFrom, dateTo });
  const legacyQuery = useInfiniteQuery({
    queryKey: ['mcp-trace-query-legacy', legacyFilters, TRACE_QUERY_PER_PAGE, orderBy],
    queryFn: ({ pageParam }) =>
      toolRequest<ListTracesLightResponse>(
        callOffsetPage(
          app,
          'list_traces',
          'spans',
          // Flattened the way `MastraClient.listTracesLight` puts them in its query string.
          toQueryArgs({
            ...legacyFilters,
            page: pageParam,
            perPage: TRACE_QUERY_PER_PAGE,
            field: 'startedAt',
            direction: sort.direction === 'asc' ? 'ASC' : 'DESC',
          }),
        ),
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, page) => (lastPage.pagination?.hasMore ? page + 1 : undefined),
    select: selectLegacyTraceQueryTraces,
    retry: false,
    placeholderData: keepPreviousData,
    refetchInterval: rolling ? false : ({ state }) => fixedWindowRefetchInterval(state.error),
    refetchOnWindowFocus: true,
    enabled: enabled && !withQueryTrace,
  });

  const list = withQueryTrace ? traceQuery : legacyQuery;
  const error = withQueryTrace ? traceQuery.error : legacyQuery.error;

  // Moving the query key refreshes the cursor chain once, without a second polling request.
  useEffect(() => {
    if (!rolling || error) return;
    const timer = setInterval(() => setTickNow(new Date()), OBSERVABILITY_LIST_REFETCH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [rolling, error]);

  // A rolling tick moves the query key; keep the rows when the data is the same so the list doesn't re-render.
  const rows = useMemo(() => toTracesListViewTraces(list.data ?? []), [list.data]);

  return {
    rows,
    isLoading: list.isLoading,
    isFetching: list.isFetching,
    isFetchingNextPage: list.isFetchingNextPage,
    hasNextPage: list.hasNextPage,
    error: error ?? undefined,
    onLoadMore: list.fetchNextPage,
    onRetry: list.refetch,
  };
}
