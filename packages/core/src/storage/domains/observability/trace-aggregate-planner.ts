import {
  TRACE_AGGREGATE_COUNT_DISTINCT_PREFIX,
  TRACE_AGGREGATE_INTERVALS,
  TRACE_AGGREGATE_MAX_TIME_RANGE_DAYS,
} from './trace-aggregate';
import type { NormalizedTraceAggregateRequest, TraceAggregateInterval } from './trace-aggregate';
import { isTraceAggregateDimension, parseTraceAggregateMeasure } from './trace-aggregate-registry';
import type {
  TraceAggregateCanonicalMeasure,
  TraceAggregateCountDistinctField,
  TraceAggregateCountDistinctMeasure,
  TraceAggregateDimension,
} from './trace-aggregate-registry';
import {
  normalizeTraceQueryPath,
  normalizeTraceQueryTenantScope,
  planTraceQuerySelectionPredicate,
  TRACE_QUERY_MAX_DEPTH,
  TRACE_QUERY_MAX_NODES,
  TRACE_QUERY_PREDICATE_COMPLEXITY_MESSAGE,
  TraceQueryValidationError,
} from './trace-query';
import type {
  TraceQueryComparisonOperator,
  TraceQueryIssue,
  TraceQueryLiteral,
  TraceQueryMembershipOperator,
  TraceQueryPathOrLiteral,
  TraceQueryPlanOptions,
  TraceQueryScalarPredicate,
  TraceQueryTenantScope,
  TrustedTraceQueryPredicate,
} from './trace-query';

/**
 * Trusted, backend-independent plan for `aggregateTraces()` (Aggregate Query API Decision 8).
 *
 * `planTraceAggregate` enforces everything the request schema leaves to the planner: the
 * groupable-dimension allowlist, `countDistinct` targets, `having` / `orderBy` referencing
 * requested measures or dimensions, the 365-day window, the 1000-bucket cap, and the 10,000-row
 * cap. Only allowlisted identifiers and finite numeric literals reach the plan.
 */

export const TRACE_AGGREGATE_MAX_BUCKETS = 1000;

/** Upper bound on `limit × bucket count` when `interval` is present (Decision 5). */
export const TRACE_AGGREGATE_MAX_ROWS = 10_000;

export const TRACE_AGGREGATE_INTERVAL_MS: Record<TraceAggregateInterval, number> = {
  '1m': 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '1d': 24 * 60 * 60_000,
};

export type TrustedTraceAggregateMeasure =
  | { type: 'canonical'; name: TraceAggregateCanonicalMeasure }
  | { type: 'countDistinct'; name: TraceAggregateCountDistinctMeasure; field: TraceAggregateCountDistinctField };

/** A measure name that survived allowlisting; narrower than the request-level `TraceAggregateMeasure`. */
export type TrustedTraceAggregateMeasureName = TrustedTraceAggregateMeasure['name'];

/**
 * Predicate over a group's whole-window measures. `measure` is a requested measure or `count`
 * (always available, Decision 5); when `count` is not in `measures`, backends compute it for
 * filtering without projecting it into the response.
 */
export type TrustedTraceAggregateHavingPredicate =
  | {
      type: 'comparison';
      measure: TrustedTraceAggregateMeasureName;
      operator: TraceQueryComparisonOperator;
      value: number;
    }
  | {
      type: 'membership';
      measure: TrustedTraceAggregateMeasureName;
      operator: TraceQueryMembershipOperator;
      values: number[];
    }
  | { type: 'boolean'; operator: 'and' | 'or'; args: TrustedTraceAggregateHavingPredicate[] }
  | { type: 'not'; arg: TrustedTraceAggregateHavingPredicate };

export type TrustedTraceAggregateOrderBy =
  | {
      target: 'measure';
      /**
       * A requested measure, or `count` (always available, Decision 5). When `count` is not in
       * `measures`, backends compute it for ordering without projecting it into the response.
       */
      measure: TrustedTraceAggregateMeasureName;
      direction: 'asc' | 'desc';
    }
  | { target: 'dimension'; dimension: TraceAggregateDimension; direction: 'asc' | 'desc' };

