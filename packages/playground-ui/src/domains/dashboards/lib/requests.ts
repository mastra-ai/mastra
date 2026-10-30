import type { AggregateSpansArgs, AggregateTracesArgs, DashboardQuery, MastraClient } from '@mastra/client-js';
import type { MetricsQueryFilters } from '@mastra/react/hooks/metrics';
import { bucketPlan } from '../../metrics/lib/metrics-buckets';
import { AGGREGATE_PRIORITY } from '../../metrics/lib/request-limiter';
import type { AggregatePriority } from '../../metrics/lib/request-limiter';
import { previousWindow } from '../../metrics/lib/time-window';
import { toTraceAggregateTimeRange } from '../../metrics/lib/trace-aggregate';
import { intersectFilters } from './filters';

type Window = { start: Date; end: Date };
type Interval = '1h' | '1d';
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

type Answers = { [M in DashboardRequestMethod]: Awaited<ReturnType<MastraClient[M]>> };

/** A request's answer, tagged with the method that produced it so a widget narrows it by `method`. */
export type DashboardAnswer = {
  [M in DashboardRequestMethod]: { method: M; data: Answers[M] };
}[DashboardRequestMethod];

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
  interval?: Interval;
};

/** The widget's predicate and the page's, both required; the widget's comes first. */
function andTrace(widget: TraceWhere | undefined, page: TraceWhere | undefined): TraceWhere | undefined {
  return widget && page ? { op: 'and', args: [widget, page] } : (widget ?? page);
}

function andSpan(widget: SpanWhere | undefined, page: SpanWhere | undefined): SpanWhere | undefined {
  return widget && page ? { op: 'and', args: [widget, page] } : (widget ?? page);
}

type ValuesQuery = Extract<DashboardQuery, { source: 'metrics' | 'scores' }>;

/**
 * A metrics or scores query's args, the page's filters intersected with its own, over `window`;
 * `unsatisfiable` when they contradict.
 */
function valuesArgs<Q extends ValuesQuery>(query: Q, page: DashboardPageContext, window: Window) {
  const { source: _source, id: _id, request, compare, filters, ...rest } = query;
  const combined = intersectFilters(page.filters, filters);
  return {
    unsatisfiable: combined === undefined ? (true as const) : undefined,
    args: {
      ...rest,
      filters: { ...(combined ?? page.filters), timestamp: window },
      // An aggregate compares in the same request; anything else sends a second one over `window`.
      comparePeriod: request === 'aggregate' && compare === 'previousWindow' ? ('previous_period' as const) : undefined,
    },
  };
}

/** A bucketed request's interval: its own, else the kind's, else the bar charts' for `window`. */
function bucketOf<I extends string>(own: I | undefined, interval: Interval | undefined, window: Window) {
  return own ?? interval ?? bucketPlan(window.start, window.end).interval;
}

/**
 * The request a query sends over `window`, the page's filters ANDed with the widget's: trace and span
 * predicates are joined with `and`; metrics and scores filters intersect (`intersectFilters`), and a
 * contradiction marks the request unsatisfiable. A scores query without a scorer sends nothing: the
 * `scores` kind expands it per scorer first.
 */
