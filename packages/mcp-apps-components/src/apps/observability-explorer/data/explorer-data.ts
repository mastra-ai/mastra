import type {
  AggregateSpansResponse,
  AggregateTracesResponse,
  GetObservabilityCapabilitiesResponse,
  GetTraceQueryFieldsResponse,
  GetTraceQueryValuesResponse,
  MastraClient,
  TraceQueryKeysetTraceResponse,
} from '@mastra/client-js';
import { FILTER_BAR_TIME_RANGE_FIELD } from '@mastra/playground-ui/components/FilterBar';
import type { FilterBarField } from '@mastra/playground-ui/components/FilterBar';
import { useObservabilityListFilters } from '@mastra/playground-ui/domains/observability/hooks/use-observability-list-filters';
import {
  exceedsAggregateWindow,
  HISTOGRAM_MEASURES,
  histogramPlan,
} from '@mastra/playground-ui/domains/observability/lib/histogram-buckets';
import { withTokenSearchFields } from '@mastra/playground-ui/domains/observability/lib/token-search-predicate';
import { SPAN_LIST_SORT_FIELDS } from '@mastra/playground-ui/domains/observability/observability-list-url-state';
import type { SavedViewColumnsControl } from '@mastra/playground-ui/domains/observability/saved-views/use-hosted-saved-views';
import { buildSpanQueryWhere, createSpanFilterBarFields } from '@mastra/playground-ui/domains/spans/span-filters';
import type {
  SpansExplorerHistogramData,
  SpansExplorerSpans,
} from '@mastra/playground-ui/domains/spans/spans-explorer-data';
import {
  buildSpansListQuery,
  resolveSpansListView,
  resolveSpansSupport,
} from '@mastra/playground-ui/domains/spans/spans-explorer-support';
import {
  buildThreadQueryWhere,
  createThreadFilterBarFields,
} from '@mastra/playground-ui/domains/threads/thread-filters';
import {
  buildThreadsListQuery,
  resolveThreadsSupport,
} from '@mastra/playground-ui/domains/threads/threads-explorer-data';
import type { ThreadsExplorerThreads } from '@mastra/playground-ui/domains/threads/threads-explorer-data';
import {
  buildTracesHistogramRequest,
  buildTracesListLegacyFilters,
  buildTracesListQuery,
  canShowTracesHistogram,
  resolveTracesSort,
  resolveTracesSupport,
  sanitizeTracesFiltersFor,
  useTracesDateWindow,
} from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import type {
  TracesExplorerCapabilities,
  TracesExplorerDiscovery,
  TracesExplorerFeatures,
  TracesExplorerFilterSuggestions,
  TracesExplorerHistogram,
  TracesExplorerTraces,
  TracesFilters,
  TracesSort,
} from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import {
  getSelectedEntityOption,
  selectsRunningStatus,
} from '@mastra/playground-ui/domains/traces/components/traces-explorer/traces-explorer-actions';
import { toTracesListViewTraces } from '@mastra/playground-ui/domains/traces/components/traces-list-view-adapter';
import { TRACE_COLUMN_CATALOGS } from '@mastra/playground-ui/domains/traces/trace-list-columns';
import type { TraceColumnPreferences, TraceColumnScope } from '@mastra/playground-ui/domains/traces/trace-list-columns';
import type { TraceQueryRelatedScope } from '@mastra/playground-ui/domains/traces/trace-query-filters';
import {
  lightSpanToTraceQueryTrace,
  ROOT_ENTITY_TYPES,
  SPAN_QUERY_PER_PAGE,
  THREAD_QUERY_PER_PAGE,
  TRACE_QUERY_PER_PAGE,
} from '@mastra/react/hooks/traces';
import type {
  SpanRow,
  ThreadQueryArgs,
  ThreadRow,
  TraceQueryArgs,
  TraceQueryValuesResolver,
} from '@mastra/react/hooks/traces';
import type { App } from '@modelcontextprotocol/ext-apps';
import { useCallback, useMemo, useState } from 'react';
import { callTool, ToolError } from '../../../shared/mcp-app';
import {
  callCursorPage,
  callOffsetPage,
  toAppCapabilities,
  toQueryArgs,
  withOpenedFilter,
} from '../../../shared/mcp-tools';
import type { OpenedTraceFilter } from '../../../shared/mcp-tools';
import { useToolPages, useToolQuery } from './use-tool-query';

