import {
  compareTraceQueryStrings,
  parseTraceAggregateRequest,
  planTraceAggregate,
  TRACE_AGGREGATE_COST_METRIC_NAMES,
  TRACE_AGGREGATE_INTERVAL_MS,
  TRACE_AGGREGATE_MEASURE_REGISTRY,
  TRACE_AGGREGATE_MIXED_COST_UNIT,
  TRACE_AGGREGATE_USAGE_METRIC_NAMES,
  traceAggregateRowSchema,
  type TraceAggregateCountDistinctField,
  type TraceAggregateRequest,
  type TraceAggregateResponse,
  type TraceAggregateRow,
  type TraceAggregateRowCost,
  type TraceQueryTenantScope,
  type TrustedTraceAggregateHavingPredicate,
  type TrustedTraceAggregateMeasureName,
  type TrustedTraceAggregatePlan,
} from '@mastra/core/storage';
import { TokenMetrics } from '@mastra/core/observability';

import {
  makeTraceQuerySpan as span,
  matchesScope,
  selectTraceQueryRoots,
  traceQueryDimensionValue,
  type RawTraceQuerySpan,
  type TraceQueryFixtureData,
} from './trace-query';

/**
 * In-memory reference evaluator for `TrustedTraceAggregatePlan`.
 *
 * Candidate traces come from `selectTraceQueryRoots`, so this evaluator aggregates exactly the
 * population `evaluateTraceQuery` paginates. Groups are distinct dimension tuples;
 * `having`, `orderBy`, and `limit` act on whole-window group measures, and only the surviving
 * groups expand into bucket rows. The planner alone enforces bucket/row caps — nothing is
 * re-checked here.
 *
 * Token and cost measures read `metrics` rows: usage is first summed per
 * candidate trace (`computeTraceUsage`), then per group. See the `TrustedTraceAggregatePlan`
 * JSDoc in core for the contract this implements.
 */

/** Storage-shaped subset of a `metric_events` row (`CreateMetricRecord`) that usage aggregation reads. */
export interface RawTraceAggregateMetric {
  metricId: string;
  timestamp: string;
  traceId: string | null;
  spanId: string | null;
  name: string;
  value: number;
  estimatedCost: number | null;
  costUnit: string | null;
  costMetadata: Record<string, unknown> | null;
  provider: string | null;
  model: string | null;
  organizationId: string | null;
  resourceId: string | null;
}

/** Trace-query fixture data plus the token metric rows correlated to its traces by `traceId`. */
export type TraceAggregateFixtureData = TraceQueryFixtureData & { metrics?: RawTraceAggregateMetric[] };

interface TraceUsage {
  /** Sum of `value` per token metric name. */
  tokens: Map<string, number>;
  /** Sum of `estimatedCost` over priced total rows. */
  cost: number;
  /** Whether at least one total row is priced. */
  priced: boolean;
  /** `costUnit` of every priced row; a null unit is its own value. */
  costUnits: Set<string | null>;
}

const usageMetricNames = new Set<string>(TRACE_AGGREGATE_USAGE_METRIC_NAMES);
const costMetricNames = new Set<string>(TRACE_AGGREGATE_COST_METRIC_NAMES);

/** A total row is unpriced when `costMetadata.error` is set (including `partial_cost`) or it has no cost. */
function isPricedMetric(metric: RawTraceAggregateMetric): boolean {
  if (!costMetricNames.has(metric.name) || metric.estimatedCost === null) return false;
  const error = metric.costMetadata?.error;
  return error === undefined || error === null;
}

/**
 * Usage stage: every token metric row for a candidate trace counts — including spend before a
 * suspend/resume and rows whose span was never persisted — deduplicated on `metricId`. Rows are
 * pruned only by `timestamp >= from` (no upper bound) and the trusted tenant scope. Traces with no
 * qualifying row are absent from the result, i.e. not usage-bearing.
 */
function computeTraceUsage(
  metrics: RawTraceAggregateMetric[],
  roots: RawTraceQuerySpan[],
  plan: TrustedTraceAggregatePlan,
): Map<string, TraceUsage> {
  const candidates = new Set(roots.map(root => root.traceId));
  const fromMs = Date.parse(plan.timeRange.from);
  const seen = new Set<string>();
  const usage = new Map<string, TraceUsage>();
  for (const metric of metrics) {
    if (metric.traceId === null || !candidates.has(metric.traceId)) continue;
    if (!usageMetricNames.has(metric.name)) continue;
    if (Date.parse(metric.timestamp) < fromMs) continue;
    if (!matchesScope(metric, plan.scope)) continue;
    if (seen.has(metric.metricId)) continue;
    seen.add(metric.metricId);

    let trace = usage.get(metric.traceId);
    if (!trace) {
      trace = { tokens: new Map(), cost: 0, priced: false, costUnits: new Set() };
      usage.set(metric.traceId, trace);
    }
    trace.tokens.set(metric.name, (trace.tokens.get(metric.name) ?? 0) + metric.value);
    if (isPricedMetric(metric)) {
      trace.cost += metric.estimatedCost!;
      trace.priced = true;
      trace.costUnits.add(metric.costUnit);
    }
  }
  return usage;
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
  return field === 'traceId' ? root.traceId : traceQueryDimensionValue(root, field);
}

function durationMs(root: RawTraceQuerySpan): number {
  return Date.parse(root.endedAt!) - Date.parse(root.startedAt);
}

type MeasureValue = number | null;
type MeasureValues = Map<TrustedTraceAggregateMeasureName, MeasureValue>;

interface GroupValues {
  measures: MeasureValues;
  /** Present when any `cost.*` measure is requested. */
  cost?: TraceAggregateRowCost;
}

function hasCostMeasure(plan: TrustedTraceAggregatePlan): boolean {
  return plan.measures.some(measure => measure.type === 'canonical' && measure.name.startsWith('cost.'));
}

function computeMeasures(
  roots: RawTraceQuerySpan[],
  plan: TrustedTraceAggregatePlan,
  usage: Map<string, TraceUsage>,
): GroupValues {
  const values: MeasureValues = new Map();
  const count = roots.length;
  const usageBearing = roots.flatMap(root => usage.get(root.traceId!) ?? []);
  const priced = usageBearing.filter(trace => trace.priced);
  const costUnits = new Set(priced.flatMap(trace => [...trace.costUnits]));
  const mixedUnits = costUnits.size > 1;
  const costSum = priced.length === 0 || mixedUnits ? null : priced.reduce((sum, trace) => sum + trace.cost, 0);
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
        values.set(measure.name, errorCount / count);
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
      case 'cost.sum':
        values.set(measure.name, costSum);
        break;
      case 'cost.avg':
        values.set(measure.name, costSum === null ? null : costSum / priced.length);
        break;
      default: {
        const metricNames = TRACE_AGGREGATE_MEASURE_REGISTRY[measure.name].metricNames!;
        if (usageBearing.length === 0) {
          values.set(measure.name, null);
          break;
        }
        let sum = 0;
        for (const trace of usageBearing) {
          for (const name of metricNames) sum += trace.tokens.get(name) ?? 0;
        }
        values.set(measure.name, measure.name.endsWith('.avg') ? sum / usageBearing.length : sum);
      }
    }
  }
  if (!hasCostMeasure(plan)) return { measures: values };
  return {
    measures: values,
    cost: {
      coverage: usageBearing.length === 0 ? null : priced.length / usageBearing.length,
      unit: priced.length === 0 ? null : mixedUnits ? TRACE_AGGREGATE_MIXED_COST_UNIT : [...costUnits][0]!,
    },
  };
}

/**
 * SQL three-valued `having`: `null` is UNKNOWN. A comparison or membership test against a null
 * measure is UNKNOWN, `not` keeps UNKNOWN, `and` / `or` follow Kleene logic, and only TRUE keeps
 * the group.
 */
