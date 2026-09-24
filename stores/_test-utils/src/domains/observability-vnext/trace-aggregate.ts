import {
  compareTraceQueryStrings,
  isTraceAggregateCanonicalDimension,
  parseTraceAggregateRequest,
  planTraceAggregate,
  TRACE_AGGREGATE_INTERVAL_MS,
  type TraceAggregateCountDistinctField,
  type TraceAggregateDimension,
  type TraceAggregateRequest,
  type TraceAggregateResponse,
  type TraceAggregateRow,
  type TraceQueryTenantScope,
  type TrustedTraceAggregateHavingPredicate,
  type TrustedTraceAggregateMeasureName,
  type TrustedTraceAggregatePlan,
} from '@mastra/core/storage';

import { selectTraceQueryRoots, type RawTraceQuerySpan, type TraceQueryFixtureData } from './trace-query';

/**
 * In-memory reference evaluator for `TrustedTraceAggregatePlan` (Aggregate Query API Decision 5).
 *
 * Candidate traces come from `selectTraceQueryRoots`, so this evaluator aggregates exactly the
 * population `evaluateTraceQuery` paginates (Decision 2). Groups are distinct dimension tuples;
 * `having`, `orderBy`, and `limit` act on whole-window group measures, and only the surviving
 * groups expand into bucket rows. The planner alone enforces bucket/row caps — nothing is
 * re-checked here.
 */

const METADATA_PREFIX = 'metadata.';