/** Compares selections, not instants: only filter or date changes move a query's `now`. */
const SELECTION_CLOCK = new Date(0);
// Server caps discovery limits at 100 (TRACE_QUERY_DISCOVERY_MAX_LIMIT).
const DISCOVERY_LIMIT = 100;
const NO_NAMES: string[] = [];
const NO_CANONICAL_FIELDS: GetTraceQueryFieldsResponse['canonicalFields'] = [];

type Window = { from: string; to?: string };
type TraceQueryTrace = TraceQueryKeysetTraceResponse['traces'][number];
type ListTracesLightResponse = Awaited<ReturnType<MastraClient['listTracesLight']>>;

/** The server's capabilities as the app can use them, or none when this caller has no observability tools. */
export function useMcpCapabilities(app: App): TracesExplorerCapabilities {
  const { data, isLoading } = useToolQuery('capabilities', () =>
    callTool(app, 'get_observability_capabilities', {}).then(
      result => toAppCapabilities(result) as GetObservabilityCapabilitiesResponse,
    ),
  );
  return useMemo(() => ({ data, isLoading }), [data, isLoading]);
}

/** Names seen in observability data, by `list_observability_values`; none when it fails, as in Studio. */
async function listNames(app: App, kind: 'entityNames' | 'environments', args: Record<string, unknown> = {}) {
  try {
    const result = (await callTool(app, 'list_observability_values', toQueryArgs({ kind, ...args }))) as
      | { names?: string[]; environments?: string[] }
      | undefined;
    return (kind === 'environments' ? result?.environments : result?.names) ?? NO_NAMES;
  } catch {
    return NO_NAMES;
  }
}

/** Entity names for one entity type, or for every root entity type when none is picked. */
function useEntityNames(app: App, entityType?: string, rootOnly = false): string[] {
  const key = entityType ? `type:${entityType}` : rootOnly ? 'root' : 'all';
  const { data } = useToolQuery(`entity-names:${key}`, async () => {
    if (entityType || !rootOnly) return listNames(app, 'entityNames', entityType ? { entityType } : {});
    const all = await Promise.all(
      Object.values(ROOT_ENTITY_TYPES).map(type => listNames(app, 'entityNames', { entityType: type })),
    );
    return Array.from(new Set(all.flat())).sort();
  });
  return data ?? NO_NAMES;
}

function useEnvironments(app: App): string[] {
  const { data } = useToolQuery('environments', () => listNames(app, 'environments'));
  return data ?? NO_NAMES;
}

/** A lazy value lookup for one field, through `get_trace_query_values`. */
function valuesResolver(
  app: App,
  timeRange: Window,
  predicateScope: TraceQueryRelatedScope | 'trace',
  path: string,
): TraceQueryValuesResolver {
  return async ({ query }) => {
    const { values } = (await callTool(app, 'get_trace_query_values', {
      timeRange,
      predicateScope,
      path,
      search: query.trim() || undefined,
      limit: DISCOVERY_LIMIT,
    })) as GetTraceQueryValuesResponse;
    return values.map(({ value }) => ({ value }));
  };
}

/** A query's `now`, pinned until `selection` changes, so loading more pages doesn't move the window. */
function usePinnedNow(selection: string) {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `selection` is the trigger, not an input.
  return useMemo(() => new Date(), [selection]);
}

/** The window a selection is discovered in: its date window, ending when the explorer opened. */
function useDiscoveryWindow(filters: TracesFilters): Window {
  const { dateFrom, dateTo } = useTracesDateWindow(filters);
  const [now] = useState(() => new Date());
  return useMemo(
    () => ({ from: (dateFrom ?? now).toISOString(), to: (dateTo ?? now).toISOString() }),
    [dateFrom, dateTo, now],
  );
}

export type UseMcpTracesArgs = {
  app: App;
  opened?: OpenedTraceFilter;
  filters: TracesFilters;
  capabilities: TracesExplorerCapabilities;
  features?: TracesExplorerFeatures;
};

