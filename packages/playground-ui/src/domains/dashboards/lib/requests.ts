import type { AggregateSpansArgs, AggregateTracesArgs, DashboardQuery, MastraClient } from '@mastra/client-js';
import type { MetricsQueryFilters } from '@mastra/react/hooks/metrics';
import { AGGREGATE_PRIORITY } from '../../metrics/lib/request-limiter';
import type { AggregatePriority } from '../../metrics/lib/request-limiter';
import { previousWindow } from '../../metrics/lib/time-window';
import { toTraceAggregateTimeRange } from '../../metrics/lib/trace-aggregate';
import { intersectFilters } from './filters';

type Window = { start: Date; end: Date };
type Args<M extends keyof MastraClient> = MastraClient[M] extends (args: infer A, ...rest: never[]) => unknown
  ? A
  : never;

type Call =
  | { method: 'aggregateTraces'; args: AggregateTracesArgs; priority?: AggregatePriority }
  | { method: 'aggregateSpans'; args: AggregateSpansArgs; priority?: AggregatePriority }
  | { method: 'getMetricAggregate'; args: Args<'getMetricAggregate'> }
  | { method: 'getMetricBreakdown'; args: Args<'getMetricBreakdown'> }
  | { method: 'getMetricTimeSeries'; args: Args<'getMetricTimeSeries'> }
  | { method: 'getMetricPercentiles'; args: Args<'getMetricPercentiles'> }
  | { method: 'getScoreAggregate'; args: Args<'getScoreAggregate'> }
  | { method: 'getScoreBreakdown'; args: Args<'getScoreBreakdown'> }
  | { method: 'getScoreTimeSeries'; args: Args<'getScoreTimeSeries'> }
  | { method: 'getScorePercentiles'; args: Args<'getScorePercentiles'> };

/** One call a dashboard query makes, with the args it sends. */
export type DashboardRequest = Call & {
  /** Its filters contradict the page's, so nothing can match: it isn't sent and answers empty. */
  unsatisfiable?: true;
};

export type DashboardRequestMethod = DashboardRequest['method'];

type TraceWhere = NonNullable<AggregateTracesArgs['where']>;
type SpanWhere = NonNullable<AggregateSpansArgs['where']>;

/** What the page adds to every widget's query: its frozen window and its filter bar. */
export type DashboardPageContext = {
  window: Window;
  /** The page's metrics and scores filters, `timestamp` included. */
  filters: MetricsQueryFilters['filters'];
  /** The filter bar as trace and span predicates, from the aggregate gates. */
  traceWhere?: TraceWhere;
  spanWhere?: SpanWhere;
};

/** How the widget kind sends a query. */
export type DashboardRequestOptions = {
  /** The bucket size, for a query that doesn't set its own. Unset sends the query as written. */
  interval?: '1h' | '1d';
};

/** The widget's predicate and the page's, both required; the widget's comes first. */
function and<P extends object>(widget: P | undefined, page: P | undefined): P | undefined {
  if (widget && page) return { op: 'and', args: [widget, page] } as unknown as P;
  return widget ?? page;
}

const METRICS_METHOD = {
  aggregate: 'getMetricAggregate',
  breakdown: 'getMetricBreakdown',
  timeSeries: 'getMetricTimeSeries',
  percentiles: 'getMetricPercentiles',
} as const;

const SCORES_METHOD = {
  aggregate: 'getScoreAggregate',
  breakdown: 'getScoreBreakdown',
  timeSeries: 'getScoreTimeSeries',
  percentiles: 'getScorePercentiles',
} as const;

const BUCKETED_REQUESTS = new Set(['timeSeries', 'percentiles']);

/**
 * The request a query sends over `window`, the page's filters ANDed with the widget's: trace and span
 * predicates are joined with `and`; metrics and scores filters intersect (`intersectFilters`), and a
 * contradiction marks the request unsatisfiable. Scores queries without a scorer are expanded by the
 * `scores` kind before they get here.
 */