export function traceAggregateDimensionValue(
  root: RawTraceQuerySpan,
  dimension: TraceAggregateDimension,
): string | null {
  if (!isTraceAggregateCanonicalDimension(dimension)) {
    const value = root.metadata?.[dimension.slice(METADATA_PREFIX.length)];
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  switch (dimension) {
    case 'status':
      return root.error === null ? 'success' : 'error';
    case 'entityType':
      return root.entityType;
    case 'entityName':
      return root.entityName;
    case 'environment':
      return root.environment;
    case 'threadId':
      return root.threadId;
    case 'resourceId':
      return root.resourceId;
    case 'organizationId':
      return root.organizationId;
    case 'serviceName':
      return root.serviceName ?? null;
    case 'executionSource':
      return root.executionSource ?? null;
    case 'userId':
      return root.userId ?? null;
    case 'sessionId':
      return root.sessionId ?? null;
    case 'experimentId':
      return root.experimentId ?? null;
  }
}

/** Linear interpolation between order statistics (`percentile_cont` / `quantile_cont` semantics). */
export function traceAggregatePercentile(sortedValues: number[], p: number): number {
  const rank = (sortedValues.length - 1) * p;
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  const lowerValue = sortedValues[lower]!;
  const upperValue = sortedValues[upper]!;
  return lowerValue + (rank - lower) * (upperValue - lowerValue);
}

function countDistinctValue(root: RawTraceQuerySpan, field: TraceAggregateCountDistinctField): string | null {
  return field === 'traceId' ? root.traceId : traceAggregateDimensionValue(root, field);
}

function durationMs(root: RawTraceQuerySpan): number {
  return Date.parse(root.endedAt!) - Date.parse(root.startedAt);
}

type MeasureValues = Map<TrustedTraceAggregateMeasureName, number>;

function computeMeasures(roots: RawTraceQuerySpan[], plan: TrustedTraceAggregatePlan): MeasureValues {
  const values: MeasureValues = new Map();
  const count = roots.length;
  const errorCount = roots.filter(root => root.error !== null).length;
  let sortedDurations: number[] | undefined;
  const durations = () => (sortedDurations ??= roots.map(durationMs).sort((a, b) => a - b));

  values.set('count', count);
  for (const measure of plan.measures) {
    if (measure.type === 'countDistinct') {
      const distinct = new Set<string>();
      for (const root of roots) {
        const value = countDistinctValue(root, measure.field);
        if (value !== null) distinct.add(value);
      }
      values.set(measure.name, distinct.size);
      continue;
    }
    switch (measure.name) {
      case 'count':
        break;
      case 'errorCount':
        values.set(measure.name, errorCount);
        break;
      case 'errorRate':
        values.set(measure.name, count === 0 ? 0 : errorCount / count);
        break;
      case 'duration.avg':
        values.set(measure.name, durations().reduce((sum, value) => sum + value, 0) / count);
        break;
      case 'duration.min':
        values.set(measure.name, durations()[0]!);
        break;
      case 'duration.max':
        values.set(measure.name, durations()[count - 1]!);
        break;
      case 'duration.p50':
        values.set(measure.name, traceAggregatePercentile(durations(), 0.5));
        break;
      case 'duration.p90':
        values.set(measure.name, traceAggregatePercentile(durations(), 0.9));
        break;
      case 'duration.p95':
        values.set(measure.name, traceAggregatePercentile(durations(), 0.95));
        break;
      case 'duration.p99':
        values.set(measure.name, traceAggregatePercentile(durations(), 0.99));
        break;
    }
  }
  return values;
}

function evaluateHaving(predicate: TrustedTraceAggregateHavingPredicate, measures: MeasureValues): boolean {
  switch (predicate.type) {
    case 'boolean':
      return predicate.operator === 'and'
        ? predicate.args.every(arg => evaluateHaving(arg, measures))
        : predicate.args.some(arg => evaluateHaving(arg, measures));
    case 'not':
      return !evaluateHaving(predicate.arg, measures);
    case 'membership': {
      const value = measures.get(predicate.measure)!;
      const member = predicate.values.includes(value);
      return predicate.operator === 'in' ? member : !member;
    }
    case 'comparison': {
      const value = measures.get(predicate.measure)!;
      switch (predicate.operator) {
        case 'eq':
          return value === predicate.value;
        case 'ne':
          return value !== predicate.value;
        case 'lt':
          return value < predicate.value;
        case 'lte':
          return value <= predicate.value;
        case 'gt':
          return value > predicate.value;
        case 'gte':
          return value >= predicate.value;
      }
    }
  }
}

interface Group {
  dimensions: (string | null)[];
  roots: RawTraceQuerySpan[];
  measures: MeasureValues;
}

/** Nulls sort after every non-null value regardless of direction; only non-null pairs honor `direction`. */
function compareNullable(
  left: string | number | null,
  right: string | number | null,
  direction: 'asc' | 'desc',
): number {
  if (left === null || right === null) {
    if (left === right) return 0;
    return left === null ? 1 : -1;
  }
  const order = typeof left === 'number' ? left - (right as number) : compareTraceQueryStrings(left, right as string);
  return direction === 'desc' ? -order : order;
}

function compareGroups(left: Group, right: Group, plan: TrustedTraceAggregatePlan): number {
  const orderBy = plan.orderBy;
  const primary =
    orderBy.target === 'measure'
      ? compareNullable(left.measures.get(orderBy.measure)!, right.measures.get(orderBy.measure)!, orderBy.direction)
      : compareNullable(
          left.dimensions[plan.dimensions.indexOf(orderBy.dimension)]!,
          right.dimensions[plan.dimensions.indexOf(orderBy.dimension)]!,
          orderBy.direction,
        );
  if (primary !== 0) return primary;
  for (let index = 0; index < plan.dimensions.length; index += 1) {
    const order = compareNullable(left.dimensions[index]!, right.dimensions[index]!, 'asc');
    if (order !== 0) return order;
  }
  return 0;
}

function projectMeasures(measures: MeasureValues, plan: TrustedTraceAggregatePlan): TraceAggregateRow['measures'] {
  return Object.fromEntries(
    plan.measures.map(measure => [measure.name, measures.get(measure.name)!]),
  ) as TraceAggregateRow['measures'];
}

function rowDimensions(group: Group, plan: TrustedTraceAggregatePlan): TraceAggregateRow['dimensions'] {
  const dimensions: Record<string, string | null> = {};
  plan.dimensions.forEach((dimension, index) => {
    dimensions[dimension] = group.dimensions[index]!;
  });
  return dimensions;
}

export function evaluateTraceAggregate(
  data: TraceQueryFixtureData,
  plan: TrustedTraceAggregatePlan,
): TraceAggregateResponse {
  const roots = selectTraceQueryRoots(data, plan);

  const groupsByKey = new Map<string, Group>();
  for (const root of roots) {
    const dimensions = plan.dimensions.map(dimension => traceAggregateDimensionValue(root, dimension));
    const key = JSON.stringify(dimensions);
    let group = groupsByKey.get(key);
    if (!group) {
      group = { dimensions, roots: [], measures: new Map() };
      groupsByKey.set(key, group);
    }
    group.roots.push(root);
  }

  const groups = [...groupsByKey.values()];
  for (const group of groups) group.measures = computeMeasures(group.roots, plan);

  const surviving = plan.having ? groups.filter(group => evaluateHaving(plan.having!, group.measures)) : groups;
  surviving.sort((left, right) => compareGroups(left, right, plan));

  const truncated = surviving.length > plan.limit;
  const kept = surviving.slice(0, plan.limit);

  const rows: TraceAggregateRow[] = [];
  for (const group of kept) {
    const dimensions = plan.dimensions.length > 0 ? rowDimensions(group, plan) : undefined;
    if (!plan.interval) {
      rows.push({ ...(dimensions && { dimensions }), measures: projectMeasures(group.measures, plan) });
      continue;
    }
    const intervalMs = TRACE_AGGREGATE_INTERVAL_MS[plan.interval];
    const buckets = new Map<number, RawTraceQuerySpan[]>();
    for (const root of group.roots) {
      const bucketMs = Math.floor(Date.parse(root.startedAt) / intervalMs) * intervalMs;
      const bucket = buckets.get(bucketMs);
      if (bucket) bucket.push(root);
      else buckets.set(bucketMs, [root]);
    }
    for (const bucketMs of [...buckets.keys()].sort((a, b) => a - b)) {
      rows.push({
        ...(dimensions && { dimensions }),
        bucket: new Date(bucketMs).toISOString(),
        measures: projectMeasures(computeMeasures(buckets.get(bucketMs)!, plan), plan),
      });
    }
  }

  return { rows, truncated };
}

export function evaluateTraceAggregateRequest(
  data: TraceQueryFixtureData,
  request: TraceAggregateRequest,
  scope?: TraceQueryTenantScope,
): TraceAggregateResponse {
  return evaluateTraceAggregate(data, planTraceAggregate(parseTraceAggregateRequest(request), { scope }));
}