/**
 * The traces list through `query_traces`, or `list_traces` on servers without the trace query. The opened query
 * narrows every trace query. Pages load as the list scrolls; nothing polls, so the list reloads when the
 * selection changes.
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
  const legacy = !support.withQueryTrace;

  const selection = JSON.stringify([
    buildTracesListQuery({ filters, dateFrom, dateTo, support, now: SELECTION_CLOCK }),
    sort,
    legacy,
    legacy ? null : (opened ?? null),
  ]);
  const now = usePinnedNow(selection);

  const loadPage = async (cursor: string | number | undefined) => {
    if (legacy) {
      const page = typeof cursor === 'number' ? cursor : 0;
      const result = (await callOffsetPage(
        app,
        'list_traces',
        'spans',
        toQueryArgs({
          ...buildTracesListLegacyFilters({ filters, dateFrom, dateTo }),
          page,
          perPage: TRACE_QUERY_PER_PAGE,
          field: 'startedAt',
          direction: sort.direction === 'asc' ? 'ASC' : 'DESC',
        }),
      )) as ListTracesLightResponse;
      return {
        rows: result.spans.map(lightSpanToTraceQueryTrace),
        next: result.pagination?.hasMore ? page + 1 : undefined,
      };
    }
    const query: TraceQueryArgs = {
      ...buildTracesListQuery({ filters, dateFrom, dateTo, support, now }),
      orderBy: [sort],
    };
    const result = (await callCursorPage(
      app,
      'query_traces',
      'traces',
      withOpenedFilter(
        { ...query, page: { limit: TRACE_QUERY_PER_PAGE, after: (cursor as string | undefined) ?? null } },
        opened,
      ),
    )) as TraceQueryKeysetTraceResponse;
    return { rows: result.traces, next: result.page.next ?? undefined };
  };

  const list = useToolPages<TraceQueryTrace, string | number>(
    support.isCapabilitiesLoading ? undefined : selection,
    loadPage,
  );

  // Offset pages repeat a trace when newer traces shift the pages between loads.
  const rows = useMemo(() => {
    const seen = new Set<string>();
    return toTracesListViewTraces(
      list.rows.filter(trace => !seen.has(trace.traceId) && Boolean(seen.add(trace.traceId))),
    );
  }, [list.rows]);

  return {
    rows,
    isLoading: list.isLoading,
    isFetching: list.isFetching,
    isFetchingNextPage: list.isFetchingNextPage,
    hasNextPage: list.hasNextPage,
    error: list.error,
    onLoadMore: list.loadMore,
    onRetry: list.retry,
  };
}

/** The metadata fields observed on traces in the selection's window, once the server discovers fields. */
export function useMcpTracesDiscovery({
  app,
  filters,
  capabilities,
  features,
}: UseMcpTracesArgs): TracesExplorerDiscovery {
  const { withDiscovery } = resolveTracesSupport(capabilities, features);
  const timeRange = useDiscoveryWindow(filters);
  const { data, isLoading } = useToolQuery(withDiscovery ? JSON.stringify(timeRange) : undefined, async () => {
    try {
      return (await callTool(app, 'get_trace_query_fields', {
        timeRange,
        predicateScope: 'trace',
        limit: DISCOVERY_LIMIT,
      })) as GetTraceQueryFieldsResponse;
    } catch (error) {
      // A store without discovery answers with an error; the filter bar then offers its fixed fields.
      if (error instanceof ToolError) return undefined;
      throw error;
    }
  });
  const observed = data?.observedFields;
  const fields = useMemo(
    () =>
      (observed ?? []).map(field => ({
        path: field.path,
        suggestions: valuesResolver(app, timeRange, 'trace', field.path),
      })),
    [observed, app, timeRange],
  );
  return { fields, canonicalFields: data?.canonicalFields ?? NO_CANONICAL_FIELDS, isLoading };
}

/** The filter bar's suggestions: root entity names, environments and, with the trace query, field values. */
export function useMcpTracesFilterSuggestions({
  app,
  filters: rawFilters,
  capabilities,
  features,
}: UseMcpTracesArgs): TracesExplorerFilterSuggestions {
  const support = resolveTracesSupport(capabilities, features);
  const filters = sanitizeTracesFiltersFor(rawFilters, support);
  const rootEntityNames = useEntityNames(app, getSelectedEntityOption(filters.tokens)?.entityType, true);
  const environments = useEnvironments(app);
  const timeRange = useDiscoveryWindow(rawFilters);
  const resolveValues = useMemo(
    () =>
      support.withQueryTrace
        ? (scope: TraceQueryRelatedScope | 'trace', path: string) => valuesResolver(app, timeRange, scope, path)
        : undefined,
    [support.withQueryTrace, app, timeRange],
  );
  return { rootEntityNames, environments, resolveValues };
}

