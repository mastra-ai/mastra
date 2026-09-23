import {
  TRACE_AGGREGATE_COUNT_DISTINCT_PREFIX,
  TRACE_AGGREGATE_INTERVALS,
  TRACE_AGGREGATE_MAX_TIME_RANGE_DAYS,
} from './trace-aggregate';
import type { NormalizedTraceAggregateRequest, TraceAggregateInterval, TraceAggregateMeasure } from './trace-aggregate';
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
 * requested measures or dimensions, the 365-day window, and the 1000-bucket cap. Only
 * allowlisted identifiers and finite numeric literals reach the plan.
 */

export const TRACE_AGGREGATE_MAX_BUCKETS = 1000;

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

export type TrustedTraceAggregateHavingPredicate =
  | { type: 'comparison'; measure: TraceAggregateMeasure; operator: TraceQueryComparisonOperator; value: number }
  | { type: 'membership'; measure: TraceAggregateMeasure; operator: TraceQueryMembershipOperator; values: number[] }
  | { type: 'boolean'; operator: 'and' | 'or'; args: TrustedTraceAggregateHavingPredicate[] }
  | { type: 'not'; arg: TrustedTraceAggregateHavingPredicate };

export type TrustedTraceAggregateOrderBy =
  | {
      target: 'measure';
      /**
       * A requested measure, or `count`. `count` is always orderable because it is the schema
       * default; when it is not in `measures`, backends compute it for ordering without
       * projecting it into the response (Decision 11).
       */
      measure: TraceAggregateMeasure;
      direction: 'asc' | 'desc';
    }
  | { target: 'dimension'; dimension: TraceAggregateDimension; direction: 'asc' | 'desc' };

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
  limit: number;
}

type IssuePath = Array<string | number>;

interface HavingState {
  nodes: number;
  issues: TraceQueryIssue[];
  measureNames: Set<string>;
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
  const rangeMs = to.getTime() - from.getTime();
  if (from >= to) {
    issues.push({ code: 'invalid_time_range', path: ['timeRange'], message: '`from` must be earlier than `to`' });
  } else if (rangeMs > TRACE_AGGREGATE_MAX_TIME_RANGE_DAYS * 24 * 60 * 60 * 1000) {
    issues.push({
      code: 'time_range_too_large',
      path: ['timeRange'],
      message: `The time range cannot exceed ${TRACE_AGGREGATE_MAX_TIME_RANGE_DAYS} days`,
    });
  } else if (
    request.interval &&
    rangeMs / TRACE_AGGREGATE_INTERVAL_MS[request.interval] > TRACE_AGGREGATE_MAX_BUCKETS
  ) {
    const smallest = TRACE_AGGREGATE_INTERVALS.find(
      interval => rangeMs / TRACE_AGGREGATE_INTERVAL_MS[interval] <= TRACE_AGGREGATE_MAX_BUCKETS,
    );
    issues.push({
      code: 'too_many_buckets',
      path: ['interval'],
      message: `The interval produces more than ${TRACE_AGGREGATE_MAX_BUCKETS} buckets; the smallest permitted interval is ${smallest}`,
    });
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
  const measureNames = new Set<string>();
  request.measures.forEach((raw, index) => {
    const path: IssuePath = ['measures', index];
    const measure = planMeasure(raw, path, issues);
    if (!measure) return;
    if (measureNames.has(measure.name)) {
      issues.push({ code: 'invalid_request', path, message: 'Measures must be distinct' });
      return;
    }
    measureNames.add(measure.name);
    measures.push(measure);
  });

  const having = request.having
    ? planHaving(request.having, ['having'], 1, { nodes: 0, issues, measureNames })
    : undefined;

  const orderBy = planOrderBy(request.orderBy, measureNames, dimensions, issues);

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

function planMeasure(
  raw: string,
  path: IssuePath,
  issues: TraceQueryIssue[],
): TrustedTraceAggregateMeasure | undefined {
  const name = raw.startsWith(TRACE_AGGREGATE_COUNT_DISTINCT_PREFIX)
    ? `${TRACE_AGGREGATE_COUNT_DISTINCT_PREFIX}${normalizeTraceQueryPath(raw.slice(TRACE_AGGREGATE_COUNT_DISTINCT_PREFIX.length))}`
    : raw;
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

function resolveHavingMeasure(raw: string, path: IssuePath, state: HavingState): TraceAggregateMeasure | undefined {
  const name = normalizeTraceQueryPath(raw);
  if (state.measureNames.has(name)) return name as TraceAggregateMeasure;
  state.issues.push({ code: 'field_not_allowed', path, message: 'having may only reference requested measures' });
  return undefined;
}

function planOrderBy(
  orderBy: NormalizedTraceAggregateRequest['orderBy'],
  measureNames: Set<string>,
  dimensions: TraceAggregateDimension[],
  issues: TraceQueryIssue[],
): TrustedTraceAggregateOrderBy | undefined {
  const field = normalizeTraceQueryPath(orderBy.field);
  if (field === 'count' || measureNames.has(field)) {
    return { target: 'measure', measure: field as TraceAggregateMeasure, direction: orderBy.direction };
  }
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
