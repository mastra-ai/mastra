import type { AggregateTracesArgs } from '@mastra/client-js';
import { EntityType } from '@mastra/core/observability';
import type { TraceQueryArgs } from '@mastra/react/hooks/traces';
import { hasTraceColumn, hasTraceUsageColumn, isTraceUsageColumn } from '../../trace-list-columns';
import type { TraceColumnPreferences } from '../../trace-list-columns';
import {
  buildTracesLegacyFilters,
  buildTracesQueryRequest,
  DEFAULT_TRACES_SORT,
  sanitizeTracesFilters,
} from './traces-explorer-actions';
import type { TracesFilters, TracesSort } from './traces-explorer-actions';
import type { TracesExplorerCapabilities } from './traces-explorer-data';
import {
  exceedsAggregateWindow,
  HISTOGRAM_MEASURES,
  histogramPlan,
} from '@/domains/observability/lib/histogram-buckets';

export type TracesExplorerScope = { entityId: string; entityType?: EntityType };

export type TracesMetricsSupport = { supported: boolean; isLoading: boolean };

/**
 * Host switches (e.g. feature flags), combined with what the server supports.
 * `traceQuery` and `feedback` default to on and can only turn their feature off.
 * `spanQuery` and `threadQuery` default to off: each view is offered only when its flag is `true`
 * and the server supports it.
 */
export type TracesExplorerFeatures = {
  traceQuery?: boolean;
  feedback?: boolean;
  spanQuery?: boolean;
  threadQuery?: boolean;
};

/** What the explorer can do: the store's capabilities combined with the host's feature switches. */
export type TracesSupport = {
  withQueryTrace: boolean;
  withTokenSearch: boolean;
  withFeedback: boolean;
  /** The span query API is on, so the host can offer a spans view next to the traces list. */
  withSpanQuery: boolean;
  /** The thread rows API is on, so the host can offer a threads view next to the traces list. */
  withThreadQuery: boolean;
  withRootDuration: boolean;
  /** The server filters trace queries on the root span's `outcome` and `stopReason`. */
  withOutcomeFields: boolean;
  /** Trace rows carry the root span's time to first chunk, so the TTFC column can be shown. */
  withTimeToFirstChunk: boolean;
  /** Trace queries can be ordered by the root span's time to first chunk. */
  withTimeToFirstChunkSort: boolean;
  /** Trace rows carry the root span's time to first token, so the TTFT column can be shown. */
  withTimeToFirstToken: boolean;
  /** Trace queries can be ordered by the root span's time to first token. */
  withTimeToFirstTokenSort: boolean;
  /** The server supports delta polling, so auto-refresh merges new traces instead of reloading pages. */
  withDeltaPolling: boolean;
  /** Whether field discovery should run: the server supports it and the trace query API is on. */
  withDiscovery: boolean;
  /** The server aggregates traces, so the histogram can count them. */
  withTraceAggregate: boolean;
  isCapabilitiesLoading: boolean;
};

/**
 * The explorer's support from the store's capabilities and the host's switches. Every flag stays off
 * while the capabilities load; once loaded, a flag the server omits takes an older server's default.
 */
