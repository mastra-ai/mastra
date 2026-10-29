import {
  countTraceAggregateBuckets,
  parseTraceAggregateRequest,
  parseTraceQueryRequest,
  planTraceAggregate,
  planTraceQuery,
  TRACE_AGGREGATE_MAX_ROWS,
  traceAggregateResponseSchema,
  type TraceQueryPredicate,
} from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import {
  evaluateTraceAggregateRequest,
  TRACE_AGGREGATE_CONFORMANCE_CASES,
  TRACE_AGGREGATE_FIXTURE_DATA,
  TRACE_AGGREGATE_TOKEN_CONFORMANCE_CASES,
  TRACE_AGGREGATE_TOKEN_EDGE_CONFORMANCE_CASES,
  TRACE_AGGREGATE_TOKEN_EDGE_FIXTURE_DATA,
  TRACE_AGGREGATE_TOKEN_FIXTURE_DATA,
  TRACE_AGGREGATE_VERSION_CONFORMANCE_CASES,
  TRACE_AGGREGATE_VERSION_FIXTURE_DATA,
  TRACE_AGGREGATE_YEAR_CONFORMANCE_CASES,
  TRACE_AGGREGATE_YEAR_FIXTURE_DATA,
  traceAggregatePercentile,
  traceAggregateResponseMismatch,
} from './trace-aggregate';
import {
  evaluateTraceQuery,
  makeTraceQuerySpan as span,
  THREAD_QUERY_FIXTURE_DATA,
  TRACE_QUERY_FIXTURE_DATA,
  traceQueryDimensionValue,
  type TraceQueryFixtureData,
} from './trace-query';