export function buildRequest(
  query: DashboardQuery,
  page: DashboardPageContext,
  { interval }: DashboardRequestOptions,
  window: Window = page.window,
  priority?: AggregatePriority,
): DashboardRequest {
  if (query.source === 'traceAggregate' || query.source === 'spanAggregate') {
    const { source, compare: _compare, where, interval: own, ...rest } = query;
    const bucket = own ?? interval;
    const shared = { timeRange: toTraceAggregateTimeRange(window), ...rest, ...(bucket ? { interval: bucket } : {}) };
    if (source === 'traceAggregate') {
      const combined = and(where as TraceWhere | undefined, page.traceWhere);
      return {
        method: 'aggregateTraces',
        args: { ...shared, ...(combined ? { where: combined } : {}) } as AggregateTracesArgs,
        ...(priority === undefined ? {} : { priority }),
      };
    }
    const combined = and(where as SpanWhere | undefined, page.spanWhere);
    return {
      method: 'aggregateSpans',
      args: { ...shared, ...(combined ? { where: combined } : {}) } as AggregateSpansArgs,
      ...(priority === undefined ? {} : { priority }),
    };
  }

  const { source, request, compare, filters, ...rest } = query;
  const own = 'interval' in rest ? rest.interval : undefined;
  const bucket = own ?? (BUCKETED_REQUESTS.has(request) ? interval : undefined);
  // An aggregate compares in the same request; anything else sends a second one over `window`.
  const comparePeriod = request === 'aggregate' && compare === 'previousWindow' ? 'previous_period' : undefined;
  const combined = intersectFilters(page.filters, filters);
  const args = {
    ...rest,
    ...(bucket ? { interval: bucket } : {}),
    filters: { ...(combined ?? page.filters), timestamp: window },
    ...(comparePeriod ? { comparePeriod } : {}),
  };
  const method = source === 'metrics' ? METRICS_METHOD[request] : SCORES_METHOD[request];
  return { method, args, ...(combined ? {} : { unsatisfiable: true }) } as DashboardRequest;
}

/** Whether a query asks for the previous window as a request of its own. */
export function sendsPreviousRequest(query: DashboardQuery) {
  if (query.compare !== 'previousWindow') return false;
  return !((query.source === 'metrics' || query.source === 'scores') && query.request === 'aggregate');
}

/** The previous window's request, sent last so the widget never waits on it. */
export function buildPreviousRequest(
  query: DashboardQuery,
  page: DashboardPageContext,
  options: DashboardRequestOptions,
): DashboardRequest | undefined {
  if (!sendsPreviousRequest(query)) return undefined;
  return buildRequest(query, page, options, previousWindow(page.window), AGGREGATE_PRIORITY.last);
}

const EMPTY_ANSWER: Record<DashboardRequestMethod, unknown> = {
  aggregateTraces: { rows: [] },
  aggregateSpans: { rows: [] },
  getMetricAggregate: { value: null },
  getMetricBreakdown: { groups: [] },
  getMetricTimeSeries: { series: [] },
  getMetricPercentiles: { series: [] },
  getScoreAggregate: { value: null },
  getScoreBreakdown: { groups: [] },
  getScoreTimeSeries: { series: [] },
  getScorePercentiles: { series: [] },
};

/** Runs a request on the client; an unsatisfiable one answers empty without a call. */
export function sendRequest(client: MastraClient, request: DashboardRequest): Promise<unknown> {
  if (request.unsatisfiable) return Promise.resolve(EMPTY_ANSWER[request.method]);
  switch (request.method) {
    case 'aggregateTraces':
      return client.aggregateTraces(request.args);
    case 'aggregateSpans':
      return client.aggregateSpans(request.args);
    case 'getMetricAggregate':
      return client.getMetricAggregate(request.args);
    case 'getMetricBreakdown':
      return client.getMetricBreakdown(request.args);
    case 'getMetricTimeSeries':
      return client.getMetricTimeSeries(request.args);
    case 'getMetricPercentiles':
      return client.getMetricPercentiles(request.args);
    case 'getScoreAggregate':
      return client.getScoreAggregate(request.args);
    case 'getScoreBreakdown':
      return client.getScoreBreakdown(request.args);
    case 'getScoreTimeSeries':
      return client.getScoreTimeSeries(request.args);
    case 'getScorePercentiles':
      return client.getScorePercentiles(request.args);
  }
}

/** The React Query key: trace and span aggregates share `useTraceAggregate`'s, so other cards reuse them. */
export function requestKey(request: DashboardRequest): readonly unknown[] {
  if (request.method === 'aggregateTraces') return ['trace-aggregate', request.args];
  if (request.method === 'aggregateSpans') return ['span-aggregate', request.args];
  if (request.unsatisfiable) return ['dashboards', 'unsatisfiable', request.method];
  return ['dashboards', request.method, request.args];
}

/** Whether a query needs the trace or span aggregate gate. */
export const aggregateSource = (query: DashboardQuery) =>
  query.source === 'traceAggregate' ? 'trace' : query.source === 'spanAggregate' ? 'span' : undefined;
