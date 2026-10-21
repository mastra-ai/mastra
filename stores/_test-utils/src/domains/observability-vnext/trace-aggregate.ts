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
  type TraceAggregateDimension,
  type TraceAggregateRequest,
  type TraceAggregateResponse,
  type TraceAggregateRow,
  type TraceAggregateRowCost,
  type TraceQueryTenantScope,
  type TrustedSpanAggregatePlan,
  type TrustedTraceAggregateHavingPredicate,
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
 * candidate trace (`computeUsage`), then per group. See the `TrustedTraceAggregatePlan`
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
  /** Whether any total row failed to price. */
  hasPricingFailure: boolean;
  /** `costUnit` of every priced row. */
  costUnits: Set<string>;
}

const usageMetricNames = new Set<string>(TRACE_AGGREGATE_USAGE_METRIC_NAMES);
const costMetricNames = new Set<string>(TRACE_AGGREGATE_COST_METRIC_NAMES);

function hasCostError(metric: RawTraceAggregateMetric): boolean {
  const error = metric.costMetadata?.error;
  return error !== undefined && error !== null;
}

/**
 * A total row is priced when it has an `estimatedCost`, a `costUnit`, and either no
 * `costMetadata.error` or `partial_cost` (the cost of the token types the SDK could price).
 */
function isPricedMetric(metric: RawTraceAggregateMetric): boolean {
  return (
    metric.estimatedCost !== null &&
    metric.costUnit !== null &&
    (!hasCostError(metric) || metric.costMetadata?.error === 'partial_cost')
  );
}

/**
 * A total row failed to price when `costMetadata.error` is set (including `partial_cost`, which is
 * also priced) or it
 * has a cost without a unit. A total row with neither a cost nor an error is not a failure: when
 * the provider reports cost, only one of the call's total rows carries it.
 */
function isPricingFailure(metric: RawTraceAggregateMetric): boolean {
  return hasCostError(metric) || (metric.estimatedCost !== null && metric.costUnit === null);
}

/**
 * Usage stage: every token metric row for a candidate trace counts — including spend before a
 * suspend/resume and rows whose span was never persisted — deduplicated on `metricId`. Rows are
 * pruned only by `timestamp >= from` (no upper bound) and the trusted tenant scope. Traces with no
 * qualifying row are absent from the result, i.e. not usage-bearing.
 */