function evaluateHaving(predicate: TrustedTraceAggregateHavingPredicate, measures: MeasureValues): boolean | null {
  switch (predicate.type) {
    case 'boolean': {
      const results = predicate.args.map(arg => evaluateHaving(arg, measures));
      const decisive = predicate.operator === 'and' ? false : true;
      if (results.includes(decisive)) return decisive;
      return results.includes(null) ? null : !decisive;
    }
    case 'not': {
      const result = evaluateHaving(predicate.arg, measures);
      return result === null ? null : !result;
    }
    case 'membership': {
      const value = measures.get(predicate.measure)!;
      if (value === null) return null;
      const member = predicate.values.includes(value);
      return predicate.operator === 'in' ? member : !member;
    }
    case 'comparison': {
      const value = measures.get(predicate.measure)!;
      if (value === null) return null;
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
  values: GroupValues;
}

/** Nulls sort after every non-null value regardless of direction; only non-null pairs honor `direction`. */
function compareNullable<T extends number | string>(
  left: T | null,
  right: T | null,
  direction: 'asc' | 'desc',
): number {
  if (left === null || right === null) {
    if (left === right) return 0;
    return left === null ? 1 : -1;
  }
  const order =
    typeof left === 'number' ? left - (right as number) : compareTraceQueryStrings(left as string, right as string);
  return direction === 'desc' ? -order : order;
}

function compareGroups(left: Group, right: Group, plan: TrustedTraceAggregatePlan): number {
  const orderBy = plan.orderBy;
  const primary =
    orderBy.target === 'measure'
      ? compareNullable(
          left.values.measures.get(orderBy.measure)!,
          right.values.measures.get(orderBy.measure)!,
          orderBy.direction,
        )
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

function projectValues(
  values: GroupValues,
  plan: TrustedTraceAggregatePlan,
): Pick<TraceAggregateRow, 'measures' | 'cost'> {
  const measures = Object.fromEntries(plan.measures.map(measure => [measure.name, values.measures.get(measure.name)!]));
  return { measures, ...(values.cost && { cost: values.cost }) };
}

function rowDimensions(group: Group, plan: TrustedTraceAggregatePlan): TraceAggregateRow['dimensions'] {
  const dimensions: Record<string, string | null> = {};
  plan.dimensions.forEach((dimension, index) => {
    dimensions[dimension] = group.dimensions[index]!;
  });
  return dimensions;
}

export function evaluateTraceAggregate(
  data: TraceAggregateFixtureData,
  plan: TrustedTraceAggregatePlan,
): TraceAggregateResponse {
  const roots = selectTraceQueryRoots(data, plan);
  const usage = computeTraceUsage(data.metrics ?? [], roots, plan);

  const groupsByKey = new Map<string, Group>();
  for (const root of roots) {
    const dimensions = plan.dimensions.map(dimension => traceQueryDimensionValue(root, dimension));
    const key = JSON.stringify(dimensions);
    let group = groupsByKey.get(key);
    if (!group) {
      group = { dimensions, roots: [], values: { measures: new Map() } };
      groupsByKey.set(key, group);
    }
    group.roots.push(root);
  }

  const groups = [...groupsByKey.values()];
  for (const group of groups) group.values = computeMeasures(group.roots, plan, usage);

  const surviving = plan.having
    ? groups.filter(group => evaluateHaving(plan.having!, group.values.measures) === true)
    : groups;
  surviving.sort((left, right) => compareGroups(left, right, plan));

  const truncated = surviving.length > plan.limit;
  const kept = surviving.slice(0, plan.limit);

  const rows: TraceAggregateRow[] = [];
  for (const group of kept) {
    const dimensions = plan.dimensions.length > 0 ? rowDimensions(group, plan) : undefined;
    if (!plan.interval) {
      rows.push({ ...(dimensions && { dimensions }), ...projectValues(group.values, plan) });
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
        ...projectValues(computeMeasures(buckets.get(bucketMs)!, plan, usage), plan),
      });
    }
  }

  return { rows, truncated };
}

export function evaluateTraceAggregateRequest(
  data: TraceAggregateFixtureData,
  request: TraceAggregateRequest,
  scope?: TraceQueryTenantScope,
): TraceAggregateResponse {
  return evaluateTraceAggregate(data, planTraceAggregate(parseTraceAggregateRequest(request), { scope }));
}

// ---------------------------------------------------------------------------------------------
// Shared fixture and conformance cases for `aggregateTraces()`.
//
// Every expected response below is derived by hand from the table in the comment above the
// fixture — never by running the evaluator — so the same cases can later prove PostgreSQL,
// ClickHouse, and DuckDB compilers against an independent oracle.
// ---------------------------------------------------------------------------------------------

const aggregateRange = { from: '2026-08-01T00:00:00Z', to: '2026-08-08T00:00:00Z' };

interface AggregateRootSpec {
  cursorId: number;
  traceId: string;
  entityName: string | null;
  startedAt: string;
  durationMs: number;
  error?: boolean;
  threadId: string;
  tenant?: unknown;
  lookup?: boolean;
  environment?: string;
  organizationId?: string;
}

function aggregateRoot(spec: AggregateRootSpec): RawTraceQuerySpan[] {
  const organizationId = spec.organizationId ?? 'org-a';
  const root = span(spec.cursorId, spec.traceId, spec.traceId, {
    entityName: spec.entityName,
    environment: spec.environment ?? 'production',
    organizationId,
    threadId: spec.threadId,
    startedAt: spec.startedAt,
    endedAt: new Date(Date.parse(spec.startedAt) + spec.durationMs).toISOString(),
    error: spec.error ? { message: 'failed' } : null,
    metadata: spec.tenant === undefined ? null : { tenant: spec.tenant },
  });
  if (!spec.lookup) return [root];
  return [
    root,
    span(spec.cursorId + 1, spec.traceId, `${spec.traceId}-lookup`, {
      parentSpanId: spec.traceId,
      name: 'medication_lookup',
      spanType: 'tool_call',
      entityType: 'tool',
      entityName: 'Medication lookup',
      organizationId,
      threadId: spec.threadId,
      startedAt: spec.startedAt,
      endedAt: new Date(Date.parse(spec.startedAt) + 100).toISOString(),
    }),
  ];
}

/**
 * Window `[2026-08-01, 2026-08-08)`; every root is `production` / `org-a` unless noted. Days 4 and
 * 7 have no traces at all; other days are sparse per agent so bucket series have holes.
 *
 * | trace       | day | ms    | err | thread | tenant     | lookup | notes                     |
 * |-------------|-----|-------|-----|--------|------------|--------|---------------------------|
 * | triage-1    | 1   | 1000  |     | t-1    | acme       | yes    |                           |
 * | triage-2    | 1   | 2000  | yes | t-1    | acme       | yes    |                           |
 * | triage-3    | 2   | 3000  |     | t-2    | '  acme '  | yes    | padded → `acme`           |
 * | triage-4    | 3   | 4000  |     | t-3    | globex     | yes    |                           |
 * | triage-5    | 5   | 8000  | yes | t-3    | ''         | yes    | empty → `null`            |
 * | triage-6    | 5   | 8000  |     | t-4    |            |        | superseded copy excluded  |
 * | billing-1   | 1   | 500   |     | t-5    | acme       | yes    |                           |
 * | billing-2   | 2   | 1500  |     | t-5    | globex     |        |                           |
 * | billing-3   | 3   | 2500  | yes | t-6    |            | yes    |                           |
 * | billing-4   | 6   | 2500  |     | t-6    | acme       | yes    |                           |
 * | billing-5   | 6   | 2500  |     | t-9    | acme       | yes    | org-b                     |
 * | support-1..4| 2   | 6000  | #3  | t-7/8  |            |        | all in one bucket         |
 * | research-1  | 3   | 12000 |     | t-10   | acme       | yes    | staging, org-b            |
 * | research-2  | 5   | 12000 | yes | t-10   | acme       | yes    | staging, org-b            |
 * | scheduler-1 | 1   | 1000  |     | t-11   |            |        | percentiles interpolate   |
 * | scheduler-2 | 3   | 3000  |     | t-11   |            |        |                           |
 * | unnamed-1   | 2   | 700   |     | t-12   |            |        | `entityName: null`        |
 *
 * Whole-window groups by `entityName`: triage 6 (2 errors, p95 8000), billing 5 (1 error,
 * p95 2500), support 4 (1 error, p95 6000), research 2 (1 error, p95 12000), scheduler 2
 * (p95 2900), null 1. Total 20 traces, 5 errors.
 *
 * Excluded records: a superseded `triage-6` root (lower `cursorId`, error + 60 s duration), a
 * pending `triage-pending` root, and a `triage-late` root starting exactly at `to`.
 */
export const TRACE_AGGREGATE_FIXTURE_DATA: TraceQueryFixtureData = {
  spans: [
    ...aggregateRoot({
      cursorId: 100,
      traceId: 'triage-1',
      entityName: 'triage',
      startedAt: '2026-08-01T10:00:00.000Z',
      durationMs: 1000,
      threadId: 't-1',
      tenant: 'acme',
      lookup: true,
    }),
    ...aggregateRoot({
      cursorId: 110,
      traceId: 'triage-2',
      entityName: 'triage',
      startedAt: '2026-08-01T11:00:00.000Z',
      durationMs: 2000,
      error: true,
      threadId: 't-1',
      tenant: 'acme',
      lookup: true,
    }),
    ...aggregateRoot({
      cursorId: 120,
      traceId: 'triage-3',
      entityName: 'triage',
      startedAt: '2026-08-02T10:00:00.000Z',
      durationMs: 3000,
      threadId: 't-2',
      tenant: '  acme ',
      lookup: true,
    }),
    ...aggregateRoot({
      cursorId: 130,
      traceId: 'triage-4',
      entityName: 'triage',
      startedAt: '2026-08-03T10:00:00.000Z',
      durationMs: 4000,
      threadId: 't-3',
      tenant: 'globex',
      lookup: true,
    }),
    ...aggregateRoot({
      cursorId: 140,
      traceId: 'triage-5',
      entityName: 'triage',
      startedAt: '2026-08-05T10:00:00.000Z',
      durationMs: 8000,
      error: true,
      threadId: 't-3',
      tenant: '',
      lookup: true,
    }),
    ...aggregateRoot({
      cursorId: 150,
      traceId: 'triage-6',
      entityName: 'triage',
      startedAt: '2026-08-05T11:00:00.000Z',
      durationMs: 60_000,
      error: true,
      threadId: 't-4',
    }),
    ...aggregateRoot({
      cursorId: 151,
      traceId: 'triage-6',
      entityName: 'triage',
      startedAt: '2026-08-05T11:00:00.000Z',
      durationMs: 8000,
      threadId: 't-4',
    }),
    ...aggregateRoot({
      cursorId: 200,
      traceId: 'billing-1',
      entityName: 'billing',
      startedAt: '2026-08-01T10:00:00.000Z',
      durationMs: 500,
      threadId: 't-5',
      tenant: 'acme',
      lookup: true,
    }),
    ...aggregateRoot({
      cursorId: 210,
      traceId: 'billing-2',
      entityName: 'billing',
      startedAt: '2026-08-02T10:00:00.000Z',
      durationMs: 1500,
      threadId: 't-5',
      tenant: 'globex',
    }),
    ...aggregateRoot({
      cursorId: 220,
      traceId: 'billing-3',
      entityName: 'billing',
      startedAt: '2026-08-03T10:00:00.000Z',
      durationMs: 2500,
      error: true,
      threadId: 't-6',
      lookup: true,
    }),
    ...aggregateRoot({
      cursorId: 230,
      traceId: 'billing-4',
      entityName: 'billing',
      startedAt: '2026-08-06T10:00:00.000Z',
      durationMs: 2500,
      threadId: 't-6',
      tenant: 'acme',
      lookup: true,
    }),
    ...aggregateRoot({
      cursorId: 240,
      traceId: 'billing-5',
      entityName: 'billing',
      startedAt: '2026-08-06T11:00:00.000Z',
      durationMs: 2500,
      threadId: 't-9',
      tenant: 'acme',
      lookup: true,
      organizationId: 'org-b',
    }),
    ...aggregateRoot({
      cursorId: 300,
      traceId: 'support-1',
      entityName: 'support',
      startedAt: '2026-08-02T10:00:00.000Z',
      durationMs: 6000,
      threadId: 't-7',
    }),
    ...aggregateRoot({
      cursorId: 310,
      traceId: 'support-2',
      entityName: 'support',
      startedAt: '2026-08-02T11:00:00.000Z',
      durationMs: 6000,
      threadId: 't-7',
    }),
    ...aggregateRoot({
      cursorId: 320,
      traceId: 'support-3',
      entityName: 'support',
      startedAt: '2026-08-02T12:00:00.000Z',
      durationMs: 6000,
      error: true,
      threadId: 't-8',
    }),
    ...aggregateRoot({
      cursorId: 330,
      traceId: 'support-4',
      entityName: 'support',
      startedAt: '2026-08-02T13:00:00.000Z',
      durationMs: 6000,
      threadId: 't-8',
    }),
    ...aggregateRoot({
      cursorId: 400,
      traceId: 'research-1',
      entityName: 'research',
      startedAt: '2026-08-03T10:00:00.000Z',
      durationMs: 12_000,
      threadId: 't-10',
      tenant: 'acme',
      lookup: true,
      environment: 'staging',
      organizationId: 'org-b',
    }),
    ...aggregateRoot({
      cursorId: 410,
      traceId: 'research-2',
      entityName: 'research',
      startedAt: '2026-08-05T10:00:00.000Z',
      durationMs: 12_000,
      error: true,
      threadId: 't-10',
      tenant: 'acme',
      lookup: true,
      environment: 'staging',
      organizationId: 'org-b',
    }),
    ...aggregateRoot({
      cursorId: 500,
      traceId: 'scheduler-1',
      entityName: 'scheduler',
      startedAt: '2026-08-01T10:00:00.000Z',
      durationMs: 1000,
      threadId: 't-11',
    }),
    ...aggregateRoot({
      cursorId: 510,
      traceId: 'scheduler-2',
      entityName: 'scheduler',
      startedAt: '2026-08-03T10:00:00.000Z',
      durationMs: 3000,
      threadId: 't-11',
    }),
    ...aggregateRoot({
      cursorId: 600,
      traceId: 'unnamed-1',
      entityName: null,
      startedAt: '2026-08-02T10:00:00.000Z',
      durationMs: 700,
      threadId: 't-12',
    }),
    span(700, 'triage-pending', 'triage-pending', {
      entityName: 'triage',
      organizationId: 'org-a',
      isPending: true,
      startedAt: '2026-08-02T10:00:00.000Z',
      endedAt: null,
    }),
    ...aggregateRoot({
      cursorId: 710,
      traceId: 'triage-late',
      entityName: 'triage',
      startedAt: '2026-08-08T00:00:00.000Z',
      durationMs: 1000,
      threadId: 't-1',
    }),
  ],
  scores: [],
  feedback: [],
};

/**
 * Structural twin of `TraceAggregateResponse`. The zod-inferred `measures` record requires every
 * measure key, which hand-written expectations (requested measures only) cannot satisfy; tests
 * validate each `expected` against `traceAggregateResponseSchema` instead.
 */
export interface TraceAggregateExpectedResponse {
  rows: Array<{
    dimensions?: Record<string, string | null>;
    bucket?: string;
    measures: Record<string, number | null>;
    cost?: TraceAggregateRowCost;
  }>;
  truncated: boolean;
}

export interface TraceAggregateConformanceCase {
  name: string;
  request: TraceAggregateRequest;
  scope?: TraceQueryTenantScope;
  expected: TraceAggregateExpectedResponse;
  /**
   * Absolute per-measure tolerance for store conformance. Percentile semantics are
   * backend-native (`percentile_cont` on PostgreSQL, `quantile` on ClickHouse), so
   * only `duration.p*` measures carry a tolerance; counts, sums (including tokens and cost),
   * rates, and row `cost` stay exact.
   */
  tolerance?: Record<string, number>;
}

/**
 * Describes the first way `actual` diverges from a conformance case's expectation, or `null`
 * when it matches. Measures listed in `tolerance` may differ by at most that absolute amount;
 * everything else — `truncated`, row order, dimensions, buckets, measure keys and values — is
 * compared exactly.
 */
export function traceAggregateResponseMismatch(
  actual: TraceAggregateResponse | TraceAggregateExpectedResponse,
  testCase: Pick<TraceAggregateConformanceCase, 'expected' | 'tolerance'>,
): string | null {
  const { expected, tolerance = {} } = testCase;
  if (actual.truncated !== expected.truncated) {
    return `truncated: expected ${expected.truncated}, got ${actual.truncated}`;
  }
  if (actual.rows.length !== expected.rows.length) {
    return `rows: expected ${expected.rows.length}, got ${actual.rows.length}`;
  }
  for (const [index, expectedRow] of expected.rows.entries()) {
    const actualRow = actual.rows[index]!;
    const at = `rows[${index}]`;
    // `dimensions` and `measures` are records, so key order is not part of the contract.
    if (sortedKeys(actualRow.dimensions) !== sortedKeys(expectedRow.dimensions)) {
      return `${at}.dimensions keys: expected ${sortedKeys(expectedRow.dimensions)}, got ${sortedKeys(actualRow.dimensions)}`;
    }
    for (const key of Object.keys(expectedRow.dimensions ?? {})) {
      if (actualRow.dimensions![key] !== expectedRow.dimensions![key]) {
        return `${at}.dimensions.${key}: expected ${JSON.stringify(expectedRow.dimensions![key])}, got ${JSON.stringify(actualRow.dimensions![key])}`;
      }
    }
    // The schema accepts any ISO-8601 offset form, so a schema-valid bucket compares as an instant.
    if (actualRow.bucket !== undefined && !bucketSchema.safeParse(actualRow.bucket).success) {
      return `${at}.bucket: expected an ISO-8601 date-time with offset, got ${actualRow.bucket}`;
    }
    if (bucketInstant(actualRow.bucket) !== bucketInstant(expectedRow.bucket)) {
      return `${at}.bucket: expected ${expectedRow.bucket}, got ${actualRow.bucket}`;
    }
    if (sortedKeys(actualRow.measures) !== sortedKeys(expectedRow.measures)) {
      return `${at}.measures keys: expected ${sortedKeys(expectedRow.measures)}, got ${sortedKeys(actualRow.measures)}`;
    }
    for (const key of Object.keys(expectedRow.measures)) {
      const expectedValue = expectedRow.measures[key]!;
      const actualValue = (actualRow.measures as Record<string, number | null>)[key]!;
      const allowed = tolerance[key];
      const matches =
        allowed !== undefined && typeof actualValue === 'number' && typeof expectedValue === 'number'
          ? Math.abs(actualValue - expectedValue) <= allowed
          : actualValue === expectedValue;
      if (!matches) {
        const within = allowed === undefined ? '' : ` (±${allowed})`;
        return `${at}.measures.${key}: expected ${expectedValue}${within}, got ${actualValue}`;
      }
    }
    const actualCost = actualRow.cost;
    const expectedCost = expectedRow.cost;
    const costMatches =
      actualCost === undefined || expectedCost === undefined
        ? actualCost === expectedCost
        : actualCost.coverage === expectedCost.coverage && actualCost.unit === expectedCost.unit;
    if (!costMatches) {
      return `${at}.cost: expected ${JSON.stringify(expectedRow.cost)}, got ${JSON.stringify(actualRow.cost)}`;
    }
  }
  return null;
}

const bucketSchema = traceAggregateRowSchema.shape.bucket.unwrap();

function bucketInstant(bucket: string | undefined): number | undefined {
  return bucket === undefined ? undefined : Date.parse(bucket);
}

function sortedKeys(record: object | undefined): string {
  return record === undefined ? 'absent' : JSON.stringify(Object.keys(record).sort());
}

const triage = { entityName: 'triage' };
const billing = { entityName: 'billing' };
const support = { entityName: 'support' };
const research = { entityName: 'research' };
const scheduler = { entityName: 'scheduler' };
const unnamed = { entityName: null };

const day = (d: number) => `2026-08-0${d}T00:00:00.000Z`;

export const TRACE_AGGREGATE_CONFORMANCE_CASES: TraceAggregateConformanceCase[] = [
  {
    name: 'example 1: daily count and errorRate per agent omit empty days and keep complete series',
    request: {
      timeRange: aggregateRange,
      where: { op: 'eq', left: { path: 'environment' }, right: { literal: 'production' } },
      groupBy: ['entityName'],
      interval: '1d',
      measures: ['count', 'errorRate'],
    },
    expected: {
      rows: [
        { dimensions: triage, bucket: day(1), measures: { count: 2, errorRate: 0.5 } },
        { dimensions: triage, bucket: day(2), measures: { count: 1, errorRate: 0 } },
        { dimensions: triage, bucket: day(3), measures: { count: 1, errorRate: 0 } },
        { dimensions: triage, bucket: day(5), measures: { count: 2, errorRate: 0.5 } },
        { dimensions: billing, bucket: day(1), measures: { count: 1, errorRate: 0 } },
        { dimensions: billing, bucket: day(2), measures: { count: 1, errorRate: 0 } },
        { dimensions: billing, bucket: day(3), measures: { count: 1, errorRate: 1 } },
        { dimensions: billing, bucket: day(6), measures: { count: 2, errorRate: 0 } },
        { dimensions: support, bucket: day(2), measures: { count: 4, errorRate: 0.25 } },
        { dimensions: scheduler, bucket: day(1), measures: { count: 1, errorRate: 0 } },
        { dimensions: scheduler, bucket: day(3), measures: { count: 1, errorRate: 0 } },
        { dimensions: unnamed, bucket: day(2), measures: { count: 1, errorRate: 0 } },
      ],
      truncated: false,
    },
  },
  {
    name: 'example 2: slowest agents by p95 with a having threshold',
    request: {
      timeRange: aggregateRange,
      groupBy: ['entityName'],
      measures: ['count', 'duration.p95'],
      having: { op: 'gt', left: { path: 'duration.p95' }, right: { literal: 5000 } },
      orderBy: { field: 'duration.p95', direction: 'desc' },
      limit: 10,
    },
    expected: {
      rows: [
        { dimensions: research, measures: { count: 2, 'duration.p95': 12_000 } },
        { dimensions: triage, measures: { count: 6, 'duration.p95': 8000 } },
        { dimensions: support, measures: { count: 4, 'duration.p95': 6000 } },
      ],
      truncated: false,
    },
  },
  {
    name: 'example 3: traces that called a tool grouped by metadata tenant with a null tenant group',
    request: {
      timeRange: aggregateRange,
      where: { spans: { some: { op: 'eq', left: { path: 'name' }, right: { literal: 'medication_lookup' } } } },
      groupBy: ['metadata.tenant'],
      measures: ['count', 'countDistinct.threadId'],
    },
    expected: {
      rows: [
        { dimensions: { 'metadata.tenant': 'acme' }, measures: { count: 8, 'countDistinct.threadId': 6 } },
        { dimensions: { 'metadata.tenant': null }, measures: { count: 2, 'countDistinct.threadId': 2 } },
        { dimensions: { 'metadata.tenant': 'globex' }, measures: { count: 1, 'countDistinct.threadId': 1 } },
      ],
      truncated: false,
    },
  },
  {
    name: 'null dimension groups sort last when ordering by dimension ascending',
    request: {
      timeRange: aggregateRange,
      groupBy: ['entityName', 'environment'],
      measures: ['count'],
      orderBy: { field: 'entityName', direction: 'asc' },
    },
    expected: {
      rows: [
        { dimensions: { ...billing, environment: 'production' }, measures: { count: 5 } },
        { dimensions: { ...research, environment: 'staging' }, measures: { count: 2 } },
        { dimensions: { ...scheduler, environment: 'production' }, measures: { count: 2 } },
        { dimensions: { ...support, environment: 'production' }, measures: { count: 4 } },
        { dimensions: { ...triage, environment: 'production' }, measures: { count: 6 } },
        { dimensions: { ...unnamed, environment: 'production' }, measures: { count: 1 } },
      ],
      truncated: false,
    },
  },
  {
    name: 'null dimension groups sort last when ordering by dimension descending',
    request: {
      timeRange: aggregateRange,
      groupBy: ['entityName', 'environment'],
      measures: ['count'],
      orderBy: { field: 'entityName', direction: 'desc' },
    },
    expected: {
      rows: [
        { dimensions: { ...triage, environment: 'production' }, measures: { count: 6 } },
        { dimensions: { ...support, environment: 'production' }, measures: { count: 4 } },
        { dimensions: { ...scheduler, environment: 'production' }, measures: { count: 2 } },
        { dimensions: { ...research, environment: 'staging' }, measures: { count: 2 } },
        { dimensions: { ...billing, environment: 'production' }, measures: { count: 5 } },
        { dimensions: { ...unnamed, environment: 'production' }, measures: { count: 1 } },
      ],
      truncated: false,
    },
  },
  {
    name: 'equal counts under the default ordering break ties on the dimension ascending',
    request: { timeRange: aggregateRange, groupBy: ['entityName'], measures: ['count'] },
    expected: {
      rows: [
        { dimensions: triage, measures: { count: 6 } },
        { dimensions: billing, measures: { count: 5 } },
        { dimensions: support, measures: { count: 4 } },
        { dimensions: research, measures: { count: 2 } },
        { dimensions: scheduler, measures: { count: 2 } },
        { dimensions: unnamed, measures: { count: 1 } },
      ],
      truncated: false,
    },
  },
  {
    name: 'limit counts groups and reports truncation',
    request: { timeRange: aggregateRange, groupBy: ['entityName'], measures: ['count'], limit: 2 },
    expected: {
      rows: [
        { dimensions: triage, measures: { count: 6 } },
        { dimensions: billing, measures: { count: 5 } },
      ],
      truncated: true,
    },
  },
  {
    name: 'interval with limit keeps complete series for the top groups and drops lower-ranked groups entirely',
    request: {
      timeRange: aggregateRange,
      groupBy: ['entityName'],
      interval: '1d',
      measures: ['count'],
      orderBy: { field: 'count', direction: 'desc' },
      limit: 2,
    },
    expected: {
      rows: [
        { dimensions: triage, bucket: day(1), measures: { count: 2 } },
        { dimensions: triage, bucket: day(2), measures: { count: 1 } },
        { dimensions: triage, bucket: day(3), measures: { count: 1 } },
        { dimensions: triage, bucket: day(5), measures: { count: 2 } },
        { dimensions: billing, bucket: day(1), measures: { count: 1 } },
        { dimensions: billing, bucket: day(2), measures: { count: 1 } },
        { dimensions: billing, bucket: day(3), measures: { count: 1 } },
        { dimensions: billing, bucket: day(6), measures: { count: 2 } },
      ],
      truncated: true,
    },
  },
  {
    name: 'ungrouped request without interval returns a single row with measures only',
    request: { timeRange: aggregateRange, measures: ['count', 'errorCount', 'errorRate'] },
    expected: { rows: [{ measures: { count: 20, errorCount: 5, errorRate: 0.25 } }], truncated: false },
  },
  {
    name: 'ungrouped request with interval returns bucket rows only',
    request: { timeRange: aggregateRange, interval: '1d', measures: ['count'] },
    expected: {
      rows: [
        { bucket: day(1), measures: { count: 4 } },
        { bucket: day(2), measures: { count: 7 } },
        { bucket: day(3), measures: { count: 4 } },
        { bucket: day(5), measures: { count: 3 } },
        { bucket: day(6), measures: { count: 2 } },
      ],
      truncated: false,
    },
  },
  {
    name: 'count drives having and orderBy without being projected',
    request: {
      timeRange: aggregateRange,
      groupBy: ['entityName'],
      measures: ['errorRate'],
      having: { op: 'gte', left: { path: 'count' }, right: { literal: 4 } },
      orderBy: { field: 'count', direction: 'asc' },
    },
    expected: {
      rows: [
        { dimensions: support, measures: { errorRate: 0.25 } },
        { dimensions: billing, measures: { errorRate: 0.2 } },
        { dimensions: triage, measures: { errorRate: 1 / 3 } },
      ],
      truncated: false,
    },
  },
  {
    name: 'tenant scope restricts the aggregated population',
    request: { timeRange: aggregateRange, groupBy: ['entityName'], measures: ['count', 'errorCount'] },
    scope: { organizationId: 'org-b' },
    expected: {
      rows: [
        { dimensions: research, measures: { count: 2, errorCount: 1 } },
        { dimensions: billing, measures: { count: 1, errorCount: 0 } },
      ],
      truncated: false,
    },
  },
  {
    name: 'duration measures interpolate percentiles linearly within a group',
    request: {
      timeRange: aggregateRange,
      where: { op: 'eq', left: { path: 'entityName' }, right: { literal: 'scheduler' } },
      groupBy: ['entityName'],
      measures: [
        'duration.avg',
        'duration.min',
        'duration.max',
        'duration.p50',
        'duration.p90',
        'duration.p95',
        'duration.p99',
      ],
    },
    expected: {
      rows: [
        {
          dimensions: scheduler,
          measures: {
            'duration.avg': 2000,
            'duration.min': 1000,
            'duration.max': 3000,
            'duration.p50': 2000,
            'duration.p90': 2800,
            'duration.p95': 2900,
            'duration.p99': 2980,
          },
        },
      ],
      truncated: false,
    },
    // Backend-native percentiles of {1000, 3000} land anywhere between the interpolated value and
    // the upper order statistic; the tolerance is the distance to 3000.
    tolerance: { 'duration.p50': 1000, 'duration.p90': 200, 'duration.p95': 100, 'duration.p99': 20 },
  },
  {
    name: 'status dimension derives from the root error and countDistinct.traceId counts traces',
    request: { timeRange: aggregateRange, groupBy: ['status'], measures: ['count', 'countDistinct.traceId'] },
    expected: {
      rows: [
        { dimensions: { status: 'success' }, measures: { count: 15, 'countDistinct.traceId': 15 } },
        { dimensions: { status: 'error' }, measures: { count: 5, 'countDistinct.traceId': 5 } },
      ],
      truncated: false,
    },
  },
  {
    name: 'null in the second dimension sorts last within the first dimension tie-break',
    request: {
      timeRange: aggregateRange,
      groupBy: ['status', 'metadata.tenant'],
      measures: ['count'],
      orderBy: { field: 'status', direction: 'asc' },
    },
    expected: {
      rows: [
        { dimensions: { status: 'error', 'metadata.tenant': 'acme' }, measures: { count: 2 } },
        { dimensions: { status: 'error', 'metadata.tenant': null }, measures: { count: 3 } },
        { dimensions: { status: 'success', 'metadata.tenant': 'acme' }, measures: { count: 6 } },
        { dimensions: { status: 'success', 'metadata.tenant': 'globex' }, measures: { count: 2 } },
        { dimensions: { status: 'success', 'metadata.tenant': null }, measures: { count: 7 } },
      ],
      truncated: false,
    },
  },
  {
    name: 'countDistinct over a nullable dimension skips null values',
    request: {
      timeRange: aggregateRange,
      groupBy: ['environment'],
      measures: ['count', 'countDistinct.entityName', 'countDistinct.metadata.tenant'],
    },
    expected: {
      rows: [
        {
          dimensions: { environment: 'production' },
          measures: { count: 18, 'countDistinct.entityName': 4, 'countDistinct.metadata.tenant': 2 },
        },
        {
          dimensions: { environment: 'staging' },
          measures: { count: 2, 'countDistinct.entityName': 1, 'countDistinct.metadata.tenant': 1 },
        },
      ],
      truncated: false,
    },
  },
  {
    name: 'having combines or, not, and in over group measures',
    request: {
      timeRange: aggregateRange,
      groupBy: ['entityName'],
      measures: ['count', 'errorCount'],
      having: {
        op: 'and',
        args: [
          {
            op: 'or',
            args: [
              { op: 'in', value: { path: 'count' }, set: [2, 4] },
              { op: 'gte', left: { path: 'errorCount' }, right: { literal: 2 } },
            ],
          },
          { op: 'not', arg: { op: 'eq', left: { path: 'errorCount' }, right: { literal: 0 } } },
        ],
      },
    },
    expected: {
      rows: [
        { dimensions: triage, measures: { count: 6, errorCount: 2 } },
        { dimensions: support, measures: { count: 4, errorCount: 1 } },
        { dimensions: research, measures: { count: 2, errorCount: 1 } },
      ],
      truncated: false,
    },
  },
  {
    name: 'a window starting mid-bucket labels the first bucket at the interval floor before from',
    request: {
      timeRange: { from: '2026-08-01T10:30:00Z', to: '2026-08-03T00:00:00Z' },
      interval: '1d',
      measures: ['count'],
    },
    expected: {
      rows: [
        { bucket: day(1), measures: { count: 1 } },
        { bucket: day(2), measures: { count: 7 } },
      ],
      truncated: false,
    },
  },
  {
    name: 'an empty population returns no rows even for an ungrouped request',
    request: {
      timeRange: { from: '2026-08-04T00:00:00Z', to: '2026-08-05T00:00:00Z' },
      measures: ['count', 'errorRate', 'duration.avg'],
    },
    expected: { rows: [], truncated: false },
  },
  {
    name: 'a having that removes every group returns no rows and is not truncated',
    request: {
      timeRange: aggregateRange,
      groupBy: ['entityName'],
      measures: ['count'],
      having: { op: 'gt', left: { path: 'count' }, right: { literal: 100 } },
    },
    expected: { rows: [], truncated: false },
  },
];

// ---------------------------------------------------------------------------------------------
// Token and cost fixture and conformance cases.
//
// Costs are binary-exact (multiples of 1/8) so every backend sums them without rounding, and
// every average and coverage divides to an exact value. Expected responses are derived by hand
// from the tables below.
// ---------------------------------------------------------------------------------------------

const tokenRange = { from: '2026-06-01T00:00:00Z', to: '2026-09-01T00:00:00Z' };

interface MetricCost {
  estimatedCost: number | null;
  costUnit?: string | null;
  error?: string;
}

function tokenMetric(
  metricId: string,
  traceId: string,
  spanId: string | null,
  name: string,
  value: number,
  timestamp: string,
  cost: MetricCost = { estimatedCost: null },
  organizationId = 'org-a',
): RawTraceAggregateMetric {
  return {
    metricId,
    timestamp,
    traceId,
    spanId,
    name,
    value,
    estimatedCost: cost.estimatedCost,
    costUnit: cost.estimatedCost === null && cost.costUnit === undefined ? null : (cost.costUnit ?? 'usd'),
    costMetadata: cost.error ? { error: cost.error } : null,
    provider: 'openai',
    model: 'gpt-4o-mini',
    organizationId,
    resourceId: null,
  };
}

const usd = (estimatedCost: number): MetricCost => ({ estimatedCost, costUnit: 'usd' });
const eur = (estimatedCost: number): MetricCost => ({ estimatedCost, costUnit: 'eur' });
const after = (startedAt: string, seconds: number) => new Date(Date.parse(startedAt) + seconds * 1000).toISOString();

const {
  TOTAL_INPUT: INPUT,
  TOTAL_OUTPUT: OUTPUT,
  OUTPUT_REASONING: REASONING,
  INPUT_CACHE_READ: CACHED,
  INPUT_TEXT,
} = TokenMetrics;

/**
 * Token usage in the window `[2026-06-01, 2026-09-01)`; every root is `production` /
 * `org-a`. `in` / `out` are the `TOTAL_INPUT` / `TOTAL_OUTPUT` sums per trace; cost is the sum of
 * priced total rows only.
 *
 * | trace     | entity    | day   | in   | out | rsn | cache | cost      | priced | notes                                       |
 * |-----------|-----------|-------|------|-----|-----|-------|-----------|--------|---------------------------------------------|
 * | early-1   | triage    | 06-01 | 100  | 20  |     |       | 0.25 usd  | yes    | pre-`from` row (999 in, 9 usd) pruned       |
 * | sup-1     | support   | 08-14 | 1000 | 200 | 50  | 400   | 0.75 usd  | yes    | costed detail rows ignored; dup `metricId`  |
 * | sup-2     | support   | 08-14 | 2000 | 400 |     |       | 1 usd     | yes    | cost on the input row only (`query_total`)  |
 * | sup-3     | support   | 08-15 | 500  | 100 |     |       | —         | no     | both rows `no_matching_model`               |
 * | sup-4     | support   | 08-31 | 3000 | 600 |     |       | 2 usd     | yes    | ends and emits metrics after `to`           |
 * | res-1     | research  | 08-14 | 800  | 100 |     |       | 0.75 usd  | yes    |                                             |
 * | res-2     | research  | 08-15 | 1200 | 300 |     |       | 1.5 eur   | yes    | second unit → group is `mixed`              |
 * | bil-1     | billing   | 08-20 | 1000 | 120 |     |       | —         | no     | `partial_cost` row with 0.75; null-cost row |
 * | bil-2     | billing   | 08-20 | 600  | 80  |     |       | 0.25 usd  | yes    | error-tagged output row with 0.125 ignored  |
 * | sch-1     | scheduler | 08-21 |      |     |     |       |           |        | no metric rows (retention skew)             |
 * | sch-2     | scheduler | 08-22 |      |     |     |       |           |        | no metric rows (retention skew)             |
 * | resume-1  | planner   | 08-26 | 1000 | 300 |     |       | 1.25 usd  | yes    | resumed: two roots, spend from both         |
 *
 * `resume-1` has an older root (`entityName: 'planner-suspended'`, 08-25) carrying 400 in / 100
 * out / 0.5 usd, and the current root (`planner`, 08-26, `metadata.resumedFromSpanId`) whose
 * 600 in / 200 out / 0.75 usd rows reference a model span that was never persisted. The trace
 * counts once, groups as `planner`, buckets on 08-26, and sums usage from both attempts.
 *
 * Whole-window groups by `entityName` (usage-bearing / priced → coverage):
 * support 4 traces, in 6500, out 1300, cost 3.75 usd (4 / 3 → 0.75); planner 1, in 1000, out
 * 300, cost 1.25 usd (1 / 1); triage 1, in 100, out 20, cost 0.25 usd (1 / 1); billing 2, in
 * 1600, out 200, cost 0.25 usd (2 / 1 → 0.5); research 2, in 2000, out 400, cost null `mixed`
 * (2 / 2); scheduler 2, no usage (tokens, cost, coverage, unit all null).
 *
 * Outside that window: `tenant-check` (`org-a`, 09-10) has 100 in / 10 out / 0.25 usd of
 * `org-a` rows plus an `org-b` row sharing its `traceId` (7000 in, 2 usd), which only an
 * unscoped plan counts.
 */
export const TRACE_AGGREGATE_TOKEN_FIXTURE_DATA: TraceAggregateFixtureData = {
  spans: [
    ...aggregateRoot({
      cursorId: 1000,
      traceId: 'early-1',
      entityName: 'triage',
      startedAt: '2026-06-01T00:00:10.000Z',
      durationMs: 2000,
      threadId: 't-20',
    }),
    ...aggregateRoot({
      cursorId: 1010,
      traceId: 'sup-1',
      entityName: 'support',
      startedAt: '2026-08-14T10:00:00.000Z',
      durationMs: 2000,
      threadId: 't-21',
    }),
    ...aggregateRoot({
      cursorId: 1020,
      traceId: 'sup-2',
      entityName: 'support',
      startedAt: '2026-08-14T11:00:00.000Z',
      durationMs: 2000,
      threadId: 't-21',
    }),
    ...aggregateRoot({
      cursorId: 1030,
      traceId: 'sup-3',
      entityName: 'support',
      startedAt: '2026-08-15T10:00:00.000Z',
      durationMs: 2000,
      threadId: 't-22',
    }),
    ...aggregateRoot({
      cursorId: 1040,
      traceId: 'sup-4',
      entityName: 'support',
      startedAt: '2026-08-31T23:59:00.000Z',
      durationMs: 120_000,
      threadId: 't-22',
    }),
    ...aggregateRoot({
      cursorId: 1050,
      traceId: 'res-1',
      entityName: 'research',
      startedAt: '2026-08-14T10:00:00.000Z',
      durationMs: 2000,
      threadId: 't-23',
    }),
    ...aggregateRoot({
      cursorId: 1060,
      traceId: 'res-2',
      entityName: 'research',
      startedAt: '2026-08-15T10:00:00.000Z',
      durationMs: 2000,
      threadId: 't-23',
    }),
    ...aggregateRoot({
      cursorId: 1070,
      traceId: 'bil-1',
      entityName: 'billing',
      startedAt: '2026-08-20T10:00:00.000Z',
      durationMs: 2000,
      threadId: 't-24',
    }),
    ...aggregateRoot({
      cursorId: 1080,
      traceId: 'bil-2',
      entityName: 'billing',
      startedAt: '2026-08-20T11:00:00.000Z',
      durationMs: 2000,
      threadId: 't-24',
    }),
    ...aggregateRoot({
      cursorId: 1090,
      traceId: 'sch-1',
      entityName: 'scheduler',
      startedAt: '2026-08-21T10:00:00.000Z',
      durationMs: 2000,
      threadId: 't-25',
    }),
    ...aggregateRoot({
      cursorId: 1100,
      traceId: 'sch-2',
      entityName: 'scheduler',
      startedAt: '2026-08-22T10:00:00.000Z',
      durationMs: 2000,
      threadId: 't-25',
    }),
    span(1110, 'resume-1', 'resume-1-a', {
      entityName: 'planner-suspended',
      organizationId: 'org-a',
      threadId: 't-26',
      startedAt: '2026-08-25T10:00:00.000Z',
      endedAt: '2026-08-25T10:01:00.000Z',
    }),
    span(1120, 'resume-1', 'resume-1-b', {
      entityName: 'planner',
      organizationId: 'org-a',
      threadId: 't-26',
      metadata: { resumedFromSpanId: 'resume-1-a' },
      startedAt: '2026-08-26T09:00:00.000Z',
      endedAt: '2026-08-26T09:02:00.000Z',
    }),
    ...aggregateRoot({
      cursorId: 1130,
      traceId: 'tenant-check',
      entityName: 'tenant-check',
      startedAt: '2026-09-10T10:00:00.000Z',
      durationMs: 2000,
      threadId: 't-27',
    }),
  ],
  scores: [],
  feedback: [],
  metrics: [
    tokenMetric('early-1-pre', 'early-1', 'early-1', INPUT, 999, '2026-05-31T23:59:59.000Z', usd(9)),
    tokenMetric('early-1-in', 'early-1', 'early-1', INPUT, 100, '2026-06-01T00:00:11.000Z', usd(0.125)),
    tokenMetric('early-1-out', 'early-1', 'early-1', OUTPUT, 20, '2026-06-01T00:00:11.000Z', usd(0.125)),

    tokenMetric('sup-1-in', 'sup-1', 'sup-1', INPUT, 1000, after('2026-08-14T10:00:00.000Z', 1), usd(0.25)),
    tokenMetric('sup-1-in', 'sup-1', 'sup-1', INPUT, 1000, after('2026-08-14T10:00:00.000Z', 1), usd(0.25)),
    tokenMetric('sup-1-out', 'sup-1', 'sup-1', OUTPUT, 200, after('2026-08-14T10:00:00.000Z', 1), usd(0.5)),
    tokenMetric('sup-1-text', 'sup-1', 'sup-1', INPUT_TEXT, 600, after('2026-08-14T10:00:00.000Z', 1), usd(0.125)),
    tokenMetric('sup-1-cache', 'sup-1', 'sup-1', CACHED, 400, after('2026-08-14T10:00:00.000Z', 1), usd(0.125)),
    tokenMetric('sup-1-rsn', 'sup-1', 'sup-1', REASONING, 50, after('2026-08-14T10:00:00.000Z', 1), usd(0.125)),

    tokenMetric('sup-2-in', 'sup-2', 'sup-2', INPUT, 2000, after('2026-08-14T11:00:00.000Z', 1), usd(1)),
    tokenMetric('sup-2-out', 'sup-2', 'sup-2', OUTPUT, 400, after('2026-08-14T11:00:00.000Z', 1)),

    tokenMetric('sup-3-in', 'sup-3', 'sup-3', INPUT, 500, after('2026-08-15T10:00:00.000Z', 1), {
      estimatedCost: null,
      error: 'no_matching_model',
    }),
    tokenMetric('sup-3-out', 'sup-3', 'sup-3', OUTPUT, 100, after('2026-08-15T10:00:00.000Z', 1), {
      estimatedCost: null,
      error: 'no_matching_model',
    }),

    tokenMetric('sup-4-in', 'sup-4', 'sup-4', INPUT, 3000, '2026-09-01T00:00:30.000Z', usd(1.5)),
    tokenMetric('sup-4-out', 'sup-4', 'sup-4', OUTPUT, 600, '2026-09-01T00:00:30.000Z', usd(0.5)),

    tokenMetric('res-1-in', 'res-1', 'res-1', INPUT, 800, after('2026-08-14T10:00:00.000Z', 1), usd(0.5)),
    tokenMetric('res-1-out', 'res-1', 'res-1', OUTPUT, 100, after('2026-08-14T10:00:00.000Z', 1), usd(0.25)),
    tokenMetric('res-2-in', 'res-2', 'res-2', INPUT, 1200, after('2026-08-15T10:00:00.000Z', 1), eur(1)),
    tokenMetric('res-2-out', 'res-2', 'res-2', OUTPUT, 300, after('2026-08-15T10:00:00.000Z', 1), eur(0.5)),

    tokenMetric('bil-1-in', 'bil-1', 'bil-1', INPUT, 1000, after('2026-08-20T10:00:00.000Z', 1), {
      estimatedCost: 0.75,
      costUnit: 'usd',
      error: 'partial_cost',
    }),
    tokenMetric('bil-1-out', 'bil-1', 'bil-1', OUTPUT, 120, after('2026-08-20T10:00:00.000Z', 1)),
    tokenMetric('bil-2-in', 'bil-2', 'bil-2', INPUT, 600, after('2026-08-20T11:00:00.000Z', 1), usd(0.25)),
    tokenMetric('bil-2-out', 'bil-2', 'bil-2', OUTPUT, 80, after('2026-08-20T11:00:00.000Z', 1), {
      estimatedCost: 0.125,
      costUnit: 'usd',
      error: 'no_pricing_for_usage_type',
    }),

    tokenMetric('resume-1-pre-in', 'resume-1', 'resume-1-a', INPUT, 400, '2026-08-25T10:00:30.000Z', usd(0.25)),
    tokenMetric('resume-1-pre-out', 'resume-1', 'resume-1-a', OUTPUT, 100, '2026-08-25T10:00:30.000Z', usd(0.25)),
    tokenMetric('resume-1-post-in', 'resume-1', 'resume-1-b-model', INPUT, 600, '2026-08-26T09:01:00.000Z', usd(0.5)),
    tokenMetric(
      'resume-1-post-out',
      'resume-1',
      'resume-1-b-model',
      OUTPUT,
      200,
      '2026-08-26T09:01:00.000Z',
      usd(0.25),
    ),

    tokenMetric('tenant-in', 'tenant-check', 'tenant-check', INPUT, 100, '2026-09-10T10:00:01.000Z', usd(0.125)),
    tokenMetric('tenant-out', 'tenant-check', 'tenant-check', OUTPUT, 10, '2026-09-10T10:00:01.000Z', usd(0.125)),
    tokenMetric(
      'tenant-foreign-in',
      'tenant-check',
      'tenant-check',
      INPUT,
      7000,
      '2026-09-10T10:00:01.000Z',
      usd(2),
      'org-b',
    ),
  ],
};

const supportDims = { entityName: 'support' };
const plannerDims = { entityName: 'planner' };
const triageDims = { entityName: 'triage' };
const billingDims = { entityName: 'billing' };
const researchDims = { entityName: 'research' };
const schedulerDims = { entityName: 'scheduler' };

const augDay = (d: number) => `2026-08-${String(d).padStart(2, '0')}T00:00:00.000Z`;

const noCost = { coverage: null, unit: null };

export const TRACE_AGGREGATE_TOKEN_CONFORMANCE_CASES: TraceAggregateConformanceCase[] = [
  {
    name: 'example 4: daily token spend and cost per agent, most expensive first',
    request: {
      timeRange: tokenRange,
      groupBy: ['entityName'],
      interval: '1d',
      measures: ['count', 'tokens.input.sum', 'tokens.output.sum', 'cost.sum'],
      orderBy: { field: 'cost.sum', direction: 'desc' },
      limit: 20,
    },
    expected: {
      rows: [
        {
          dimensions: supportDims,
          bucket: augDay(14),
          measures: {
            count: 2,
            'tokens.input.sum': 3000,
            'tokens.output.sum': 600,
            'cost.sum': 1.75,
          },
          cost: { coverage: 1, unit: 'usd' },
        },
        {
          dimensions: supportDims,
          bucket: augDay(15),
          measures: {
            count: 1,
            'tokens.input.sum': 500,
            'tokens.output.sum': 100,
            'cost.sum': null,
          },
          cost: { coverage: 0, unit: null },
        },
        {
          dimensions: supportDims,
          bucket: augDay(31),
          measures: {
            count: 1,
            'tokens.input.sum': 3000,
            'tokens.output.sum': 600,
            'cost.sum': 2,
          },
          cost: { coverage: 1, unit: 'usd' },
        },
        {
          dimensions: plannerDims,
          bucket: augDay(26),
          measures: {
            count: 1,
            'tokens.input.sum': 1000,
            'tokens.output.sum': 300,
            'cost.sum': 1.25,
          },
          cost: { coverage: 1, unit: 'usd' },
        },
        // billing and triage tie on 0.25 and break on entityName ascending.
        {
          dimensions: billingDims,
          bucket: augDay(20),
          measures: {
            count: 2,
            'tokens.input.sum': 1600,
            'tokens.output.sum': 200,
            'cost.sum': 0.25,
          },
          cost: { coverage: 0.5, unit: 'usd' },
        },
        {
          dimensions: triageDims,
          bucket: '2026-06-01T00:00:00.000Z',
          measures: {
            count: 1,
            'tokens.input.sum': 100,
            'tokens.output.sum': 20,
            'cost.sum': 0.25,
          },
          cost: { coverage: 1, unit: 'usd' },
        },
        // research is `mixed` over the whole window, so its null cost sorts last; each bucket has
        // a single unit and is priced.
        {
          dimensions: researchDims,
          bucket: augDay(14),
          measures: {
            count: 1,
            'tokens.input.sum': 800,
            'tokens.output.sum': 100,
            'cost.sum': 0.75,
          },
          cost: { coverage: 1, unit: 'usd' },
        },
        {
          dimensions: researchDims,
          bucket: augDay(15),
          measures: {
            count: 1,
            'tokens.input.sum': 1200,
            'tokens.output.sum': 300,
            'cost.sum': 1.5,
          },
          cost: { coverage: 1, unit: 'eur' },
        },
        {
          dimensions: schedulerDims,
          bucket: augDay(21),
          measures: { count: 1, 'tokens.input.sum': null, 'tokens.output.sum': null, 'cost.sum': null },
          cost: noCost,
        },
        {
          dimensions: schedulerDims,
          bucket: augDay(22),
          measures: { count: 1, 'tokens.input.sum': null, 'tokens.output.sum': null, 'cost.sum': null },
          cost: noCost,
        },
      ],
      truncated: false,
    },
  },
  {
    name: 'whole-window cost per agent: mixed units return null cost with unit mixed',
    request: {
      timeRange: tokenRange,
      groupBy: ['entityName'],
      measures: ['cost.sum', 'cost.avg'],
      orderBy: { field: 'cost.sum', direction: 'desc' },
    },
    expected: {
      rows: [
        {
          dimensions: supportDims,
          measures: { 'cost.sum': 3.75, 'cost.avg': 1.25 },
          cost: { coverage: 0.75, unit: 'usd' },
        },
        {
          dimensions: plannerDims,
          measures: { 'cost.sum': 1.25, 'cost.avg': 1.25 },
          cost: { coverage: 1, unit: 'usd' },
        },
        {
          dimensions: billingDims,
          measures: { 'cost.sum': 0.25, 'cost.avg': 0.25 },
          cost: { coverage: 0.5, unit: 'usd' },
        },
        {
          dimensions: triageDims,
          measures: { 'cost.sum': 0.25, 'cost.avg': 0.25 },
          cost: { coverage: 1, unit: 'usd' },
        },
        {
          dimensions: researchDims,
          measures: { 'cost.sum': null, 'cost.avg': null },
          cost: { coverage: 1, unit: 'mixed' },
        },
        { dimensions: schedulerDims, measures: { 'cost.avg': null, 'cost.sum': null }, cost: noCost },
      ],
      truncated: false,
    },
  },
  {
    name: 'ungrouped: every token and cost measure averages over usage-bearing traces only',
    request: {
      timeRange: tokenRange,
      where: { op: 'in', value: { path: 'entityName' }, set: ['support', 'scheduler', 'planner'] },
      measures: [
        'count',
        'tokens.input.sum',
        'tokens.input.avg',
        'tokens.output.sum',
        'tokens.output.avg',
        'tokens.total.sum',
        'tokens.total.avg',
        'tokens.reasoning.sum',
        'tokens.reasoning.avg',
        'tokens.cached.sum',
        'tokens.cached.avg',
        'cost.sum',
        'cost.avg',
      ],
    },
    expected: {
      rows: [
        {
          // 7 traces; 5 usage-bearing (not sch-1/2); 4 priced (not sup-3).
          measures: {
            count: 7,
            'tokens.input.sum': 7500,
            'tokens.input.avg': 1500,
            'tokens.output.sum': 1600,
            'tokens.output.avg': 320,
            'tokens.total.sum': 9100,
            'tokens.total.avg': 1820,
            'tokens.reasoning.sum': 50,
            'tokens.reasoning.avg': 10,
            'tokens.cached.sum': 400,
            'tokens.cached.avg': 80,
            'cost.sum': 5,
            'cost.avg': 1.25,
          },
          cost: { coverage: 0.8, unit: 'usd' },
        },
      ],
      truncated: false,
    },
  },
  {
    name: 'ungrouped over the whole window: one eur trace makes the population mixed',
    request: { timeRange: tokenRange, measures: ['count', 'tokens.total.sum', 'cost.sum'] },
    expected: {
      rows: [
        {
          // 12 traces; 10 usage-bearing; 8 priced (not sup-3, bil-1).
          measures: { count: 12, 'tokens.total.sum': 13420, 'cost.sum': null },
          cost: { coverage: 0.8, unit: 'mixed' },
        },
      ],
      truncated: false,
    },
  },
  {
    name: 'having and orderBy on tokens.total.sum drop the group with no usage',
    request: {
      timeRange: tokenRange,
      groupBy: ['entityName'],
      measures: ['tokens.total.sum'],
      having: { op: 'gte', left: { path: 'tokens.total.sum' }, right: { literal: 1000 } },
      orderBy: { field: 'tokens.total.sum', direction: 'desc' },
    },
    expected: {
      rows: [
        { dimensions: supportDims, measures: { 'tokens.total.sum': 7800 } },
        { dimensions: researchDims, measures: { 'tokens.total.sum': 2400 } },
        { dimensions: billingDims, measures: { 'tokens.total.sum': 1800 } },
        { dimensions: plannerDims, measures: { 'tokens.total.sum': 1300 } },
      ],
      truncated: false,
    },
  },
  {
    name: 'having on cost.sum removes null-cost groups',
    request: {
      timeRange: tokenRange,
      groupBy: ['entityName'],
      measures: ['cost.sum'],
      having: { op: 'gt', left: { path: 'cost.sum' }, right: { literal: 0.5 } },
    },
    expected: {
      rows: [
        { dimensions: supportDims, measures: { 'cost.sum': 3.75 }, cost: { coverage: 0.75, unit: 'usd' } },
        { dimensions: plannerDims, measures: { 'cost.sum': 1.25 }, cost: { coverage: 1, unit: 'usd' } },
      ],
      truncated: false,
    },
  },
  {
    name: 'not() over a null cost is unknown, so null-cost groups are still removed',
    request: {
      timeRange: tokenRange,
      groupBy: ['entityName'],
      measures: ['cost.sum'],
      having: { op: 'not', arg: { op: 'lte', left: { path: 'cost.sum' }, right: { literal: 0.5 } } },
    },
    expected: {
      rows: [
        { dimensions: supportDims, measures: { 'cost.sum': 3.75 }, cost: { coverage: 0.75, unit: 'usd' } },
        { dimensions: plannerDims, measures: { 'cost.sum': 1.25 }, cost: { coverage: 1, unit: 'usd' } },
      ],
      truncated: false,
    },
  },
  {
    name: 'orderBy tokens.input.avg asc sorts the group with no usage last',
    request: {
      timeRange: tokenRange,
      groupBy: ['entityName'],
      measures: ['count', 'tokens.input.avg'],
      orderBy: { field: 'tokens.input.avg', direction: 'asc' },
    },
    expected: {
      rows: [
        { dimensions: triageDims, measures: { count: 1, 'tokens.input.avg': 100 } },
        { dimensions: billingDims, measures: { count: 2, 'tokens.input.avg': 800 } },
        // planner and research tie on 1000 and break on entityName ascending.
        { dimensions: plannerDims, measures: { count: 1, 'tokens.input.avg': 1000 } },
        { dimensions: researchDims, measures: { count: 2, 'tokens.input.avg': 1000 } },
        { dimensions: supportDims, measures: { count: 4, 'tokens.input.avg': 1625 } },
        { dimensions: schedulerDims, measures: { count: 2, 'tokens.input.avg': null } },
      ],
      truncated: false,
    },
  },
  {
    name: 'an empty population returns no rows for token and cost measures',
    request: {
      timeRange: { from: '2026-01-01T00:00:00Z', to: '2026-02-01T00:00:00Z' },
      measures: ['tokens.total.sum', 'cost.sum'],
    },
    expected: { rows: [], truncated: false },
  },
  {
    name: 'unscoped: metric rows from another tenant sharing the traceId count',
    request: {
      timeRange: { from: '2026-09-01T00:00:00Z', to: '2026-10-01T00:00:00Z' },
      measures: ['tokens.input.sum', 'cost.sum'],
    },
    expected: {
      rows: [{ measures: { 'tokens.input.sum': 7100, 'cost.sum': 2.25 }, cost: { coverage: 1, unit: 'usd' } }],
      truncated: false,
    },
  },
  {
    name: 'scoped: metric rows from another tenant sharing the traceId are excluded',
    request: {
      timeRange: { from: '2026-09-01T00:00:00Z', to: '2026-10-01T00:00:00Z' },
      measures: ['tokens.input.sum', 'cost.sum'],
    },
    scope: { organizationId: 'org-a' },
    expected: {
      rows: [{ measures: { 'tokens.input.sum': 100, 'cost.sum': 0.25 }, cost: { coverage: 1, unit: 'usd' } }],
      truncated: false,
    },
  },
];