const NO_TRACE_ROWS: AggregateTracesResponse['rows'] = [];

/** Trace and error counts over the list's window, through `aggregate_traces` with the opened query. */
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
  const now = usePinnedNow(selection);
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
  const { data, isLoading, error, isPlaceholderData } = useToolQuery(
    shown ? JSON.stringify([request, opened ?? null]) : undefined,
    () => callTool(app, 'aggregate_traces', withOpenedFilter(request, opened)) as Promise<AggregateTracesResponse>,
  );
  if (!shown) return undefined;
  return {
    timeRange: request.timeRange,
    rows: data?.rows ?? NO_TRACE_ROWS,
    isLoading,
    isError: error !== undefined,
    isUpdating: isPlaceholderData,
  };
}

/** Column choices for one list, kept for the life of the app. */
function useColumns(scope: TraceColumnScope): SavedViewColumnsControl {
  const defaults = TRACE_COLUMN_CATALOGS[scope].defaults;
  const [preferences, setPreferences] = useState(defaults);
  const resetColumns = useCallback(() => setPreferences(defaults), [defaults]);
  return useMemo(() => ({ preferences, setPreferences, resetColumns }), [preferences, resetColumns]);
}

/** A cursor-paged query tool's list, reloaded from its first page when `query` changes. */
function useQueryPages<Row>(app: App, tool: string, key: 'spans' | 'threads', limit: number, query?: object) {
  return useToolPages<Row, string>(query ? JSON.stringify(query) : undefined, async cursor => {
    const result = (await callCursorPage(app, tool, key, {
      ...query,
      page: cursor ? { limit, after: cursor } : { limit },
    })) as Record<string, unknown> & { page: { next?: string | null } };
    return { rows: result[key] as Row[], next: result.page.next ?? undefined };
  });
}

const NO_SPAN_ROWS: AggregateSpansResponse['rows'] = [];

/**
 * Everything the spans explorer draws, through `query_spans`, `aggregate_spans` and the discovery tools, with its
 * filters held in memory. Spread the result into `SpansExplorerBody`.
 */