/**
 * Group semantics every evaluator and store compiler must implement (Decision 5):
 *
 * - A **group** is one distinct tuple of `dimensions` values (null values form their own group).
 *   `having`, `orderBy`, and `limit` operate on groups, never on individual bucket rows.
 * - `having` and `orderBy` are evaluated on each group's measures computed over the **whole**
 *   `timeRange`, even when `interval` is present. `having` applies after grouping and before
 *   ordering and `limit`. `orderBy` ties break on dimension values ascending. `bucket` is never
 *   an ordering target.
 * - Null dimension values sort last in both directions; compilers emit an explicit `NULLS LAST`
 *   where the backend default differs.
 * - An empty population returns `rows: []` with no synthesised zero row, including ungrouped
 *   requests and a `having` that removes every group.
 * - `limit` counts groups. `truncated` is `true` when more groups survived `having` than `limit`.
 * - When `interval` is present, each surviving group expands to one row per non-empty UTC-aligned
 *   bucket (`floor(startedAt / interval)`), emitted in `bucket` ascending order within the group;
 *   empty buckets are omitted, and buckets are never dropped from the middle of a series.
 * - The planner alone enforces the bucket cap and the row cap (`limit × buckets ≤ 10,000`);
 *   backends trust the plan and do not re-check them.
 */
export interface TrustedTraceAggregatePlan {
  result: 'aggregate';
  timeRange: { from: string; to: string };
  where?: TrustedTraceQueryPredicate;
  scope?: TraceQueryTenantScope;
  /** Normalized dimensions in request order (at most two). */
  dimensions: TraceAggregateDimension[];
  interval?: TraceAggregateInterval;
  /** Requested measures in request order; `countDistinct` names are normalized. */
  measures: TrustedTraceAggregateMeasure[];
  having?: TrustedTraceAggregateHavingPredicate;
  orderBy: TrustedTraceAggregateOrderBy;
  /** Maximum number of groups (not rows) in the response. */
  limit: number;
}

/**
 * Number of UTC-aligned buckets a `[from, to)` range touches (Decision 6). A range that does not
 * start on a bucket boundary touches one more bucket than `(to - from) / interval`.
 */
export function countTraceAggregateBuckets(fromMs: number, toMs: number, interval: TraceAggregateInterval): number {
  const intervalMs = TRACE_AGGREGATE_INTERVAL_MS[interval];
  return Math.floor((toMs - 1) / intervalMs) - Math.floor(fromMs / intervalMs) + 1;
}

type IssuePath = Array<string | number>;

interface HavingState {
  nodes: number;
  issues: TraceQueryIssue[];
  measureNames: Map<string, TrustedTraceAggregateMeasureName>;
}

/**
 * Converts a structurally valid aggregate request into the canonical plan consumed by
 * observability storage adapters.
 *
 * @internal This is a trusted server/storage boundary, not a client-side query builder.
 */