export function resolveTracesSupport(
  { data, isLoading }: TracesExplorerCapabilities,
  features?: TracesExplorerFeatures,
): TracesSupport {
  const capabilities = data?.capabilities;
  const loaded = !isLoading;
  // Servers without the trace-query API list through `listTracesLight` and don't expose feedback.
  const withQueryTrace = loaded && (capabilities?.traceQuery ?? true) && features?.traceQuery !== false;
  const withTimeToFirstChunk = withQueryTrace && (capabilities?.traceQueryTimeToFirstChunk ?? false);
  const withTimeToFirstToken = withQueryTrace && (capabilities?.traceQueryTimeToFirstToken ?? false);
  return {
    withQueryTrace,
    withTokenSearch:
      withQueryTrace && !!(capabilities?.traceQueryTokenSearch && capabilities.traceAggregateTokenSearch),
    withFeedback: loaded && (capabilities?.feedback ?? true) && features?.feedback !== false,
    // Opt-in: span and thread views need both the server capability and the host turning them on.
    withSpanQuery: loaded && (capabilities?.spanQuery ?? false) && features?.spanQuery === true,
    withThreadQuery: loaded && (capabilities?.threadQueryRows ?? false) && features?.threadQuery === true,
    withRootDuration: loaded && (capabilities?.traceQueryRootDuration ?? false),
    withOutcomeFields: withQueryTrace && (capabilities?.traceQueryOutcomeFields ?? false),
    withTimeToFirstChunk,
    withTimeToFirstChunkSort: withTimeToFirstChunk && (capabilities?.traceQueryTimeToFirstChunkSort ?? false),
    withTimeToFirstToken,
    withTimeToFirstTokenSort: withTimeToFirstToken && (capabilities?.traceQueryTimeToFirstTokenSort ?? false),
    withDeltaPolling: loaded && (capabilities?.deltaPolling ?? false),
    withDiscovery: withQueryTrace && loaded && (capabilities?.traceQueryDiscovery ?? true),
    withTraceAggregate: loaded && capabilities?.traceAggregate === true,
    isCapabilitiesLoading: isLoading,
  };
}

/** The host's filters with the entries this server can't query dropped (the host keeps its raw value). */
export const sanitizeTracesFiltersFor = (filters: TracesFilters, support: TracesQuerySupport) =>
  sanitizeTracesFilters(filters, {
    withTokenSearch: support.withTokenSearch,
    withRootDuration: support.withRootDuration,
    withTimeToFirstChunk: support.withTimeToFirstChunk,
    withTimeToFirstToken: support.withTimeToFirstToken,
    withOutcomeFields: support.withOutcomeFields,
  });

export const CHECKING_USAGE_REASON = 'Checking whether this storage supports usage data.';
export const UNSUPPORTED_USAGE_REASON = 'This observability store does not support token and cost metrics.';

export type TraceUsageColumns = {
  /** Column preferences without the columns the store can't serve (usage, time to first chunk/token). */
  displayedPreferences: TraceColumnPreferences;
  /** Whether usage should be loaded: metrics are supported and a usage column is visible. */
  usageEnabled: boolean;
  usageDisabledReason?: string;
};

/** The columns the list shows, and whether it needs usage, given what the store serves. */
export function resolveTraceUsageColumns(
  preferences: TraceColumnPreferences,
  metricsSupport: TracesMetricsSupport,
  support: Pick<TracesSupport, 'withTimeToFirstChunk' | 'withTimeToFirstToken' | 'isCapabilitiesLoading'>,
): TraceUsageColumns {
  const unavailable = !metricsSupport.isLoading && !metricsSupport.supported;
  const timeToFirstChunkUnavailable = !support.isCapabilitiesLoading && !support.withTimeToFirstChunk;
  const timeToFirstTokenUnavailable = !support.isCapabilitiesLoading && !support.withTimeToFirstToken;
  const displayedPreferences =
    unavailable || timeToFirstChunkUnavailable || timeToFirstTokenUnavailable
      ? {
          ...preferences,
          visibleColumns: preferences.visibleColumns.filter(
            column =>
              !(unavailable && isTraceUsageColumn(column)) &&
              !(timeToFirstChunkUnavailable && column === 'timeToFirstChunk') &&
              !(timeToFirstTokenUnavailable && column === 'timeToFirstToken'),
          ),
        }
      : preferences;
  return {
    displayedPreferences,
    usageEnabled: !unavailable && !metricsSupport.isLoading && hasTraceUsageColumn(displayedPreferences),
    usageDisabledReason: metricsSupport.isLoading
      ? CHECKING_USAGE_REASON
      : !metricsSupport.supported
        ? UNSUPPORTED_USAGE_REASON
        : undefined,
  };
}

/**
 * The order the list runs: a TTFC/TTFT sort the store can't run, or on a column that isn't shown,
 * lists newest first instead. The host keeps its raw value, like filters the server can't query.
 */
