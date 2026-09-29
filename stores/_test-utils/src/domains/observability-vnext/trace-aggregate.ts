import {
  compareTraceQueryStrings,
  parseTraceAggregateRequest,
  planTraceAggregate,
  TRACE_AGGREGATE_INTERVAL_MS,
  traceAggregateRowSchema,
  type TraceAggregateCountDistinctField,
  type TraceAggregateRequest,
  type TraceAggregateResponse,
  type TraceAggregateRow,
  type TraceQueryTenantScope,
  type TrustedTraceAggregateHavingPredicate,
  type TrustedTraceAggregateMeasureName,
  type TrustedTraceAggregatePlan,
} from '@mastra/core/storage';

import {
  makeTraceQuerySpan as span,
  selectTraceQueryRoots,
  traceQueryDimensionValue,
  type RawTraceQuerySpan,
  type TraceQueryFixtureData,
} from './trace-query';

/**
 * In-memory reference evaluator for `TrustedTraceAggregatePlan` (Aggregate Query API Decision 5).
 *
 * Candidate traces come from `selectTraceQueryRoots`, so this evaluator aggregates exactly the
 * population `evaluateTraceQuery` paginates (Decision 2). Groups are distinct dimension tuples;
 * `having`, `orderBy`, and `limit` act on whole-window group measures, and only the surviving
 * groups expand into bucket rows. The planner alone enforces bucket/row caps — nothing is
 * re-checked here.
 */

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
    const dimensions = plan.dimensions.map(dimension => traceQueryDimensionValue(root, dimension));
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
    measures: Record<string, number>;
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
   * backend-native (Decision 3: `percentile_cont` on PostgreSQL, `quantile` on ClickHouse), so
   * only `duration.p*` measures carry a tolerance; counts, sums, and rates stay exact.
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
      const actualValue = (actualRow.measures as Record<string, number>)[key]!;
      const allowed = tolerance[key];
      const matches =
        allowed === undefined ? actualValue === expectedValue : Math.abs(actualValue - expectedValue) <= allowed;
      if (!matches) {
        const within = allowed === undefined ? '' : ` (±${allowed})`;
        return `${at}.measures.${key}: expected ${expectedValue}${within}, got ${actualValue}`;
      }
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