export function planTraceAggregate(
  request: NormalizedTraceAggregateRequest,
  options: Pick<TraceQueryPlanOptions, 'scope'> = {},
): TrustedTraceAggregatePlan {
  const issues: TraceQueryIssue[] = [];

  const from = new Date(request.timeRange.from);
  const to = new Date(request.timeRange.to);
  const fromMs = from.getTime();
  const toMs = to.getTime();
  if (fromMs >= toMs) {
    issues.push({ code: 'invalid_time_range', path: ['timeRange'], message: '`from` must be earlier than `to`' });
  } else if (toMs - fromMs > TRACE_AGGREGATE_MAX_TIME_RANGE_DAYS * 24 * 60 * 60 * 1000) {
    issues.push({
      code: 'time_range_too_large',
      path: ['timeRange'],
      message: `The time range cannot exceed ${TRACE_AGGREGATE_MAX_TIME_RANGE_DAYS} days`,
    });
  } else if (request.interval) {
    const buckets = countTraceAggregateBuckets(fromMs, toMs, request.interval);
    if (buckets > TRACE_AGGREGATE_MAX_BUCKETS) {
      const smallest = TRACE_AGGREGATE_INTERVALS.find(
        interval => countTraceAggregateBuckets(fromMs, toMs, interval) <= TRACE_AGGREGATE_MAX_BUCKETS,
      );
      issues.push({
        code: 'too_many_buckets',
        path: ['interval'],
        message: `The interval produces more than ${TRACE_AGGREGATE_MAX_BUCKETS} buckets; the smallest permitted interval is ${smallest}`,
      });
    } else if (request.limit * buckets > TRACE_AGGREGATE_MAX_ROWS) {
      issues.push({
        code: 'too_many_rows',
        path: ['limit'],
        message: `limit × buckets cannot exceed ${TRACE_AGGREGATE_MAX_ROWS} rows; lower limit or widen interval`,
      });
    }
  }

  const where = request.where ? planTraceQuerySelectionPredicate(request.where, issues) : undefined;

  const dimensions: TraceAggregateDimension[] = [];
  request.groupBy.forEach((raw, index) => {
    const path: IssuePath = ['groupBy', index];
    const dimension = normalizeTraceQueryPath(raw);
    if (!isTraceAggregateDimension(dimension)) {
      issues.push(
        dimension.startsWith('metadata.')
          ? { code: 'invalid_metadata_key', path, message: 'Metadata dimensions require one non-empty top-level key' }
          : { code: 'field_not_allowed', path, message: 'The field cannot be used as a dimension' },
      );
      return;
    }
    if (dimensions.includes(dimension)) {
      issues.push({ code: 'invalid_request', path, message: 'Dimensions must be distinct' });
      return;
    }
    dimensions.push(dimension);
  });

  const measures: TrustedTraceAggregateMeasure[] = [];
  const measureNames = new Map<string, TrustedTraceAggregateMeasureName>();
  request.measures.forEach((raw, index) => {
    const path: IssuePath = ['measures', index];
    const measure = planMeasure(raw, path, issues);
    if (!measure) return;
    if (measureNames.has(measure.name)) {
      issues.push({ code: 'invalid_request', path, message: 'Measures must be distinct' });
      return;
    }
    measureNames.set(measure.name, measure.name);
    measures.push(measure);
  });

  // `count` is always available to `having` and `orderBy`, requested or not (Decision 5).
  const referenceable = new Map(measureNames).set('count', 'count');

  const having = request.having
    ? planHaving(request.having, ['having'], 1, { nodes: 0, issues, measureNames: referenceable })
    : undefined;

  const orderBy = planOrderBy(request.orderBy, referenceable, dimensions, issues);

  if (issues.length > 0 || !orderBy) throw new TraceQueryValidationError(issues);

  return {
    result: 'aggregate',
    timeRange: { from: from.toISOString(), to: to.toISOString() },
    where,
    scope: normalizeTraceQueryTenantScope(options.scope),
    dimensions,
    interval: request.interval,
    measures,
    having,
    orderBy,
    limit: request.limit,
  };
}

/**
 * Normalizes a measure name identically for `measures`, `having` paths, and `orderBy.field`, so
 * `countDistinct.${threadId}` and `countDistinct.threadId` resolve to the same requested measure.
 */
function normalizeTraceAggregateMeasureName(raw: string): string {
  const unwrapped = normalizeTraceQueryPath(raw);
  return unwrapped.startsWith(TRACE_AGGREGATE_COUNT_DISTINCT_PREFIX)
    ? `${TRACE_AGGREGATE_COUNT_DISTINCT_PREFIX}${normalizeTraceQueryPath(unwrapped.slice(TRACE_AGGREGATE_COUNT_DISTINCT_PREFIX.length))}`
    : unwrapped;
}

function planMeasure(
  raw: string,
  path: IssuePath,
  issues: TraceQueryIssue[],
): TrustedTraceAggregateMeasure | undefined {
  const name = normalizeTraceAggregateMeasureName(raw);
  const parsed = parseTraceAggregateMeasure(name);
  if (parsed?.type === 'canonical') return { type: 'canonical', name: parsed.measure };
  if (parsed?.type === 'countDistinct') {
    return {
      type: 'countDistinct',
      name: `${TRACE_AGGREGATE_COUNT_DISTINCT_PREFIX}${parsed.field}`,
      field: parsed.field,
    };
  }
  const field = name.slice(TRACE_AGGREGATE_COUNT_DISTINCT_PREFIX.length);
  issues.push(
    name.startsWith(TRACE_AGGREGATE_COUNT_DISTINCT_PREFIX) && field.startsWith('metadata.')
      ? {
          code: 'invalid_metadata_key',
          path,
          message: 'countDistinct over metadata requires one non-empty top-level key',
        }
      : { code: 'field_not_allowed', path, message: 'The measure is not supported' },
  );
  return undefined;
}