const fullRange = { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' };

const fixture = (...spans: ReturnType<typeof span>[]): TraceQueryFixtureData => ({ spans, scores: [], feedback: [] });

const at = (startedAt: string, durationMs: number) => ({
  startedAt,
  endedAt: new Date(Date.parse(startedAt) + durationMs).toISOString(),
});

describe('trace-aggregate reference evaluator', () => {
  it('counts exactly the traces evaluateTraceQuery returns for the same selection', () => {
    const predicates: (TraceQueryPredicate | undefined)[] = [
      undefined,
      { op: 'eq', left: { path: 'environment' }, right: { literal: 'production' } },
      { spans: { some: { op: 'eq', left: { path: 'name' }, right: { literal: 'medication_lookup' } } } },
      { op: 'eq', left: { path: 'spanType' }, right: { literal: 'agent_run' } },
      { op: 'ne', left: { path: 'name' }, right: { literal: 'root-a' } },
    ];
    for (const where of predicates) {
      const plan = planTraceQuery(parseTraceQueryRequest({ timeRange: fullRange, where }));
      const traces = evaluateTraceQuery(TRACE_QUERY_FIXTURE_DATA, plan);
      if (!('traces' in traces)) throw new Error('Expected traces');
      const aggregate = evaluateTraceAggregateRequest(TRACE_QUERY_FIXTURE_DATA, {
        timeRange: fullRange,
        where,
        measures: ['count'],
      });
      expect(aggregate).toEqual({ rows: [{ measures: { count: traces.traces.length } }], truncated: false });
      expect(traces.traces.length).toBeGreaterThan(0);
    }
  });

  it('keeps count available to having and orderBy without projecting it', () => {
    const data = fixture(
      span(1, 'a1', 'a1', { entityName: 'alpha' }),
      span(2, 'a2', 'a2', { entityName: 'alpha', error: { message: 'boom' } }),
      span(3, 'b1', 'b1', { entityName: 'beta' }),
      span(4, 'b2', 'b2', { entityName: 'beta' }),
      span(5, 'b3', 'b3', { entityName: 'beta' }),
      span(6, 'c1', 'c1', { entityName: 'gamma', error: { message: 'boom' } }),
    );
    const response = evaluateTraceAggregateRequest(data, {
      timeRange: fullRange,
      groupBy: ['entityName'],
      measures: ['errorRate'],
      having: { op: 'gte', left: { path: 'count' }, right: { literal: 2 } },
      orderBy: { field: 'count', direction: 'asc' },
    });
    expect(response).toEqual({
      rows: [
        { dimensions: { entityName: 'alpha' }, measures: { errorRate: 0.5 } },
        { dimensions: { entityName: 'beta' }, measures: { errorRate: 0 } },
      ],
      truncated: false,
    });
  });

  it('floors buckets to UTC interval boundaries even when the window starts mid-interval', () => {
    const data = fixture(
      span(1, 't1', 't1', at('2026-08-10T00:45:00.000Z', 1000)),
      span(2, 't2', 't2', at('2026-08-10T01:10:00.000Z', 1000)),
      span(3, 't3', 't3', at('2026-08-10T01:59:59.000Z', 1000)),
      span(4, 't4', 't4', at('2026-08-10T00:15:00.000Z', 1000)),
    );
    const response = evaluateTraceAggregateRequest(data, {
      timeRange: { from: '2026-08-10T00:30:00Z', to: '2026-08-10T03:00:00Z' },
      interval: '1h',
      measures: ['count'],
    });
    expect(response).toEqual({
      rows: [
        { bucket: '2026-08-10T00:00:00.000Z', measures: { count: 1 } },
        { bucket: '2026-08-10T01:00:00.000Z', measures: { count: 2 } },
      ],
      truncated: false,
    });
  });

  it('interpolates percentiles linearly between order statistics', () => {
    expect(traceAggregatePercentile([100, 200, 300, 400], 0.95)).toBe(385);
    expect(traceAggregatePercentile([100, 200, 300, 400], 0.5)).toBe(250);
    expect(traceAggregatePercentile([100, 200, 300, 400], 0)).toBe(100);
    expect(traceAggregatePercentile([100, 200, 300, 400], 1)).toBe(400);
    expect(traceAggregatePercentile([100, 200, 300, 400, 500], 0.5)).toBe(300);
    expect(traceAggregatePercentile([730], 0.99)).toBe(730);
  });

  it('computes errorRate as errorCount / count and 0 for all-success groups', () => {
    const data = fixture(
      span(1, 'a1', 'a1', { entityName: 'alpha', error: { message: 'boom' } }),
      span(2, 'a2', 'a2', { entityName: 'alpha' }),
      span(3, 'a3', 'a3', { entityName: 'alpha' }),
      span(4, 'a4', 'a4', { entityName: 'alpha' }),
      span(5, 'b1', 'b1', { entityName: 'beta' }),
      span(6, 'b2', 'b2', { entityName: 'beta' }),
    );
    const response = evaluateTraceAggregateRequest(data, {
      timeRange: fullRange,
      groupBy: ['entityName'],
      measures: ['count', 'errorCount', 'errorRate'],
    });
    expect(response.rows).toEqual([
      { dimensions: { entityName: 'alpha' }, measures: { count: 4, errorCount: 1, errorRate: 0.25 } },
      { dimensions: { entityName: 'beta' }, measures: { count: 2, errorCount: 0, errorRate: 0 } },
    ]);
  });

  it('sorts null dimension values last for both asc and desc', () => {
    const data = fixture(
      span(1, 'n1', 'n1', { entityName: null }),
      span(2, 'a1', 'a1', { entityName: 'alpha' }),
      span(3, 'b1', 'b1', { entityName: 'beta' }),
    );
    const names = (direction: 'asc' | 'desc') =>
      evaluateTraceAggregateRequest(data, {
        timeRange: fullRange,
        groupBy: ['entityName'],
        measures: ['count'],
        orderBy: { field: 'entityName', direction },
      }).rows.map(row => row.dimensions!.entityName);
    expect(names('asc')).toEqual(['alpha', 'beta', null]);
    expect(names('desc')).toEqual(['beta', 'alpha', null]);
  });

  it('truncates by group and keeps complete bucket series for surviving groups', () => {
    const data = fixture(
      span(1, 'a1', 'a1', { entityName: 'alpha', ...at('2026-08-10T00:00:00.000Z', 1000) }),
      span(2, 'a2', 'a2', { entityName: 'alpha', ...at('2026-08-10T00:00:00.000Z', 1000) }),
      span(3, 'a3', 'a3', { entityName: 'alpha', ...at('2026-08-12T00:00:00.000Z', 1000) }),
      span(4, 'b1', 'b1', { entityName: 'beta', ...at('2026-08-11T00:00:00.000Z', 1000) }),
      span(5, 'b2', 'b2', { entityName: 'beta', ...at('2026-08-12T00:00:00.000Z', 1000) }),
      span(6, 'c1', 'c1', { entityName: 'gamma', ...at('2026-08-11T00:00:00.000Z', 1000) }),
    );
    const response = evaluateTraceAggregateRequest(data, {
      timeRange: fullRange,
      groupBy: ['entityName'],
      interval: '1d',
      measures: ['count'],
      limit: 2,
    });
    expect(response).toEqual({
      rows: [
        { dimensions: { entityName: 'alpha' }, bucket: '2026-08-10T00:00:00.000Z', measures: { count: 2 } },
        { dimensions: { entityName: 'alpha' }, bucket: '2026-08-12T00:00:00.000Z', measures: { count: 1 } },
        { dimensions: { entityName: 'beta' }, bucket: '2026-08-11T00:00:00.000Z', measures: { count: 1 } },
        { dimensions: { entityName: 'beta' }, bucket: '2026-08-12T00:00:00.000Z', measures: { count: 1 } },
      ],
      truncated: true,
    });
  });

  it('normalizes metadata dimension values to trimmed non-empty strings', () => {
    const root = span(1, 't', 't', {
      metadata: { padded: '  tenant-a ', empty: '', numeric: 42, nested: { child: 'value' }, blank: '   ' },
    });
    expect(traceQueryDimensionValue(root, 'metadata.padded')).toBe('tenant-a');
    expect(traceQueryDimensionValue(root, 'metadata.empty')).toBeNull();
    expect(traceQueryDimensionValue(root, 'metadata.blank')).toBeNull();
    expect(traceQueryDimensionValue(root, 'metadata.numeric')).toBeNull();
    expect(traceQueryDimensionValue(root, 'metadata.nested')).toBeNull();
    expect(traceQueryDimensionValue(root, 'metadata.missing')).toBeNull();
    expect(traceQueryDimensionValue(span(2, 'u', 'u'), 'metadata.padded')).toBeNull();
    expect(traceQueryDimensionValue(span(3, 'e', 'e', { error: { message: 'x' } }), 'status')).toBe('error');
    expect(traceQueryDimensionValue(span(4, 's', 's'), 'status')).toBe('success');
  });
});

describe('trace-aggregate conformance cases', () => {
  it('uses unique case names', () => {
    const names = TRACE_AGGREGATE_CONFORMANCE_CASES.map(testCase => testCase.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(TRACE_AGGREGATE_CONFORMANCE_CASES)('$name', testCase => {
    const actual = evaluateTraceAggregateRequest(TRACE_AGGREGATE_FIXTURE_DATA, testCase.request, testCase.scope);
    // The reference evaluator defines the expected values, so it must match exactly even where
    // stores are allowed a percentile tolerance.
    expect(actual).toEqual(testCase.expected);
    expect(traceAggregateResponseMismatch(actual, testCase)).toBeNull();
  });

  it('hand-written expectations satisfy the response contract and project exactly the requested measures', () => {
    for (const testCase of TRACE_AGGREGATE_CONFORMANCE_CASES) {
      expect(() => traceAggregateResponseSchema.parse(testCase.expected), testCase.name).not.toThrow();
      const groupBy = testCase.request.groupBy ?? [];
      for (const row of testCase.expected.rows) {
        expect(Object.keys(row.measures), testCase.name).toEqual(testCase.request.measures);
        expect(Object.keys(row.dimensions ?? {}), testCase.name).toEqual(groupBy);
        expect('bucket' in row, testCase.name).toBe(testCase.request.interval !== undefined);
      }
      for (const measure of Object.keys(testCase.tolerance ?? {})) {
        expect(measure, testCase.name).toMatch(/^duration\.p\d+$/);
        expect(testCase.request.measures, testCase.name).toContain(measure);
      }
    }
  });

  it('covers an empty population for both ungrouped requests and an all-filtering having', () => {
    const empty = TRACE_AGGREGATE_CONFORMANCE_CASES.filter(testCase => testCase.expected.rows.length === 0);
    expect(
      empty.some(testCase => testCase.request.groupBy === undefined && testCase.request.having === undefined),
    ).toBe(true);
    expect(empty.some(testCase => testCase.request.having !== undefined)).toBe(true);
  });

  it('traceAggregateResponseMismatch applies tolerance only to the listed measures', () => {
    const expected = { rows: [{ measures: { count: 2, 'duration.p95': 2900 } }], truncated: false };
    const tolerance = { 'duration.p95': 100 };
    const response = (p95: number, count = 2) => ({
      rows: [{ measures: { count, 'duration.p95': p95 } }],
      truncated: false,
    });
    expect(traceAggregateResponseMismatch(response(3000), { expected, tolerance })).toBeNull();
    expect(traceAggregateResponseMismatch(response(3001), { expected, tolerance })).toMatch(/duration\.p95.*±100/);
    expect(traceAggregateResponseMismatch(response(2900, 3), { expected, tolerance })).toMatch(/measures\.count/);
    expect(traceAggregateResponseMismatch(response(3000), { expected })).toMatch(/duration\.p95/);
    expect(traceAggregateResponseMismatch({ rows: [], truncated: false }, { expected })).toMatch(/^rows:/);
    expect(traceAggregateResponseMismatch({ ...response(2900), truncated: true }, { expected })).toMatch(/^truncated/);
  });

  it('traceAggregateResponseMismatch compares buckets as instants, not strings', () => {
    const expected = {
      rows: [{ bucket: '2026-08-01T00:00:00.000Z', measures: { count: 1 } }],
      truncated: false,
    };
    for (const bucket of ['2026-08-01T00:00:00Z', '2026-08-01T00:00:00+00:00', '2026-08-01T02:00:00+02:00']) {
      expect(
        traceAggregateResponseMismatch({ rows: [{ bucket, measures: { count: 1 } }], truncated: false }, { expected }),
      ).toBeNull();
    }
    expect(
      traceAggregateResponseMismatch(
        { rows: [{ bucket: '2026-08-01T00:00:00.001Z', measures: { count: 1 } }], truncated: false },
        { expected },
      ),
    ).toMatch(/^rows\[0\]\.bucket/);
    expect(
      traceAggregateResponseMismatch({ rows: [{ measures: { count: 1 } }], truncated: false }, { expected }),
    ).toMatch(/^rows\[0\]\.bucket/);
    expect(
      traceAggregateResponseMismatch(
        { rows: [{ bucket: 'not-a-date', measures: { count: 1 } }], truncated: false },
        { expected },
      ),
    ).toMatch(/^rows\[0\]\.bucket/);
    // Date.parse would accept these as midnight UTC, but the schema requires a date-time with offset.
    for (const bucket of ['2026-08-01', '2026-08-01T00:00:00']) {
      expect(
        traceAggregateResponseMismatch({ rows: [{ bucket, measures: { count: 1 } }], truncated: false }, { expected }),
      ).toMatch(/^rows\[0\]\.bucket: expected an ISO-8601/);
    }
  });

  it('traceAggregateResponseMismatch ignores record key order but not row order', () => {
    const expected = {
      rows: [
        { dimensions: { entityName: 'a', environment: 'prod' }, measures: { count: 1, errorCount: 0 } },
        { dimensions: { entityName: 'b', environment: 'prod' }, measures: { count: 1, errorCount: 0 } },
      ],
      truncated: false,
    };
    const reversedKeys = {
      rows: [
        { dimensions: { environment: 'prod', entityName: 'a' }, measures: { errorCount: 0, count: 1 } },
        { dimensions: { environment: 'prod', entityName: 'b' }, measures: { errorCount: 0, count: 1 } },
      ],
      truncated: false,
    };
    expect(traceAggregateResponseMismatch(reversedKeys, { expected })).toBeNull();
    const reversedRows = { rows: [expected.rows[1]!, expected.rows[0]!], truncated: false };
    expect(traceAggregateResponseMismatch(reversedRows, { expected })).toMatch(/^rows\[0\]\.dimensions\.entityName/);
    const missingDimension = {
      rows: [{ dimensions: { entityName: 'a' }, measures: { count: 1, errorCount: 0 } }, expected.rows[1]!],
      truncated: false,
    };
    expect(traceAggregateResponseMismatch(missingDimension, { expected })).toMatch(/^rows\[0\]\.dimensions keys/);
  });

  it('aggregates exactly the population evaluateTraceQuery selects for every case', () => {
    for (const testCase of TRACE_AGGREGATE_CONFORMANCE_CASES) {
      const { timeRange, where } = testCase.request;
      const plan = planTraceQuery(parseTraceQueryRequest({ timeRange, where, page: { limit: 1000 } }), {
        scope: testCase.scope,
      });
      const traces = evaluateTraceQuery(TRACE_AGGREGATE_FIXTURE_DATA, plan);
      if (!('traces' in traces)) throw new Error('Expected traces');
      const aggregate = evaluateTraceAggregateRequest(
        TRACE_AGGREGATE_FIXTURE_DATA,
        { timeRange, where, measures: ['count'] },
        testCase.scope,
      );
      const counted = aggregate.rows.length === 0 ? 0 : aggregate.rows[0]!.measures.count;
      expect(aggregate.rows.length, testCase.name).toBe(traces.traces.length === 0 ? 0 : 1);
      expect(counted, testCase.name).toBe(traces.traces.length);
    }
  });
});

describe('trace-aggregate token and cost conformance cases', () => {
  it('uses case names unique across both suites', () => {
    const names = [...TRACE_AGGREGATE_CONFORMANCE_CASES, ...TRACE_AGGREGATE_TOKEN_CONFORMANCE_CASES].map(
      testCase => testCase.name,
    );
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(TRACE_AGGREGATE_TOKEN_CONFORMANCE_CASES)('$name', testCase => {
    const actual = evaluateTraceAggregateRequest(TRACE_AGGREGATE_TOKEN_FIXTURE_DATA, testCase.request, testCase.scope);
    expect(actual).toEqual(testCase.expected);
    expect(traceAggregateResponseMismatch(actual, testCase)).toBeNull();
  });

  it('hand-written expectations satisfy the response contract and attach row cost to cost requests', () => {
    for (const testCase of TRACE_AGGREGATE_TOKEN_CONFORMANCE_CASES) {
      expect(() => traceAggregateResponseSchema.parse(testCase.expected), testCase.name).not.toThrow();
      expect(testCase.tolerance, testCase.name).toBeUndefined();
      const requested = testCase.request.measures;
      const hasCost = requested.some(measure => measure.startsWith('cost.'));
      for (const row of testCase.expected.rows) {
        expect(Object.keys(row.measures).sort(), testCase.name).toEqual([...requested].sort());
        expect(row.cost !== undefined, testCase.name).toBe(hasCost);
      }
    }
  });

  it('counts exactly the traces evaluateTraceQuery returns for the token fixture', () => {
    // August holds every token trace but `early-1` and `tenant-check`, and the resumed trace
    // counts once.
    const timeRange = { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' };
    const traces = evaluateTraceQuery(
      TRACE_AGGREGATE_TOKEN_FIXTURE_DATA,
      planTraceQuery(parseTraceQueryRequest({ timeRange })),
    );
    if (!('traces' in traces)) throw new Error('Expected traces');
    const aggregate = evaluateTraceAggregateRequest(TRACE_AGGREGATE_TOKEN_FIXTURE_DATA, {
      timeRange,
      measures: ['count'],
    });
    expect(aggregate.rows).toEqual([{ measures: { count: traces.traces.length } }]);
    expect(traces.traces.length).toBe(11);
  });

  it.each(TRACE_AGGREGATE_TOKEN_EDGE_CONFORMANCE_CASES)('$name', testCase => {
    const actual = evaluateTraceAggregateRequest(
      TRACE_AGGREGATE_TOKEN_EDGE_FIXTURE_DATA,
      testCase.request,
      testCase.scope,
    );
    expect(actual).toEqual(testCase.expected);
  });

  it('counts duplicate metricId rows once', () => {
    const data = {
      ...TRACE_AGGREGATE_TOKEN_FIXTURE_DATA,
      metrics: TRACE_AGGREGATE_TOKEN_FIXTURE_DATA.metrics!.filter(metric => metric.traceId === 'sup-1'),
    };
    const response = evaluateTraceAggregateRequest(data, {
      timeRange: { from: '2026-08-14T00:00:00Z', to: '2026-08-15T00:00:00Z' },
      where: { op: 'eq', left: { path: 'entityName' }, right: { literal: 'support' } },
      measures: ['tokens.input.sum'],
    });
    // sup-1 has two `sup-1-in` rows (1000 each) and sup-2 has no metric rows in this slice.
    expect(response.rows).toEqual([{ measures: { 'tokens.input.sum': 1000 } }]);
  });
});

describe('trace-aggregate 365-day conformance cases', () => {
  it('uses case names unique across every suite', () => {
    const names = [
      ...TRACE_AGGREGATE_CONFORMANCE_CASES,
      ...TRACE_AGGREGATE_TOKEN_CONFORMANCE_CASES,
      ...TRACE_AGGREGATE_TOKEN_EDGE_CONFORMANCE_CASES,
      ...TRACE_AGGREGATE_YEAR_CONFORMANCE_CASES,
    ].map(testCase => testCase.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(TRACE_AGGREGATE_YEAR_CONFORMANCE_CASES)('$name', testCase => {
    const actual = evaluateTraceAggregateRequest(TRACE_AGGREGATE_YEAR_FIXTURE_DATA, testCase.request, testCase.scope);
    expect(actual).toEqual(testCase.expected);
    expect(traceAggregateResponseMismatch(actual, testCase)).toBeNull();
  });

  it('hand-written expectations satisfy the response contract and project exactly the requested measures', () => {
    for (const testCase of TRACE_AGGREGATE_YEAR_CONFORMANCE_CASES) {
      expect(() => traceAggregateResponseSchema.parse(testCase.expected), testCase.name).not.toThrow();
      const groupBy = testCase.request.groupBy ?? [];
      for (const row of testCase.expected.rows) {
        expect(Object.keys(row.measures), testCase.name).toEqual(testCase.request.measures);
        expect(Object.keys(row.dimensions ?? {}), testCase.name).toEqual(groupBy);
        expect('bucket' in row, testCase.name).toBe(testCase.request.interval !== undefined);
      }
    }
  });

  it('spans the widest window the planner accepts, at 365 daily buckets, up to the row cap', () => {
    for (const testCase of TRACE_AGGREGATE_YEAR_CONFORMANCE_CASES) {
      const { from, to } = testCase.request.timeRange;
      expect(Date.parse(to) - Date.parse(from), testCase.name).toBe(365 * 24 * 60 * 60 * 1000);
      // Every case plans: the window and limit are within bounds.
      expect(() => planTraceAggregate(parseTraceAggregateRequest(testCase.request)), testCase.name).not.toThrow();
    }
    const { from, to } = TRACE_AGGREGATE_YEAR_CONFORMANCE_CASES[0]!.request.timeRange;
    const buckets = countTraceAggregateBuckets(Date.parse(from), Date.parse(to), '1d');
    expect(buckets).toBe(365);
    const maxLimit = Math.max(...TRACE_AGGREGATE_YEAR_CONFORMANCE_CASES.map(testCase => testCase.request.limit ?? 0));
    expect(maxLimit * buckets).toBeLessThanOrEqual(TRACE_AGGREGATE_MAX_ROWS);
    expect((maxLimit + 1) * buckets).toBeGreaterThan(TRACE_AGGREGATE_MAX_ROWS);
  });

  it('includes a group whose single bucket outranks every other bucket but that loses on the whole window', () => {
    const limited = TRACE_AGGREGATE_YEAR_CONFORMANCE_CASES.find(
      testCase => testCase.request.interval === '1d' && testCase.request.limit === 2,
    )!;
    const all = evaluateTraceAggregateRequest(TRACE_AGGREGATE_YEAR_FIXTURE_DATA, {
      ...limited.request,
      limit: 27,
    });
    const largest = all.rows.reduce((max, row) => (row.measures.count! > max.measures.count! ? row : max));
    const kept = new Set(limited.expected.rows.map(row => row.dimensions!.entityName));
    expect(kept.has(largest.dimensions!.entityName!)).toBe(false);
    // Each kept series is longer than the limit, so a row-based LIMIT would cut it mid-series.
    for (const name of kept) {
      expect(limited.expected.rows.filter(row => row.dimensions!.entityName === name).length).toBeGreaterThan(2);
    }
  });

  it('aggregates exactly the population evaluateTraceQuery selects for every case', () => {
    for (const testCase of TRACE_AGGREGATE_YEAR_CONFORMANCE_CASES) {
      const { timeRange, where } = testCase.request;
      const plan = planTraceQuery(parseTraceQueryRequest({ timeRange, where, page: { limit: 1000 } }), {
        scope: testCase.scope,
      });
      const traces = evaluateTraceQuery(TRACE_AGGREGATE_YEAR_FIXTURE_DATA, plan);
      if (!('traces' in traces)) throw new Error('Expected traces');
      const aggregate = evaluateTraceAggregateRequest(
        TRACE_AGGREGATE_YEAR_FIXTURE_DATA,
        { timeRange, where, measures: ['count'] },
        testCase.scope,
      );
      expect(aggregate.rows).toEqual([{ measures: { count: traces.traces.length } }]);
      expect(traces.traces.length, testCase.name).toBe(41);
    }
  });
});

function groupRoots<T>(roots: T[], key: (root: T) => string | null): Map<string | null, T[]> {
  const groups = new Map<string | null, T[]>();
  for (const root of roots) groups.set(key(root), [...(groups.get(key(root)) ?? []), root]);
  return groups;
}

describe('trace-aggregate root version conformance cases', () => {
  it.each(TRACE_AGGREGATE_VERSION_CONFORMANCE_CASES)('$name', testCase => {
    const actual = evaluateTraceAggregateRequest(TRACE_AGGREGATE_VERSION_FIXTURE_DATA, testCase.request);
    expect(actual).toEqual(testCase.expected);
    expect(traceAggregateResponseMismatch(actual, testCase)).toBeNull();
  });

  it('has superseded versions that differ from the current one in status, entityName and endedAt partition', () => {
    const versions = groupRoots(
      TRACE_AGGREGATE_VERSION_FIXTURE_DATA.spans.filter(root => root.parentSpanId === null),
      root => root.traceId,
    );
    const pairs = [...versions.values()]
      .filter(copies => copies.length === 2)
      .map(([old, current]) => ({ old: old!, current: current! }));
    expect(pairs.some(({ old, current }) => (old.error === null) !== (current.error === null))).toBe(true);
    expect(pairs.some(({ old, current }) => old.entityName !== current.entityName)).toBe(true);
    const day = (iso: string | null) => iso!.slice(0, 10);
    expect(pairs.some(({ old, current }) => day(old.endedAt) === day(current.endedAt))).toBe(true);
    expect(pairs.some(({ old, current }) => day(old.endedAt) !== day(current.endedAt))).toBe(true);
  });

  it('counts disjoint status filters to the unfiltered population', () => {
    const count = (where?: TraceQueryPredicate) =>
      evaluateTraceAggregateRequest(TRACE_AGGREGATE_VERSION_FIXTURE_DATA, {
        timeRange: { from: '2026-09-01T00:00:00Z', to: '2026-09-08T00:00:00Z' },
        ...(where ? { where } : {}),
        measures: ['count'],
      }).rows[0]?.measures.count;
    const status = (literal: string): TraceQueryPredicate => ({
      op: 'eq',
      left: { path: 'status' },
      right: { literal },
    });
    expect(count(status('error'))! + count(status('success'))!).toBe(count());
  });

  // The reference evaluator keeps the highest cursorId; ClickHouse, which can hold every version of
  // a root until a merge, keeps the version that ended last. Fixtures model a re-exported root, which
  // ends later, so both rules agree on them.
  it.each([
    ['TRACE_AGGREGATE_FIXTURE_DATA', TRACE_AGGREGATE_FIXTURE_DATA],
    ['TRACE_AGGREGATE_TOKEN_FIXTURE_DATA', TRACE_AGGREGATE_TOKEN_FIXTURE_DATA],
    ['TRACE_AGGREGATE_TOKEN_EDGE_FIXTURE_DATA', TRACE_AGGREGATE_TOKEN_EDGE_FIXTURE_DATA],
    ['TRACE_AGGREGATE_VERSION_FIXTURE_DATA', TRACE_AGGREGATE_VERSION_FIXTURE_DATA],
    ['TRACE_AGGREGATE_YEAR_FIXTURE_DATA', TRACE_AGGREGATE_YEAR_FIXTURE_DATA],
    ['TRACE_QUERY_FIXTURE_DATA', TRACE_QUERY_FIXTURE_DATA],
    ['THREAD_QUERY_FIXTURE_DATA', THREAD_QUERY_FIXTURE_DATA],
  ] as const)('%s: every superseded root version ends before the current one', (_name, data) => {
    const versions = groupRoots(
      data.spans.filter(root => root.parentSpanId === null && !root.isPending),
      root => `${root.traceId}\u0000${root.spanId}`,
    );
    for (const copies of versions.values()) {
      const current = copies.reduce((a, b) => (b.cursorId > a.cursorId ? b : a));
      for (const copy of copies) {
        if (copy === current) continue;
        expect(Date.parse(copy.endedAt!), `${copy.traceId} cursor ${copy.cursorId}`).toBeLessThan(
          Date.parse(current.endedAt!),
        );
      }
    }
  });
});