export function resolveTracesSort(
  sort: TracesSort,
  support: Pick<TracesSupport, 'withTimeToFirstChunkSort' | 'withTimeToFirstTokenSort'>,
  displayedColumns: TraceColumnPreferences,
): TracesSort {
  const sortable =
    sort.field === 'startedAt' ||
    (sort.field === 'timeToFirstChunkMs' &&
      support.withTimeToFirstChunkSort &&
      hasTraceColumn(displayedColumns, 'timeToFirstChunk')) ||
    (sort.field === 'timeToFirstTokenMs' &&
      support.withTimeToFirstTokenSort &&
      hasTraceColumn(displayedColumns, 'timeToFirstToken'));
  return sortable ? sort : DEFAULT_TRACES_SORT;
}

/** `aggregated` asks the server for aggregated roots; hosts offer it only when the server advertises support. */
export type TracesRootSource = TraceQueryArgs['rootSource'];

/** The flags that decide which filters reach a trace query. */
export type TracesQuerySupport = Pick<
  TracesSupport,
  'withTokenSearch' | 'withRootDuration' | 'withTimeToFirstChunk' | 'withTimeToFirstToken' | 'withOutcomeFields'
>;

type TracesWindow = { filters: TracesFilters; dateFrom?: Date; dateTo?: Date };

/** The trace query behind the list, for the (sanitized) filters and the resolved window. Add the list's `orderBy`. */
export function buildTracesListQuery({
  filters,
  dateFrom,
  dateTo,
  support,
  rootSource,
  now,
}: TracesWindow & { support: TracesQuerySupport; rootSource?: TracesRootSource; now: Date }): TraceQueryArgs {
  const query = buildTracesQueryRequest({
    filters,
    dateFrom,
    dateTo,
    withTokenSearch: support.withTokenSearch,
    withRootDuration: support.withRootDuration,
    withTimeToFirstChunk: support.withTimeToFirstChunk,
    withTimeToFirstToken: support.withTimeToFirstToken,
    withOutcomeFields: support.withOutcomeFields,
    now,
  });
  return { ...query, ...(rootSource === 'aggregated' ? { rootSource } : {}) };
}

/** The `listTracesLight` filters, for servers without the trace query API. */
export const buildTracesListLegacyFilters = (window: TracesWindow) => buildTracesLegacyFilters(window);

/** The aggregate request behind the histogram: the list's filters and window, one bucket per bar. */
export function buildTracesHistogramRequest({
  filters,
  dateFrom,
  dateTo,
  support,
  now,
}: TracesWindow & { support: TracesQuerySupport; now: Date }): AggregateTracesArgs & {
  timeRange: { from: string; to: string };
} {
  const { timeRange, where } = buildTracesQueryRequest({
    filters,
    dateFrom,
    dateTo,
    withTokenSearch: support.withTokenSearch,
    withRootDuration: support.withRootDuration,
    withTimeToFirstChunk: support.withTimeToFirstChunk,
    withTimeToFirstToken: support.withTimeToFirstToken,
    withOutcomeFields: support.withOutcomeFields,
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
}

/**
 * Whether the histogram counts the list's traces over `timeRange`. It doesn't for aggregated roots, when
 * the server can't aggregate traces, when the window is wider than it aggregates, or when the filters ask
 * for `running` traces: the query drops that status, so the counts wouldn't match the list.
 */
export const canShowTracesHistogram = ({
  runningSelected,
  support,
  rootSource,
  timeRange,
}: {
  /** The host's filters ask for `running` traces (`selectsRunningStatus` of its raw filters). */
  runningSelected: boolean;
  support: Pick<TracesSupport, 'withQueryTrace' | 'withTraceAggregate'>;
  rootSource?: TracesRootSource;
  timeRange: { from: string; to: string };
}) =>
  rootSource !== 'aggregated' &&
  support.withQueryTrace &&
  support.withTraceAggregate &&
  !runningSelected &&
  !exceedsAggregateWindow(timeRange);

/** Storage id of the list's column order: each kind of list keeps its own. */
export const tracesListIdForScope = (scope?: TracesExplorerScope) =>
  scope?.entityType === EntityType.AGENT
    ? 'agent-traces'
    : scope?.entityType === EntityType.WORKFLOW_RUN
      ? 'workflows-traces'
      : 'all-traces';