export function buildRequest(
  query: DashboardQuery,
  page: DashboardPageContext,
  { interval }: DashboardRequestOptions,
  window: Window = page.window,
  priority?: AggregatePriority,
): DashboardRequest | undefined {
  if (query.source === 'traceAggregate') {
    const { source: _source, id: _id, compare: _compare, where, interval: own, ...rest } = query;
    return {
      method: 'aggregateTraces',
      args: {
        timeRange: toTraceAggregateTimeRange(window),
        ...rest,
        interval: own ?? interval,
        where: andTrace(where, page.traceWhere),
      },
      priority,
    };
  }
  if (query.source === 'spanAggregate') {
    const { source: _source, id: _id, compare: _compare, where, interval: own, ...rest } = query;
    return {
      method: 'aggregateSpans',
      args: {
        timeRange: toTraceAggregateTimeRange(window),
        ...rest,
        interval: own ?? interval,
        where: andSpan(where, page.spanWhere),
      },
      priority,
    };
  }
  if (query.source === 'metrics') {
    switch (query.request) {
      case 'aggregate': {
        const { args, unsatisfiable } = valuesArgs(query, page, window);
        return { method: 'getMetricAggregate', args, unsatisfiable };
      }
      case 'breakdown': {
        const { args, unsatisfiable } = valuesArgs(query, page, window);
        return { method: 'getMetricBreakdown', args, unsatisfiable };
      }
      case 'timeSeries': {
        const { args, unsatisfiable } = valuesArgs(query, page, window);
        const bucketed = { ...args, interval: bucketOf(query.interval, interval, window) };
        return { method: 'getMetricTimeSeries', args: bucketed, unsatisfiable };
      }
      case 'percentiles': {
        const { args, unsatisfiable } = valuesArgs(query, page, window);
        const bucketed = { ...args, interval: bucketOf(query.interval, interval, window) };
        return { method: 'getMetricPercentiles', args: bucketed, unsatisfiable };
      }
    }
  }
  const { scorerId } = query;
  if (scorerId === undefined) return undefined;
  switch (query.request) {
    case 'aggregate': {
      const { args, unsatisfiable } = valuesArgs(query, page, window);
      return { method: 'getScoreAggregate', args: { ...args, scorerId }, unsatisfiable };
    }
    case 'breakdown': {
      const { args, unsatisfiable } = valuesArgs(query, page, window);
      return { method: 'getScoreBreakdown', args: { ...args, scorerId }, unsatisfiable };
    }
    case 'timeSeries': {
      const { args, unsatisfiable } = valuesArgs(query, page, window);
      const bucketed = { ...args, scorerId, interval: bucketOf(query.interval, interval, window) };
      return { method: 'getScoreTimeSeries', args: bucketed, unsatisfiable };
    }
    case 'percentiles': {
      const { args, unsatisfiable } = valuesArgs(query, page, window);
      const bucketed = { ...args, scorerId, interval: bucketOf(query.interval, interval, window) };
      return { method: 'getScorePercentiles', args: bucketed, unsatisfiable };
    }
  }
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

/** What an unsatisfiable request answers: nothing matched. */
function emptyAnswer(method: DashboardRequestMethod): DashboardAnswer {
  switch (method) {
    case 'aggregateTraces':
    case 'aggregateSpans':
      return { method, data: { rows: [], truncated: false } };
    case 'getMetricAggregate':
    case 'getScoreAggregate':
      return { method, data: { value: null } };
    case 'getMetricBreakdown':
    case 'getScoreBreakdown':
      return { method, data: { groups: [] } };
    case 'getMetricTimeSeries':
    case 'getMetricPercentiles':
    case 'getScoreTimeSeries':
    case 'getScorePercentiles':
      return { method, data: { series: [] } };
  }
}

/** Runs a request on the client; an unsatisfiable one answers empty without a call. */
export async function sendRequest(client: MastraClient, request: DashboardRequest): Promise<DashboardAnswer> {
  if (request.unsatisfiable) return emptyAnswer(request.method);
  switch (request.method) {
    case 'aggregateTraces':
      return { method: request.method, data: await client.aggregateTraces(request.args) };
    case 'aggregateSpans':
      return { method: request.method, data: await client.aggregateSpans(request.args) };
    case 'getMetricAggregate':
      return { method: request.method, data: await client.getMetricAggregate(request.args) };
    case 'getMetricBreakdown':
      return { method: request.method, data: await client.getMetricBreakdown(request.args) };
    case 'getMetricTimeSeries':
      return { method: request.method, data: await client.getMetricTimeSeries(request.args) };
    case 'getMetricPercentiles':
      return { method: request.method, data: await client.getMetricPercentiles(request.args) };
    case 'getScoreAggregate':
      return { method: request.method, data: await client.getScoreAggregate(request.args) };
    case 'getScoreBreakdown':
      return { method: request.method, data: await client.getScoreBreakdown(request.args) };
    case 'getScoreTimeSeries':
      return { method: request.method, data: await client.getScoreTimeSeries(request.args) };
    case 'getScorePercentiles':
      return { method: request.method, data: await client.getScorePercentiles(request.args) };
  }
}

/**
 * The React Query key. Answers are cached tagged with their method, so they live under the dashboards'
 * own keys rather than `useTraceAggregate`'s, whose entries hold the bare response.
 */
export function requestKey(request: DashboardRequest): readonly unknown[] {
  if (request.unsatisfiable) return ['dashboards', 'unsatisfiable', request.method];
  return ['dashboards', request.method, request.args];
}

/** Whether a query needs the trace or span aggregate gate. */
export const aggregateSource = (query: DashboardQuery) =>
  query.source === 'traceAggregate' ? 'trace' : query.source === 'spanAggregate' ? 'span' : undefined;