function computeUsage(
  metrics: RawTraceAggregateMetric[],
  rows: RawTraceQuerySpan[],
  plan: AggregatePlan,
  scope: AggregateScope,
): Map<string, TraceUsage> {
  const candidates = new Set(rows.map(scope.usageKey));
  const fromMs = Date.parse(plan.timeRange.from);
  const seen = new Set<string>();
  const usage = new Map<string, TraceUsage>();
  for (const metric of metrics) {
    const key = scope.metricKey(metric);
    if (key === null || !candidates.has(key)) continue;
    if (!usageMetricNames.has(metric.name)) continue;
    if (Date.parse(metric.timestamp) < fromMs) continue;
    if (!matchesScope(metric, plan.scope)) continue;
    if (seen.has(metric.metricId)) continue;
    seen.add(metric.metricId);

    let trace = usage.get(key);
    if (!trace) {
      trace = { tokens: new Map(), cost: 0, priced: false, hasPricingFailure: false, costUnits: new Set() };
      usage.set(key, trace);
    }
    trace.tokens.set(metric.name, (trace.tokens.get(metric.name) ?? 0) + metric.value);
    if (!costMetricNames.has(metric.name)) continue;
    if (isPricedMetric(metric)) {
      trace.cost += metric.estimatedCost!;
      trace.priced = true;
      trace.costUnits.add(metric.costUnit!);
    } else if (isPricingFailure(metric)) {
      trace.hasPricingFailure = true;
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

/** Either aggregate plan: both share group, measure, `having`, `orderBy`, and bucket semantics. */
type AggregatePlan = TrustedTraceAggregatePlan | TrustedSpanAggregatePlan;

/** What differs between trace and span aggregation once the population is selected. */
export interface AggregateScope {
  dimensionValue(row: RawTraceQuerySpan, dimension: string): string | null;
  /** Key a row's usage is aggregated under. */
  usageKey(row: RawTraceQuerySpan): string;
  /** Key of the row a metric belongs to, or `null` when it cannot belong to any. */
  metricKey(metric: RawTraceAggregateMetric): string | null;
}

function countDistinctValue(row: RawTraceQuerySpan, field: string, scope: AggregateScope): string | null {
  return field === 'traceId' ? row.traceId : scope.dimensionValue(row, field);
}

function durationMs(root: RawTraceQuerySpan): number {
  return Date.parse(root.endedAt!) - Date.parse(root.startedAt);
}

type MeasureValue = number | null;
type MeasureValues = Map<string, MeasureValue>;

interface GroupValues {
  measures: MeasureValues;
  /** Present when any `cost.*` measure is requested. */
  cost?: TraceAggregateRowCost;
}

function hasCostMeasure(plan: AggregatePlan): boolean {
  return plan.measures.some(measure => measure.type === 'canonical' && measure.name.startsWith('cost.'));
}

function computeMeasures(
  roots: RawTraceQuerySpan[],
  plan: AggregatePlan,
  usage: Map<string, TraceUsage>,
  scope: AggregateScope,
): GroupValues {
  const values: MeasureValues = new Map();
  const count = roots.length;
  const usageBearing = roots.flatMap(root => usage.get(scope.usageKey(root)) ?? []);
  const priced = usageBearing.filter(trace => trace.priced);
  const covered = priced.filter(trace => !trace.hasPricingFailure).length;
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
        const value = countDistinctValue(root, measure.field, scope);
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
      case 'tokens.input.sum':
      case 'tokens.input.avg':
      case 'tokens.output.sum':
      case 'tokens.output.avg':
      case 'tokens.total.sum':
      case 'tokens.total.avg':
      case 'tokens.reasoning.sum':
      case 'tokens.reasoning.avg':
      case 'tokens.cached.sum':
      case 'tokens.cached.avg': {
        if (usageBearing.length === 0) {
          values.set(measure.name, null);
          break;
        }
        const rule = TRACE_AGGREGATE_MEASURE_REGISTRY[measure.name];
        let sum = 0;
        for (const trace of usageBearing) {
          for (const name of rule.metricNames!) sum += trace.tokens.get(name) ?? 0;
        }
        values.set(measure.name, rule.statistic === 'avg' ? sum / usageBearing.length : sum);
        break;
      }
      default: {
        const unhandled: never = measure;
        throw new Error(`Unhandled measure: ${JSON.stringify(unhandled)}`);
      }
    }
  }
  if (!hasCostMeasure(plan)) return { measures: values };
  return {
    measures: values,
    cost: {
      coverage: usageBearing.length === 0 ? null : covered / usageBearing.length,
      unit: priced.length === 0 ? null : mixedUnits ? TRACE_AGGREGATE_MIXED_COST_UNIT : [...costUnits][0]!,
    },
  };
}

/**
 * SQL three-valued `having`: `null` is UNKNOWN. A comparison or membership test against a null
 * measure is UNKNOWN, `not` keeps UNKNOWN, `and` / `or` follow Kleene logic, and only TRUE keeps
 * the group.
 */
function evaluateHaving(
  predicate: TrustedTraceAggregateHavingPredicate<string>,
  measures: MeasureValues,
): boolean | null {
  switch (predicate.type) {
    case 'boolean': {
      const results = predicate.args.map(arg => evaluateHaving(arg, measures));
      const decisive = predicate.operator !== 'and';
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

function compareGroups(left: Group, right: Group, plan: AggregatePlan): number {
  const orderBy = plan.orderBy;
  const dimensions: readonly string[] = plan.dimensions;
  const primary =
    orderBy.target === 'measure'
      ? compareNullable(
          left.values.measures.get(orderBy.measure)!,
          right.values.measures.get(orderBy.measure)!,
          orderBy.direction,
        )
      : compareNullable(
          left.dimensions[dimensions.indexOf(orderBy.dimension)]!,
          right.dimensions[dimensions.indexOf(orderBy.dimension)]!,
          orderBy.direction,
        );
  if (primary !== 0) return primary;
  for (let index = 0; index < plan.dimensions.length; index += 1) {
    const order = compareNullable(left.dimensions[index]!, right.dimensions[index]!, 'asc');
    if (order !== 0) return order;
  }
  return 0;
}

function projectValues(values: GroupValues, plan: AggregatePlan): Pick<TraceAggregateRow, 'measures' | 'cost'> {
  const measures = Object.fromEntries(plan.measures.map(measure => [measure.name, values.measures.get(measure.name)!]));
  return { measures: measures as TraceAggregateRow['measures'], ...(values.cost && { cost: values.cost }) };
}

function rowDimensions(group: Group, plan: AggregatePlan): TraceAggregateRow['dimensions'] {
  const dimensions: Record<string, string | null> = {};
  plan.dimensions.forEach((dimension, index) => {
    dimensions[dimension] = group.dimensions[index]!;
  });
  return dimensions;
}

const traceScope: AggregateScope = {
  dimensionValue: (root, dimension) => traceQueryDimensionValue(root, dimension as TraceAggregateDimension),
  usageKey: root => root.traceId!,
  metricKey: metric => metric.traceId,
};

export function evaluateTraceAggregate(
  data: TraceAggregateFixtureData,
  plan: TrustedTraceAggregatePlan,
): TraceAggregateResponse {
  return evaluateAggregate(selectTraceQueryRoots(data, plan), data.metrics ?? [], plan, traceScope);
}

/**
 * Groups, measures, filters, orders, limits, and buckets an already-selected population. Shared
 * by the trace and span evaluators so the two scopes cannot drift.
 */
export function evaluateAggregate(
  roots: RawTraceQuerySpan[],
  metrics: RawTraceAggregateMetric[],
  plan: AggregatePlan,
  scope: AggregateScope,
): TraceAggregateResponse {
  const usage = computeUsage(metrics, roots, plan, scope);

  const groupsByKey = new Map<string, Group>();
  for (const root of roots) {
    const dimensions = plan.dimensions.map(dimension => scope.dimensionValue(root, dimension));
    const key = JSON.stringify(dimensions);
    let group = groupsByKey.get(key);
    if (!group) {
      group = { dimensions, roots: [], values: { measures: new Map() } };
      groupsByKey.set(key, group);
    }
    group.roots.push(root);
  }

  const groups = [...groupsByKey.values()];
  for (const group of groups) group.values = computeMeasures(group.roots, plan, usage, scope);

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
        ...projectValues(computeMeasures(buckets.get(bucketMs)!, plan, usage, scope), plan),
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
  /** Root span name; defaults to `traceId`. */
  name?: string;
  /** Root span type; defaults to `agent_run`. */
  spanType?: string;
  entityId?: string;
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
    name: spec.name ?? spec.traceId,
    spanType: spec.spanType ?? 'agent_run',
    entityName: spec.entityName,
    entityId: spec.entityId ?? null,
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
 * | unnamed-1   | 2   | 700   |     | t-12   |            |        | `entityName: null`, `entityId: nightly-scorer` |
 *
 * `billing-2` also has a child `scorer_run` span with `entityId: nightly-scorer`, which only span-scope
 * `entityId` predicates match.
 *
 * Whole-window groups by `entityName`: triage 6 (2 errors, p95 8000), billing 5 (1 error,
 * p95 2500), support 4 (1 error, p95 6000), research 2 (1 error, p95 12000), scheduler 2
 * (p95 2900), null 1. Total 20 traces, 5 errors.
 *
 * Excluded records: a superseded `triage-6` root (lower `cursorId`, error, 4 s, ending before the
 * current copy), a
 * pending `triage-pending` root, and a `triage-late` root starting exactly at `to`.
 *
 * Root spans are `agent_run` named after their `traceId`, except: triage roots share the name
 * `triage run`, scheduler roots are `workflow_run` named `nightly-sync`, and the superseded
 * `triage-6` copy is a `workflow_run` named `triage retry` (so it must not surface).
 */
export const TRACE_AGGREGATE_FIXTURE_DATA: TraceQueryFixtureData = {
  spans: [
    ...aggregateRoot({
      cursorId: 100,
      traceId: 'triage-1',
      entityName: 'triage',
      name: 'triage run',
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
      name: 'triage run',
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
      name: 'triage run',
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
      name: 'triage run',
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
      name: 'triage run',
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
      name: 'triage retry',
      spanType: 'workflow_run',
      startedAt: '2026-08-05T11:00:00.000Z',
      durationMs: 4000,
      error: true,
      threadId: 't-4',
    }),
    ...aggregateRoot({
      cursorId: 151,
      traceId: 'triage-6',
      entityName: 'triage',
      name: 'triage run',
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
    // A child scorer span reusing a root entityId: trace-scope `entityId` must not match it.
    span(211, 'billing-2', 'billing-2-scorer', {
      parentSpanId: 'billing-2',
      name: 'nightly-scorer',
      spanType: 'scorer_run',
      entityType: 'scorer',
      entityId: 'nightly-scorer',
      entityName: null,
      organizationId: 'org-a',
      threadId: 't-5',
      startedAt: '2026-08-02T10:00:00.500Z',
      endedAt: '2026-08-02T10:00:01.000Z',
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
      name: 'nightly-sync',
      spanType: 'workflow_run',
      startedAt: '2026-08-01T10:00:00.000Z',
      durationMs: 1000,
      threadId: 't-11',
    }),
    ...aggregateRoot({
      cursorId: 510,
      traceId: 'scheduler-2',
      entityName: 'scheduler',
      name: 'nightly-sync',
      spanType: 'workflow_run',
      startedAt: '2026-08-03T10:00:00.000Z',
      durationMs: 3000,
      threadId: 't-11',
    }),
    ...aggregateRoot({
      cursorId: 600,
      traceId: 'unnamed-1',
      entityName: null,
      entityId: 'nightly-scorer',
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
      name: 'triage run',
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
    name: 'groups by root span type',
    request: { timeRange: aggregateRange, groupBy: ['spanType'], measures: ['count', 'errorCount'] },
    expected: {
      rows: [
        { dimensions: { spanType: 'agent_run' }, measures: { count: 18, errorCount: 5 } },
        { dimensions: { spanType: 'workflow_run' }, measures: { count: 2, errorCount: 0 } },
      ],
      truncated: false,
    },
  },
  {
    name: 'groups by root span name with orderBy and limit',
    request: {
      timeRange: aggregateRange,
      groupBy: ['name'],
      measures: ['count', 'errorCount'],
      orderBy: { field: 'count', direction: 'desc' },
      limit: 2,
    },
    expected: {
      rows: [
        { dimensions: { name: 'triage run' }, measures: { count: 6, errorCount: 2 } },
        { dimensions: { name: 'nightly-sync' }, measures: { count: 2, errorCount: 0 } },
      ],
      truncated: true,
    },
  },
  {
    name: 'drills into a root span type group by filtering on it',
    request: {
      timeRange: aggregateRange,
      where: { op: 'eq', left: { path: 'spanType' }, right: { literal: 'workflow_run' } },
      groupBy: ['name'],
      measures: ['count', 'countDistinct.spanType'],
    },
    expected: {
      rows: [{ dimensions: { name: 'nightly-sync' }, measures: { count: 2, 'countDistinct.spanType': 1 } }],
      truncated: false,
    },
  },
  {
    name: 'drills into a root span name group by filtering on it',
    request: {
      timeRange: aggregateRange,
      where: { op: 'eq', left: { path: 'name' }, right: { literal: 'triage run' } },
      groupBy: ['spanType', 'entityName'],
      measures: ['count'],
    },
    expected: {
      rows: [{ dimensions: { spanType: 'agent_run', entityName: 'triage' }, measures: { count: 6 } }],
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
    name: 'entityId groups the traces that have no entityName',
    request: {
      timeRange: aggregateRange,
      where: { op: 'notExists', path: 'entityName' },
      groupBy: ['entityId'],
      measures: ['count'],
    },
    expected: {
      rows: [{ dimensions: { entityId: 'nightly-scorer' }, measures: { count: 1 } }],
      truncated: false,
    },
  },
  {
    name: 'drills into an entityId group by filtering on the root entityId only',
    request: {
      timeRange: aggregateRange,
      where: { op: 'eq', left: { path: 'entityId' }, right: { literal: 'nightly-scorer' } },
      groupBy: ['entityId'],
      measures: ['count', 'countDistinct.traceId'],
    },
    expected: {
      rows: [{ dimensions: { entityId: 'nightly-scorer' }, measures: { count: 1, 'countDistinct.traceId': 1 } }],
      truncated: false,
    },
  },
  {
    name: 'span-scope entityId also matches child spans that share a root entityId',
    request: {
      timeRange: aggregateRange,
      where: { spans: { some: { op: 'eq', left: { path: 'entityId' }, right: { literal: 'nightly-scorer' } } } },
      measures: ['count'],
    },
    expected: { rows: [{ measures: { count: 2 } }], truncated: false },
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
    costUnit: cost.costUnit !== undefined ? cost.costUnit : cost.estimatedCost === null ? null : 'usd',
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
 * priced total rows only, including `partial_cost` rows. A trace is covered when it has a priced total row and no total row failed
 * to price.
 *
 * | trace     | entity    | day   | in   | out | rsn | cache | cost      | covered | notes                                         |
 * |-----------|-----------|-------|------|-----|-----|-------|-----------|---------|-----------------------------------------------|
 * | early-1   | triage    | 06-01 | 100  | 20  |     |       | 0.25 usd  | yes     | resumed; pre-`from` spend (999 in) pruned      |
 * | sup-1     | support   | 08-14 | 1000 | 200 | 50  | 400   | 0.75 usd  | yes     | costed detail rows ignored; dup `metricId`    |
 * | sup-2     | support   | 08-14 | 2000 | 400 |     |       | 1 usd     | yes     | cost on the input row only (`query_total`)    |
 * | sup-3     | support   | 08-15 | 500  | 100 |     |       | —         | no      | both rows `no_matching_model`                 |
 * | sup-4     | support   | 08-31 | 3000 | 600 |     |       | 2 usd     | yes     | ends and emits metrics after `to`             |
 * | res-1     | research  | 08-14 | 800  | 100 |     |       | 0.75 usd  | yes     |                                               |
 * | res-2     | research  | 08-15 | 1200 | 300 |     |       | 1.5 eur   | yes     | second unit → group is `mixed`                |
 * | bil-1     | billing   | 08-20 | 1000 | 120 |     |       | 0.75 usd  | no      | `partial_cost` 0.75 (retried); unitless 0.125 |
 * | bil-2     | billing   | 08-20 | 600  | 80  |     |       | 0.25 usd  | no      | output row errored (its 0.125 is ignored)     |
 * | sch-1     | scheduler | 08-21 |      |     |     |       |           |         | no metric rows (retention skew)               |
 * | sch-2     | scheduler | 08-22 |      |     |     |       |           |         | no metric rows (retention skew)               |
 * | resume-1  | planner   | 08-26 | 1000 | 300 |     |       | 1.25 usd  | yes     | resumed: two roots, spend from both           |
 *
 * `resume-1` has an older root (`entityName: 'planner-suspended'`, 08-25) carrying 400 in / 100
 * out / 0.5 usd, and the current root (`planner`, 08-26, `metadata.resumedFromSpanId`) whose
 * 600 in / 200 out / 0.75 usd rows reference a model span that was never persisted. The trace
 * counts once, groups as `planner`, buckets on 08-26, and sums usage from both attempts.
 *
 * `early-1` was suspended before `from`: its older root (`triage-suspended`, 05-31) carries a
 * 999 in / 9 usd row recorded before `from`, which never counts. The current root is in the window.
 *
 * Whole-window groups by `entityName` (usage-bearing / covered → coverage):
 * support 4 traces, in 6500, out 1300, cost 3.75 usd (4 / 3 → 0.75); planner 1, in 1000, out
 * 300, cost 1.25 usd (1 / 1); triage 1, in 100, out 20, cost 0.25 usd (1 / 1); billing 2, in
 * 1600, out 200, cost 1 usd (2 / 0 → 0); research 2, in 2000, out 400, cost null `mixed`
 * (2 / 2); scheduler 2, no usage (tokens, cost, coverage, unit all null).
 *
 * Outside that window: `tenant-check` (`org-a`, 09-10) has 100 in / 10 out / 0.25 usd of
 * `org-a` rows plus an `org-b` row sharing its `traceId` (7000 in, 2 usd), which only an
 * unscoped plan counts.
 */
export const TRACE_AGGREGATE_TOKEN_FIXTURE_DATA: TraceAggregateFixtureData = {
  spans: [
    span(990, 'early-1', 'early-1-a', {
      entityName: 'triage-suspended',
      organizationId: 'org-a',
      threadId: 't-20',
      startedAt: '2026-05-31T23:59:00.000Z',
      endedAt: '2026-05-31T23:59:59.500Z',
    }),
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
    tokenMetric('early-1-pre', 'early-1', 'early-1-a', INPUT, 999, '2026-05-31T23:59:59.000Z', usd(9)),
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
    tokenMetric('bil-1-in', 'bil-1', 'bil-1', INPUT, 1000, after('2026-08-20T10:00:00.000Z', 1), {
      estimatedCost: 0.75,
      costUnit: 'usd',
      error: 'partial_cost',
    }),
    tokenMetric('bil-1-out', 'bil-1', 'bil-1', OUTPUT, 120, after('2026-08-20T10:00:00.000Z', 1), {
      estimatedCost: 0.125,
      costUnit: null,
    }),
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
        {
          dimensions: billingDims,
          bucket: augDay(20),
          measures: {
            count: 2,
            'tokens.input.sum': 1600,
            'tokens.output.sum': 200,
            'cost.sum': 1,
          },
          cost: { coverage: 0, unit: 'usd' },
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
          measures: { 'cost.sum': 1, 'cost.avg': 0.5 },
          cost: { coverage: 0, unit: 'usd' },
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
    name: 'partial_cost rows add their cost but leave the trace uncovered; other pricing errors add none',
    request: {
      timeRange: tokenRange,
      where: { op: 'eq', left: { path: 'entityName' }, right: { literal: 'billing' } },
      measures: ['count', 'cost.sum', 'cost.avg'],
    },
    expected: {
      rows: [
        {
          // bil-1: retried partial_cost 0.75 counts once, unitless 0.125 ignored. bil-2: 0.25 priced,
          // errored 0.125 ignored. Both traces carry a pricing failure, so neither is covered.
          measures: { count: 2, 'cost.sum': 1, 'cost.avg': 0.5 },
          cost: { coverage: 0, unit: 'usd' },
        },
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
          // 7 traces; 5 usage-bearing (not sch-1/2); 4 covered (not sup-3).
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
          // 12 traces; 10 usage-bearing; 7 covered (not sup-3, bil-1, bil-2).
          measures: { count: 12, 'tokens.total.sum': 13420, 'cost.sum': null },
          cost: { coverage: 0.7, unit: 'mixed' },
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
        { dimensions: billingDims, measures: { 'cost.sum': 1 }, cost: { coverage: 0, unit: 'usd' } },
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
        { dimensions: billingDims, measures: { 'cost.sum': 1 }, cost: { coverage: 0, unit: 'usd' } },
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
  {
    // A metadata dimension binds its JSON path before the usage stage's parameters; positional
    // backends must keep both in placeholder order.
    name: 'token and cost measures grouped by a metadata dimension, with having and orderBy',
    request: {
      timeRange: tokenRange,
      groupBy: ['metadata.resumedFromSpanId'],
      measures: ['count', 'tokens.total.sum', 'cost.sum'],
      having: { op: 'gt', left: { path: 'tokens.total.sum' }, right: { literal: 0 } },
      orderBy: { field: 'tokens.total.sum', direction: 'desc' },
    },
    expected: {
      rows: [
        {
          dimensions: { 'metadata.resumedFromSpanId': null },
          measures: { count: 11, 'tokens.total.sum': 12120, 'cost.sum': null },
          cost: { coverage: 2 / 3, unit: 'mixed' },
        },
        {
          dimensions: { 'metadata.resumedFromSpanId': 'resume-1-a' },
          measures: { count: 1, 'tokens.total.sum': 1300, 'cost.sum': 1.25 },
          cost: { coverage: 1, unit: 'usd' },
        },
      ],
      truncated: false,
    },
  },
];

const edgeRange = { from: '2026-08-21T09:00:00Z', to: '2026-08-23T00:00:00Z' };

/**
 * Metric-row edge cases the token fixture does not reach, on the two `scheduler` roots of the
 * token fixture (window `[2026-08-21T09:00, 2026-08-23)`):
 *
 * | metricId   | trace | timestamp               | in  | out | cost      | notes                                 |
 * |------------|-------|-------------------------|-----|-----|-----------|---------------------------------------|
 * | edge-dup   | sch-1 | 08-21T10:00:01.000      | 100 |     | 0.25 usd  | `costMetadata: { error: null }`       |
 * | edge-dup   | sch-1 | 08-21T11:00:00.000      | 100 |     | 0.25 usd  | retried copy, different timestamp     |
 * | edge-out   | sch-1 | 08-21T10:00:01.000      |     | 10  | 0.125 usd | `costMetadata: { error: null }`       |
 * | edge-from  | sch-2 | 08-21T09:00:00.000      | 50  |     | 0.5 usd   | exactly at `from`: counts             |
 * | edge-pre   | sch-2 | 08-21T08:59:59.999      | 7   |     | 4 usd     | 1 ms before `from`: pruned            |
 *
 * Scheduler: in 150, out 10, cost 0.875 usd, both traces covered.
 */
export const TRACE_AGGREGATE_TOKEN_EDGE_FIXTURE_DATA: TraceAggregateFixtureData = {
  spans: TRACE_AGGREGATE_TOKEN_FIXTURE_DATA.spans.filter(span => span.traceId === 'sch-1' || span.traceId === 'sch-2'),
  scores: [],
  feedback: [],
  metrics: [
    {
      ...tokenMetric('edge-dup', 'sch-1', 'sch-1', INPUT, 100, '2026-08-21T10:00:01.000Z', usd(0.25)),
      costMetadata: { error: null },
    },
    {
      ...tokenMetric('edge-dup', 'sch-1', 'sch-1', INPUT, 100, '2026-08-21T11:00:00.000Z', usd(0.25)),
      costMetadata: { error: null },
    },
    {
      ...tokenMetric('edge-out', 'sch-1', 'sch-1', OUTPUT, 10, '2026-08-21T10:00:01.000Z', usd(0.125)),
      costMetadata: { error: null },
    },
    tokenMetric('edge-from', 'sch-2', 'sch-2', INPUT, 50, '2026-08-21T09:00:00.000Z', usd(0.5)),
    tokenMetric('edge-pre', 'sch-2', 'sch-2', INPUT, 7, '2026-08-21T08:59:59.999Z', usd(4)),
  ],
};

export const TRACE_AGGREGATE_TOKEN_EDGE_CONFORMANCE_CASES: TraceAggregateConformanceCase[] = [
  {
    name: 'edge: retried metricId at a different timestamp, inclusive from, and a JSON-null cost error',
    request: {
      timeRange: edgeRange,
      groupBy: ['entityName'],
      measures: ['count', 'tokens.input.sum', 'tokens.output.sum', 'cost.sum'],
    },
    expected: {
      rows: [
        {
          dimensions: schedulerDims,
          measures: { count: 2, 'tokens.input.sum': 150, 'tokens.output.sum': 10, 'cost.sum': 0.875 },
          cost: { coverage: 1, unit: 'usd' },
        },
      ],
      truncated: false,
    },
  },
];

// ---------------------------------------------------------------------------------------------
// 365-day fixture: the widest window the planner accepts, at the finest interval it allows
// over that window (`1d`, 365 buckets). It proves stores honor whole-window group ranking and
// never cut a series short when `interval` and `limit` combine over a long range.
// ---------------------------------------------------------------------------------------------

const YEAR_FROM_MS = Date.parse('2025-10-01T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const yearRange = { from: '2025-10-01T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z' };

/** Start of the window's `offset`-th UTC day; day 0 is `from`, day 364 is the last bucket. */
const yearDay = (offset: number) => new Date(YEAR_FROM_MS + offset * DAY_MS).toISOString();
const yearAt = (offset: number, time: string) =>
  new Date(YEAR_FROM_MS + offset * DAY_MS + Date.parse(`1970-01-01T${time}Z`)).toISOString();

interface YearRootSpec {
  cursorId: number;
  traceId: string;
  entityName: string | null;
  day: number;
  time?: string;
  durationMs: number;
  error?: boolean;
}

function yearRoot(spec: YearRootSpec): RawTraceQuerySpan[] {
  return aggregateRoot({
    cursorId: spec.cursorId,
    traceId: spec.traceId,
    entityName: spec.entityName,
    startedAt: yearAt(spec.day, spec.time ?? '12:00:00.000'),
    durationMs: spec.durationMs,
    error: spec.error,
    threadId: `year-${spec.entityName ?? 'unnamed'}`,
    environment: spec.entityName === null ? 'staging' : 'production',
  });
}

/**
 * Window `[2025-10-01, 2026-10-01)`: exactly 365 days, 365 aligned `1d` buckets. Days are
 * offsets from `from`; roots start at 12:00 UTC unless noted. All roots are `org-a`.
 *
 * | group   | traces | days (count if > 1)                                       | ms   | errors              |
 * |---------|--------|-----------------------------------------------------------|------|---------------------|
 * | alpha   | 12     | 0 (00:00:00.000), 30, 61, 91, 122, 152, 183, 213, 244,     | 1000 | days 30, 183        |
 * |         |        | 274, 305, 364 (23:59:59.999)                               |      |                     |
 * | beta    | 12     | 10 (2), 50, 100 (2), 150, 200, 250, 300, 340, 350, 360     | 2000 | one on day 100      |
 * | gamma   | 11     | 20, 80, 140, 180 (6, 01:00–06:00), 260, 320                | 3000 | two on 180, one 260 |
 * |         |        |                                                            | (5000 on day 180)   |
 * | delta   | 4      | 0, 120, 240, 363                                           | 9000 |                     |
 * | null    | 2      | 45, 290 (environment `staging`)                            | 500  |                     |
 *
 * Whole-window ranking by count: alpha 12 and beta 12 tie (alpha first by dimension), then
 * gamma 11, delta 4, null 2. Gamma alone holds the largest bucket (6 traces on day 180), so
 * any ranking computed per bucket — or a row-based `LIMIT` — picks the wrong groups.
 * Total 41 traces, 6 errors; sorted durations are 500×2, 1000×12, 2000×12, 3000×5, 5000×6,
 * 9000×4, so p50 (rank 20) is 2000 and p95 (rank 38) is 9000 with no interpolation.
 *
 * Excluded records: `year-early` starts 1 ms before `from`, `year-late` starts exactly at
 * `to`, and `beta-07` has a superseded copy (lower `cursorId`, ending earlier on the same day)
 * recorded as a failed `gamma` run that must not surface.
 */
export const TRACE_AGGREGATE_YEAR_FIXTURE_DATA: TraceQueryFixtureData = {
  spans: [
    ...yearRoot({
      cursorId: 3000,
      traceId: 'alpha-01',
      entityName: 'alpha',
      day: 0,
      time: '00:00:00.000',
      durationMs: 1000,
    }),
    ...yearRoot({ cursorId: 3001, traceId: 'alpha-02', entityName: 'alpha', day: 30, durationMs: 1000, error: true }),
    ...yearRoot({ cursorId: 3002, traceId: 'alpha-03', entityName: 'alpha', day: 61, durationMs: 1000 }),
    ...yearRoot({ cursorId: 3003, traceId: 'alpha-04', entityName: 'alpha', day: 91, durationMs: 1000 }),
    ...yearRoot({ cursorId: 3004, traceId: 'alpha-05', entityName: 'alpha', day: 122, durationMs: 1000 }),
    ...yearRoot({ cursorId: 3005, traceId: 'alpha-06', entityName: 'alpha', day: 152, durationMs: 1000 }),
    ...yearRoot({ cursorId: 3006, traceId: 'alpha-07', entityName: 'alpha', day: 183, durationMs: 1000, error: true }),
    ...yearRoot({ cursorId: 3007, traceId: 'alpha-08', entityName: 'alpha', day: 213, durationMs: 1000 }),
    ...yearRoot({ cursorId: 3008, traceId: 'alpha-09', entityName: 'alpha', day: 244, durationMs: 1000 }),
    ...yearRoot({ cursorId: 3009, traceId: 'alpha-10', entityName: 'alpha', day: 274, durationMs: 1000 }),
    ...yearRoot({ cursorId: 3010, traceId: 'alpha-11', entityName: 'alpha', day: 305, durationMs: 1000 }),
    ...yearRoot({
      cursorId: 3011,
      traceId: 'alpha-12',
      entityName: 'alpha',
      day: 364,
      time: '23:59:59.999',
      durationMs: 1000,
    }),
    ...yearRoot({
      cursorId: 3100,
      traceId: 'beta-01',
      entityName: 'beta',
      day: 10,
      time: '10:00:00.000',
      durationMs: 2000,
    }),
    ...yearRoot({
      cursorId: 3101,
      traceId: 'beta-02',
      entityName: 'beta',
      day: 10,
      time: '14:00:00.000',
      durationMs: 2000,
    }),
    ...yearRoot({ cursorId: 3102, traceId: 'beta-03', entityName: 'beta', day: 50, durationMs: 2000 }),
    ...yearRoot({
      cursorId: 3103,
      traceId: 'beta-04',
      entityName: 'beta',
      day: 100,
      time: '10:00:00.000',
      durationMs: 2000,
      error: true,
    }),
    ...yearRoot({
      cursorId: 3104,
      traceId: 'beta-05',
      entityName: 'beta',
      day: 100,
      time: '14:00:00.000',
      durationMs: 2000,
    }),
    ...yearRoot({ cursorId: 3105, traceId: 'beta-06', entityName: 'beta', day: 150, durationMs: 2000 }),
    // Superseded copy of `beta-07`; it precedes the current copy so completion-only writers keep the latter,
    // and ends before it, as a re-exported root does.
    ...yearRoot({ cursorId: 3106, traceId: 'beta-07', entityName: 'gamma', day: 200, durationMs: 1000, error: true }),
    ...yearRoot({ cursorId: 3107, traceId: 'beta-07', entityName: 'beta', day: 200, durationMs: 2000 }),
    ...yearRoot({ cursorId: 3108, traceId: 'beta-08', entityName: 'beta', day: 250, durationMs: 2000 }),
    ...yearRoot({ cursorId: 3109, traceId: 'beta-09', entityName: 'beta', day: 300, durationMs: 2000 }),
    ...yearRoot({ cursorId: 3110, traceId: 'beta-10', entityName: 'beta', day: 340, durationMs: 2000 }),
    ...yearRoot({ cursorId: 3111, traceId: 'beta-11', entityName: 'beta', day: 350, durationMs: 2000 }),
    ...yearRoot({ cursorId: 3112, traceId: 'beta-12', entityName: 'beta', day: 360, durationMs: 2000 }),
    ...yearRoot({ cursorId: 3200, traceId: 'gamma-01', entityName: 'gamma', day: 20, durationMs: 3000 }),
    ...yearRoot({ cursorId: 3201, traceId: 'gamma-02', entityName: 'gamma', day: 80, durationMs: 3000 }),
    ...yearRoot({
      cursorId: 3202,
      traceId: 'gamma-03',
      entityName: 'gamma',
      day: 180,
      time: '01:00:00.000',
      durationMs: 5000,
      error: true,
    }),
    ...yearRoot({
      cursorId: 3203,
      traceId: 'gamma-04',
      entityName: 'gamma',
      day: 180,
      time: '02:00:00.000',
      durationMs: 5000,
      error: true,
    }),
    ...yearRoot({
      cursorId: 3204,
      traceId: 'gamma-05',
      entityName: 'gamma',
      day: 180,
      time: '03:00:00.000',
      durationMs: 5000,
    }),
    ...yearRoot({
      cursorId: 3205,
      traceId: 'gamma-06',
      entityName: 'gamma',
      day: 180,
      time: '04:00:00.000',
      durationMs: 5000,
    }),
    ...yearRoot({
      cursorId: 3206,
      traceId: 'gamma-07',
      entityName: 'gamma',
      day: 180,
      time: '05:00:00.000',
      durationMs: 5000,
    }),
    ...yearRoot({
      cursorId: 3207,
      traceId: 'gamma-08',
      entityName: 'gamma',
      day: 180,
      time: '06:00:00.000',
      durationMs: 5000,
    }),
    ...yearRoot({ cursorId: 3208, traceId: 'gamma-09', entityName: 'gamma', day: 140, durationMs: 3000 }),
    ...yearRoot({ cursorId: 3209, traceId: 'gamma-10', entityName: 'gamma', day: 260, durationMs: 3000, error: true }),
    ...yearRoot({ cursorId: 3210, traceId: 'gamma-11', entityName: 'gamma', day: 320, durationMs: 3000 }),
    ...yearRoot({ cursorId: 3300, traceId: 'delta-1', entityName: 'delta', day: 0, durationMs: 9000 }),
    ...yearRoot({ cursorId: 3301, traceId: 'delta-2', entityName: 'delta', day: 120, durationMs: 9000 }),
    ...yearRoot({ cursorId: 3302, traceId: 'delta-3', entityName: 'delta', day: 240, durationMs: 9000 }),
    ...yearRoot({ cursorId: 3303, traceId: 'delta-4', entityName: 'delta', day: 363, durationMs: 9000 }),
    ...yearRoot({ cursorId: 3400, traceId: 'unnamed-y1', entityName: null, day: 45, durationMs: 500 }),
    ...yearRoot({ cursorId: 3401, traceId: 'unnamed-y2', entityName: null, day: 290, durationMs: 500 }),
    ...yearRoot({
      cursorId: 3500,
      traceId: 'year-early',
      entityName: 'alpha',
      day: -1,
      time: '23:59:59.999',
      durationMs: 1000,
    }),
    ...yearRoot({
      cursorId: 3501,
      traceId: 'year-late',
      entityName: 'alpha',
      day: 365,
      time: '00:00:00.000',
      durationMs: 1000,
    }),
  ],
  scores: [],
  feedback: [],
};

const alpha = { entityName: 'alpha' };
const beta = { entityName: 'beta' };
const gamma = { entityName: 'gamma' };
const delta = { entityName: 'delta' };
const unnamedYear = { entityName: null };

/** `[day, count, errorCount]` per non-empty bucket, bucket-ascending, read off the fixture table. */
type YearPoint = readonly [day: number, count: number, errorCount: number];
const alphaPoints: YearPoint[] = [
  [0, 1, 0],
  [30, 1, 1],
  [61, 1, 0],
  [91, 1, 0],
  [122, 1, 0],
  [152, 1, 0],
  [183, 1, 1],
  [213, 1, 0],
  [244, 1, 0],
  [274, 1, 0],
  [305, 1, 0],
  [364, 1, 0],
];
const betaPoints: YearPoint[] = [
  [10, 2, 0],
  [50, 1, 0],
  [100, 2, 1],
  [150, 1, 0],
  [200, 1, 0],
  [250, 1, 0],
  [300, 1, 0],
  [340, 1, 0],
  [350, 1, 0],
  [360, 1, 0],
];
const gammaPoints: YearPoint[] = [
  [20, 1, 0],
  [80, 1, 0],
  [140, 1, 0],
  [180, 6, 2],
  [260, 1, 1],
  [320, 1, 0],
];
const deltaPoints: YearPoint[] = [
  [0, 1, 0],
  [120, 1, 0],
  [240, 1, 0],
  [363, 1, 0],
];
const unnamedPoints: YearPoint[] = [
  [45, 1, 0],
  [290, 1, 0],
];

function yearSeries(
  dimensions: Record<string, string | null>,
  points: YearPoint[],
  withErrors = false,
): TraceAggregateExpectedResponse['rows'] {
  return points.map(([offset, count, errorCount]) => {
    const measures: Record<string, number> = withErrors ? { count, errorCount } : { count };
    return { dimensions, bucket: yearDay(offset), measures };
  });
}

export const TRACE_AGGREGATE_YEAR_CONFORMANCE_CASES: TraceAggregateConformanceCase[] = [
  {
    name: 'year: whole-window ranking over 365 days with the out-of-window and superseded roots excluded',
    request: { timeRange: yearRange, groupBy: ['entityName'], measures: ['count', 'errorCount'] },
    expected: {
      rows: [
        { dimensions: alpha, measures: { count: 12, errorCount: 2 } },
        { dimensions: beta, measures: { count: 12, errorCount: 1 } },
        { dimensions: gamma, measures: { count: 11, errorCount: 3 } },
        { dimensions: delta, measures: { count: 4, errorCount: 0 } },
        { dimensions: unnamedYear, measures: { count: 2, errorCount: 0 } },
      ],
      truncated: false,
    },
  },
  {
    name: 'year: daily series with limit 2 keep the top groups whole and drop the group with the largest bucket',
    request: {
      timeRange: yearRange,
      groupBy: ['entityName'],
      interval: '1d',
      measures: ['count', 'errorCount'],
      limit: 2,
    },
    expected: {
      rows: [...yearSeries(alpha, alphaPoints, true), ...yearSeries(beta, betaPoints, true)],
      truncated: true,
    },
  },
  {
    name: 'year: a count tie at the limit boundary keeps the dimension-ascending group',
    request: { timeRange: yearRange, groupBy: ['entityName'], interval: '1d', measures: ['count'], limit: 1 },
    expected: { rows: yearSeries(alpha, alphaPoints), truncated: true },
  },
  {
    name: 'year: ordering by dimension descending keeps the null group last with every series complete',
    request: {
      timeRange: yearRange,
      groupBy: ['entityName'],
      interval: '1d',
      measures: ['count'],
      orderBy: { field: 'entityName', direction: 'desc' },
      limit: 5,
    },
    expected: {
      rows: [
        ...yearSeries(gamma, gammaPoints),
        ...yearSeries(delta, deltaPoints),
        ...yearSeries(beta, betaPoints),
        ...yearSeries(alpha, alphaPoints),
        ...yearSeries(unnamedYear, unnamedPoints),
      ],
      truncated: false,
    },
  },
  {
    name: 'year: the ungrouped daily series includes the first and last bucket of the window',
    // The row cap counts `limit × buckets` even without groups, so the default limit of 100 is rejected here.
    request: { timeRange: yearRange, interval: '1d', measures: ['count'], limit: 1 },
    expected: {
      rows: (
        [
          [0, 2],
          [10, 2],
          [20, 1],
          [30, 1],
          [45, 1],
          [50, 1],
          [61, 1],
          [80, 1],
          [91, 1],
          [100, 2],
          [120, 1],
          [122, 1],
          [140, 1],
          [150, 1],
          [152, 1],
          [180, 6],
          [183, 1],
          [200, 1],
          [213, 1],
          [240, 1],
          [244, 1],
          [250, 1],
          [260, 1],
          [274, 1],
          [290, 1],
          [300, 1],
          [305, 1],
          [320, 1],
          [340, 1],
          [350, 1],
          [360, 1],
          [363, 1],
          [364, 1],
        ] as const
      ).map(([offset, count]) => ({ bucket: yearDay(offset), measures: { count } })),
      truncated: false,
    },
  },
  {
    name: 'year: whole-window totals, rates, percentiles, and distinct traces over 365 days',
    request: {
      timeRange: yearRange,
      measures: ['count', 'errorRate', 'duration.p50', 'duration.p95', 'countDistinct.traceId'],
    },
    expected: {
      rows: [
        {
          measures: {
            count: 41,
            errorRate: 6 / 41,
            'duration.p50': 2000,
            'duration.p95': 9000,
            'countDistinct.traceId': 41,
          },
        },
      ],
      truncated: false,
    },
    tolerance: { 'duration.p50': 100, 'duration.p95': 100 },
  },
  {
    name: 'year: the largest limit the row cap accepts at a daily interval over two dimensions',
    request: {
      timeRange: yearRange,
      groupBy: ['entityName', 'environment'],
      interval: '1d',
      measures: ['count'],
      limit: 27,
    },
    expected: {
      rows: [
        ...yearSeries({ ...alpha, environment: 'production' }, alphaPoints),
        ...yearSeries({ ...beta, environment: 'production' }, betaPoints),
        ...yearSeries({ ...gamma, environment: 'production' }, gammaPoints),
        ...yearSeries({ ...delta, environment: 'production' }, deltaPoints),
        ...yearSeries({ ...unnamedYear, environment: 'staging' }, unnamedPoints),
      ],
      truncated: false,
    },
  },
];

// ---------------------------------------------------------------------------------------------
// Root versions: a root exported again (a resumed or completed run) replaces its earlier export.
// ---------------------------------------------------------------------------------------------

const versionRange = { from: '2026-09-01T00:00:00Z', to: '2026-09-08T00:00:00Z' };

/**
 * Window `[2026-09-01, 2026-09-08)`, `production` / `org-a`. Each trace's later export (higher
 * `cursorId`) ends after its earlier one, as a re-exported root does, and both share `startedAt`.
 * Superseded versions differ in status, `entityName` and duration; two of them end the day before
 * their current version, so they sit in another `endedAt` partition.
 *
 * | trace | current                       | superseded                    | partitions |
 * |-------|-------------------------------|-------------------------------|------------|
 * | v-1   | alpha, success, 2000 ms       | beta, error, 1000 ms          | same       |
 * | v-2   | alpha, error, 3000 ms         | alpha, success, 500 ms        | same       |
 * | v-3   | beta, success, 4000 ms        | alpha, error, 1000 ms         | different  |
 * | v-4   | beta, success, 1000 ms        | —                             |            |
 * | v-5   | gamma, error, 6000 ms         | beta, success, 2000 ms        | different  |
 *
 * Current population: 5 traces, 2 errors; alpha 2 (1 error, max 3000), beta 2 (0 errors,
 * max 4000), gamma 1 (1 error, max 6000). A filter applied to every version instead of the current
 * one counts alpha 3 and beta 4, and `status` 4 errors + 5 successes.
 */
export const TRACE_AGGREGATE_VERSION_FIXTURE_DATA: TraceAggregateFixtureData = {
  spans: [
    ...aggregateRoot({
      cursorId: 10,
      traceId: 'v-1',
      entityName: 'beta',
      startedAt: '2026-09-01T10:00:00.000Z',
      durationMs: 1000,
      error: true,
      threadId: 'vt-1',
    }),
    ...aggregateRoot({
      cursorId: 11,
      traceId: 'v-1',
      entityName: 'alpha',
      startedAt: '2026-09-01T10:00:00.000Z',
      durationMs: 2000,
      threadId: 'vt-1',
    }),
    ...aggregateRoot({
      cursorId: 20,
      traceId: 'v-2',
      entityName: 'alpha',
      startedAt: '2026-09-02T10:00:00.000Z',
      durationMs: 500,
      threadId: 'vt-2',
    }),
    ...aggregateRoot({
      cursorId: 21,
      traceId: 'v-2',
      entityName: 'alpha',
      startedAt: '2026-09-02T10:00:00.000Z',
      durationMs: 3000,
      error: true,
      threadId: 'vt-2',
    }),
    ...aggregateRoot({
      cursorId: 30,
      traceId: 'v-3',
      entityName: 'alpha',
      startedAt: '2026-09-02T23:59:58.000Z',
      durationMs: 1000,
      error: true,
      threadId: 'vt-3',
    }),
    ...aggregateRoot({
      cursorId: 31,
      traceId: 'v-3',
      entityName: 'beta',
      startedAt: '2026-09-02T23:59:58.000Z',
      durationMs: 4000,
      threadId: 'vt-3',
    }),
    ...aggregateRoot({
      cursorId: 40,
      traceId: 'v-4',
      entityName: 'beta',
      startedAt: '2026-09-03T10:00:00.000Z',
      durationMs: 1000,
      threadId: 'vt-4',
    }),
    ...aggregateRoot({
      cursorId: 50,
      traceId: 'v-5',
      entityName: 'beta',
      startedAt: '2026-09-04T23:59:57.000Z',
      durationMs: 2000,
      threadId: 'vt-5',
    }),
    ...aggregateRoot({
      cursorId: 51,
      traceId: 'v-5',
      entityName: 'gamma',
      startedAt: '2026-09-04T23:59:57.000Z',
      durationMs: 6000,
      error: true,
      threadId: 'vt-5',
    }),
  ],
  scores: [],
  feedback: [],
};

const statusIs = (status: string) => ({ op: 'eq', left: { path: 'status' }, right: { literal: status } }) as const;
const entityIs = (entityName: string) =>
  ({ op: 'eq', left: { path: 'entityName' }, right: { literal: entityName } }) as const;

export const TRACE_AGGREGATE_VERSION_CONFORMANCE_CASES: TraceAggregateConformanceCase[] = [
  {
    name: 'versions: the unfiltered population counts each trace once',
    request: { timeRange: versionRange, measures: ['count', 'errorCount', 'duration.max'] },
    expected: { rows: [{ measures: { count: 5, errorCount: 2, 'duration.max': 6000 } }], truncated: false },
  },
  {
    name: 'versions: status=error counts current versions that failed',
    request: { timeRange: versionRange, where: statusIs('error'), measures: ['count'] },
    expected: { rows: [{ measures: { count: 2 } }], truncated: false },
  },
  {
    name: 'versions: status=success counts current versions that succeeded',
    request: { timeRange: versionRange, where: statusIs('success'), measures: ['count'] },
    expected: { rows: [{ measures: { count: 3 } }], truncated: false },
  },
  {
    name: 'versions: entityName=alpha matches current versions only',
    request: { timeRange: versionRange, where: entityIs('alpha'), measures: ['count', 'duration.max'] },
    expected: { rows: [{ measures: { count: 2, 'duration.max': 3000 } }], truncated: false },
  },
  {
    name: 'versions: entityName=beta matches current versions only',
    request: { timeRange: versionRange, where: entityIs('beta'), measures: ['count', 'duration.max'] },
    expected: { rows: [{ measures: { count: 2, 'duration.max': 4000 } }], truncated: false },
  },
  {
    name: 'versions: groupBy status follows the current version',
    request: { timeRange: versionRange, groupBy: ['status'], measures: ['count', 'duration.max'] },
    expected: {
      rows: [
        { dimensions: { status: 'success' }, measures: { count: 3, 'duration.max': 4000 } },
        { dimensions: { status: 'error' }, measures: { count: 2, 'duration.max': 6000 } },
      ],
      truncated: false,
    },
  },
  {
    name: 'versions: groupBy entityName follows the current version',
    request: { timeRange: versionRange, groupBy: ['entityName'], measures: ['count', 'errorCount', 'duration.max'] },
    expected: {
      rows: [
        { dimensions: { entityName: 'alpha' }, measures: { count: 2, errorCount: 1, 'duration.max': 3000 } },
        { dimensions: { entityName: 'beta' }, measures: { count: 2, errorCount: 0, 'duration.max': 4000 } },
        { dimensions: { entityName: 'gamma' }, measures: { count: 1, errorCount: 1, 'duration.max': 6000 } },
      ],
      truncated: false,
    },
  },
  {
    name: 'versions: daily buckets place each trace once, by its startedAt',
    request: { timeRange: versionRange, interval: '1d', measures: ['count'] },
    expected: {
      rows: [
        { bucket: '2026-09-01T00:00:00.000Z', measures: { count: 1 } },
        { bucket: '2026-09-02T00:00:00.000Z', measures: { count: 2 } },
        { bucket: '2026-09-03T00:00:00.000Z', measures: { count: 1 } },
        { bucket: '2026-09-04T00:00:00.000Z', measures: { count: 1 } },
      ],
      truncated: false,
    },
  },
];