function planHaving(
  predicate: TraceQueryScalarPredicate,
  path: IssuePath,
  depth: number,
  state: HavingState,
): TrustedTraceAggregateHavingPredicate | undefined {
  state.nodes += 1;
  if (depth > TRACE_QUERY_MAX_DEPTH || state.nodes > TRACE_QUERY_MAX_NODES) {
    if (!state.issues.some(issue => issue.code === 'predicate_too_complex')) {
      state.issues.push({ code: 'predicate_too_complex', path, message: TRACE_QUERY_PREDICATE_COMPLEXITY_MESSAGE });
    }
    return undefined;
  }

  if (predicate.op === 'and' || predicate.op === 'or') {
    const args = predicate.args
      .map((arg, index) => planHaving(arg, [...path, 'args', index], depth + 1, state))
      .filter((arg): arg is TrustedTraceAggregateHavingPredicate => arg !== undefined);
    return { type: 'boolean', operator: predicate.op, args };
  }
  if (predicate.op === 'not') {
    const arg = planHaving(predicate.arg, [...path, 'arg'], depth + 1, state);
    return arg ? { type: 'not', arg } : undefined;
  }

  if (predicate.op === 'exists' || predicate.op === 'notExists') {
    state.issues.push({
      code: 'operator_not_allowed',
      path: [...path, 'op'],
      message: 'Presence operators are not supported in having; measures are always present',
    });
    return undefined;
  }

  if (predicate.op === 'in' || predicate.op === 'notIn') {
    if (!('path' in predicate.value)) {
      state.issues.push({
        code: 'invalid_operands',
        path: [...path, 'value'],
        message: 'Membership predicates in having require a requested measure name',
      });
      return undefined;
    }
    const measure = resolveHavingMeasure(predicate.value.path, [...path, 'value', 'path'], state);
    if (!measure) return undefined;
    const values = predicate.set.map(toFiniteNumber);
    if (values.some(value => value === undefined)) {
      state.issues.push({
        code: 'invalid_literal',
        path: [...path, 'set'],
        message: 'Membership values in having must be finite numbers',
      });
      return undefined;
    }
    return { type: 'membership', measure, operator: predicate.op, values: values as number[] };
  }

  const comparison = predicate as Extract<TraceQueryScalarPredicate, { left: TraceQueryPathOrLiteral }>;
  if (!('path' in comparison.left) || !('literal' in comparison.right)) {
    state.issues.push({
      code: 'invalid_operands',
      path,
      message: 'Comparison predicates in having require a measure on the left and a literal on the right',
    });
    return undefined;
  }
  const measure = resolveHavingMeasure(comparison.left.path, [...path, 'left', 'path'], state);
  if (!measure) return undefined;
  const value = toFiniteNumber(comparison.right.literal);
  if (value === undefined) {
    state.issues.push({
      code: 'invalid_literal',
      path: [...path, 'right', 'literal'],
      message: 'Comparison literals in having must be finite numbers',
    });
    return undefined;
  }
  return { type: 'comparison', measure, operator: comparison.op, value };
}

function resolveHavingMeasure(
  raw: string,
  path: IssuePath,
  state: HavingState,
): TrustedTraceAggregateMeasureName | undefined {
  const measure = state.measureNames.get(normalizeTraceAggregateMeasureName(raw));
  if (measure) return measure;
  state.issues.push({
    code: 'field_not_allowed',
    path,
    message: 'having may only reference requested measures or count',
  });
  return undefined;
}

function planOrderBy(
  orderBy: NormalizedTraceAggregateRequest['orderBy'],
  measureNames: Map<string, TrustedTraceAggregateMeasureName>,
  dimensions: TraceAggregateDimension[],
  issues: TraceQueryIssue[],
): TrustedTraceAggregateOrderBy | undefined {
  const field = normalizeTraceAggregateMeasureName(orderBy.field);
  const measure = measureNames.get(field);
  if (measure) return { target: 'measure', measure, direction: orderBy.direction };
  const dimension = dimensions.find(candidate => candidate === field);
  if (dimension) return { target: 'dimension', dimension, direction: orderBy.direction };
  issues.push({
    code: 'field_not_allowed',
    path: ['orderBy', 'field'],
    message: 'orderBy must reference a requested measure, count, or a requested dimension',
  });
  return undefined;
}

function toFiniteNumber(value: TraceQueryLiteral): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