export function useMcpSpansExplorer(app: App, capabilities: TracesExplorerCapabilities) {
  const support = useMemo(() => resolveSpansSupport(capabilities), [capabilities]);
  const filters = useObservabilityListFilters(undefined, {
    sortFields: SPAN_LIST_SORT_FIELDS,
    withTokenSearch: support.withTokenSearch,
  });
  const columns = useColumns('spans');
  const { timeRange, tokens, groups } = filters;
  const { sort } = resolveSpansListView(filters.sort, columns.preferences, support);
  const where = useMemo(() => buildSpanQueryWhere(tokens, groups, support), [tokens, groups, support]);
  const query = useMemo(
    () => buildSpansListQuery(timeRange, sort, where),
    // `sort` is rebuilt each render; its field and direction are what the query reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timeRange, sort.field, sort.direction, where],
  );

  const list = useQueryPages<SpanRow>(
    app,
    'query_spans',
    'spans',
    SPAN_QUERY_PER_PAGE,
    support.isLoading ? undefined : query,
  );
  const spans: SpansExplorerSpans = {
    spans: list.rows,
    isLoading: list.isLoading,
    isFetchingNextPage: list.isFetchingNextPage,
    hasNextPage: list.hasNextPage,
    isError: list.error !== undefined,
    error: list.error,
    onLoadMore: list.loadMore,
  };

  const histogramShown = support.withAggregate && !exceedsAggregateWindow(timeRange);
  const histogramRequest = useMemo(
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
  const aggregate = useToolQuery(
    histogramShown ? JSON.stringify(histogramRequest) : undefined,
    () => callTool(app, 'aggregate_spans', histogramRequest) as Promise<AggregateSpansResponse>,
  );
  const histogram: SpansExplorerHistogramData | undefined = histogramShown
    ? {
        timeRange,
        rows: aggregate.data?.rows ?? NO_SPAN_ROWS,
        isLoading: aggregate.isLoading,
        isError: aggregate.error !== undefined,
        isUpdating: aggregate.isPlaceholderData,
      }
    : undefined;

  const flags = capabilities.data?.capabilities;
  const withContextFields = flags?.spanQueryContextFields ?? false;
  const withTimeToFirstChunk = flags?.traceQueryTimeToFirstChunk ?? false;
  const withTimeToFirstToken = flags?.traceQueryTimeToFirstToken ?? false;
  const withOutcomeFields = flags?.spanQueryOutcomeFields ?? false;
  const withModelFields = flags?.spanQueryModelFields ?? false;
  const entityNames = useEntityNames(app);
  const environments = useEnvironments(app);
  // Memoized for correctness: static suggestion lists become the value editor's Combobox `items`, which loops
  // if handed a new array on every render.
  const filterFields = useMemo<FilterBarField[]>(
    () => [
      FILTER_BAR_TIME_RANGE_FIELD,
      ...withTokenSearchFields(
        createSpanFilterBarFields({
          withContextFields,
          withTimeToFirstChunk,
          withTimeToFirstToken,
          withOutcomeFields,
          withModelFields,
          entityNames,
          environments,
          valueSuggestions: path => valuesResolver(app, timeRange, 'spans', path),
        }),
        support.withTokenSearch,
      ),
    ],
    [
      support.withTokenSearch,
      withContextFields,
      withTimeToFirstChunk,
      withTimeToFirstToken,
      withOutcomeFields,
      withModelFields,
      entityNames,
      environments,
      app,
      timeRange,
    ],
  );

  return { support, filters, columns, spans, histogram, filterFields };
}

/**
 * Everything the threads explorer draws, through `query_threads` and the discovery tools, with its filters held
 * in memory. Spread the result into `ThreadsExplorerBody`.
 */
export function useMcpThreadsExplorer(app: App, capabilities: TracesExplorerCapabilities) {
  const support = useMemo(() => resolveThreadsSupport(capabilities), [capabilities]);
  const filters = useObservabilityListFilters();
  const columns = useColumns('threads');
  const { timeRange, tokens, groups, sort } = filters;
  const query = useMemo<ThreadQueryArgs>(
    () => buildThreadsListQuery(timeRange, sort.direction, buildThreadQueryWhere(tokens, groups, support)),
    [timeRange, sort.direction, tokens, groups, support],
  );

  const list = useQueryPages<ThreadRow>(
    app,
    'query_threads',
    'threads',
    THREAD_QUERY_PER_PAGE,
    support.isLoading ? undefined : query,
  );
  const threads: ThreadsExplorerThreads = {
    threads: list.rows,
    isLoading: list.isLoading,
    isFetchingNextPage: list.isFetchingNextPage,
    hasNextPage: list.hasNextPage,
    isError: list.error !== undefined,
    error: list.error,
    onLoadMore: list.loadMore,
  };

  const flags = capabilities.data?.capabilities;
  const withTimeToFirstChunk = flags?.traceQueryTimeToFirstChunk ?? false;
  const withTimeToFirstToken = flags?.traceQueryTimeToFirstToken ?? false;
  const entityNames = useEntityNames(app);
  const environments = useEnvironments(app);
  const filterFields = useMemo<FilterBarField[]>(
    () => [
      FILTER_BAR_TIME_RANGE_FIELD,
      ...createThreadFilterBarFields({ withTimeToFirstChunk, withTimeToFirstToken, entityNames, environments }),
    ],
    [withTimeToFirstChunk, withTimeToFirstToken, entityNames, environments],
  );

  return { support, filters, columns, threads, filterFields };
}

/** Whether a list tab shows: the server queries it and the app offers it. */
export function resolveMcpViews(capabilities: TracesExplorerCapabilities, features: TracesExplorerFeatures) {
  const flags = capabilities.data?.capabilities;
  return {
    spans: Boolean(flags?.spanQuery) && features.spanQuery === true,
    threads: Boolean(flags?.threadQueryRows) && features.threadQuery === true,
  };
}
