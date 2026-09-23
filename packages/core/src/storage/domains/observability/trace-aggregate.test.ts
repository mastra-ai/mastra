import { describe, expect, it } from 'vitest';
import {
  getTraceAggregateCountDistinctField,
  isTraceAggregateCountDistinctMeasure,
  parseTraceAggregateRequest,
  TRACE_AGGREGATE_DEFAULT_LIMIT,
  TRACE_AGGREGATE_FIXED_MEASURES,
  TRACE_AGGREGATE_INTERVALS,
  TRACE_AGGREGATE_MAX_LIMIT,
  traceAggregateResponseSchema,
} from './trace-aggregate';
import { TRACE_QUERY_MAX_NODES, TRACE_QUERY_MAX_PATH_BYTES, TraceQueryValidationError } from './trace-query';
import type { TraceQueryScalarPredicate } from './trace-query';

const baseRequest = {
  timeRange: {
    from: '2026-08-01T00:00:00Z',
    to: '2026-09-01T00:00:00Z',
  },
  measures: ['count'],
};

function parsed(request: unknown = baseRequest) {
  return parseTraceAggregateRequest(request);
}

function validationError(fn: () => unknown): TraceQueryValidationError {
  try {
    fn();
    throw new Error('Expected a TraceQueryValidationError');
  } catch (error) {
    expect(error).toBeInstanceOf(TraceQueryValidationError);
    return error as TraceQueryValidationError;
  }
}

function expectInvalidRequest(request: unknown, path: Array<string | number>) {
  const error = validationError(() => parsed(request));
  expect(error.code).toBe('TRACE_QUERY_INVALID');
  expect(error.issues).toContainEqual(expect.objectContaining({ code: 'invalid_request', path }));
  return error;
}

const scalar = (index: number): TraceQueryScalarPredicate => ({
  op: 'eq',
  left: { path: 'status' },
  right: { literal: `s${index}` },
});

function tooManyNodes(): TraceQueryScalarPredicate {
  return { op: 'and', args: Array.from({ length: TRACE_QUERY_MAX_NODES }, (_, index) => scalar(index)) };
}

describe('traceAggregateRequestSchema', () => {
  it('parses canonical example 1 with defaults applied', () => {
    const result = parsed({
      timeRange: { from: '2026-07-01T00:00:00Z', to: '2026-09-01T00:00:00Z' },
      where: { op: 'eq', left: { path: 'environment' }, right: { literal: 'production' } },
      groupBy: ['entityName'],
      interval: '1d',
      measures: ['count', 'errorRate'],
    });
    expect(result.groupBy).toEqual(['entityName']);
    expect(result.interval).toBe('1d');
    expect(result.limit).toBe(TRACE_AGGREGATE_DEFAULT_LIMIT);
    expect(result.orderBy).toEqual({ field: 'count', direction: 'desc' });
    expect(result.having).toBeUndefined();
  });

  it('parses canonical example 2 and preserves explicit orderBy and limit', () => {
    const result = parsed({
      timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' },
      groupBy: ['entityName'],
      measures: ['count', 'duration.p95'],
      having: { op: 'gt', left: { path: 'duration.p95' }, right: { literal: 5000 } },
      orderBy: { field: 'duration.p95', direction: 'desc' },
      limit: 10,
    });
    expect(result.limit).toBe(10);
    expect(result.orderBy).toEqual({ field: 'duration.p95', direction: 'desc' });
    expect(result.having).toEqual({ op: 'gt', left: { path: 'duration.p95' }, right: { literal: 5000 } });
  });

  it('parses canonical example 3 with a spans.some selection and a countDistinct measure', () => {
    const result = parsed({
      timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' },
      where: { spans: { some: { op: 'eq', left: { path: 'name' }, right: { literal: 'medication_lookup' } } } },
      groupBy: ['metadata.tenant'],
      measures: ['count', 'countDistinct.threadId'],
    });
    expect(result.groupBy).toEqual(['metadata.tenant']);
    expect(result.measures).toEqual(['count', 'countDistinct.threadId']);
  });

  it('applies defaults for groupBy, limit, and orderBy', () => {
    const result = parsed();
    expect(result.groupBy).toEqual([]);
    expect(result.limit).toBe(100);
    expect(result.orderBy).toEqual({ field: 'count', direction: 'desc' });
    expect(result.interval).toBeUndefined();
    expect(result.where).toBeUndefined();
  });

  it('accepts every fixed measure literal', () => {
    const result = parsed({ ...baseRequest, measures: [...TRACE_AGGREGATE_FIXED_MEASURES] });
    expect(result.measures).toEqual([
      'count',
      'duration.avg',
      'duration.min',
      'duration.max',
      'duration.p50',
      'duration.p90',
      'duration.p95',
      'duration.p99',
      'errorCount',
      'errorRate',
    ]);
  });

  it('accepts every interval literal', () => {
    expect(TRACE_AGGREGATE_INTERVALS).toEqual(['1m', '5m', '15m', '1h', '1d']);
    for (const interval of TRACE_AGGREGATE_INTERVALS) {
      expect(parsed({ ...baseRequest, interval }).interval).toBe(interval);
    }
  });

  it('accepts countDistinct over canonical fields and top-level metadata keys', () => {
    const measures = ['countDistinct.traceId', 'countDistinct.threadId', 'countDistinct.metadata.tenant'];
    expect(parsed({ ...baseRequest, measures }).measures).toEqual(measures);
  });

  // Unknown-key issues are reported at the path of the object that owns the key (zod v4 `unrecognized_keys`).
  it('rejects unknown top-level properties', () => {
    expectInvalidRequest({ ...baseRequest, page: { limit: 10 } }, []);
  });

  it('rejects unknown properties inside orderBy', () => {
    expectInvalidRequest({ ...baseRequest, orderBy: { field: 'count', direction: 'asc', nulls: 'last' } }, ['orderBy']);
  });

  it('rejects an orderBy direction that is not lowercase asc/desc', () => {
    expectInvalidRequest({ ...baseRequest, orderBy: { field: 'count', direction: 'DESC' } }, ['orderBy', 'direction']);
  });

  it('rejects empty, duplicate, and unknown measures', () => {
    expectInvalidRequest({ ...baseRequest, measures: [] }, ['measures']);
    expectInvalidRequest({ ...baseRequest, measures: ['count', 'count'] }, ['measures']);
    for (const measure of ['duration.p75', 'tokens.input.sum', 'countDistinct', 'countDistinct.', 'cost.sum']) {
      expectInvalidRequest({ ...baseRequest, measures: [measure] }, ['measures', 0]);
    }
  });

  it('rejects a countDistinct measure whose name exceeds the path byte cap', () => {
    const measure = `countDistinct.${'a'.repeat(TRACE_QUERY_MAX_PATH_BYTES)}`;
    expectInvalidRequest({ ...baseRequest, measures: [measure] }, ['measures', 0]);
  });

  it('rejects more than two dimensions, duplicate dimensions, and empty dimension names', () => {
    expectInvalidRequest({ ...baseRequest, groupBy: ['entityName', 'status', 'environment'] }, ['groupBy']);
    expectInvalidRequest({ ...baseRequest, groupBy: ['entityName', 'entityName'] }, ['groupBy']);
    expectInvalidRequest({ ...baseRequest, groupBy: [''] }, ['groupBy', 0]);
    expectInvalidRequest({ ...baseRequest, groupBy: ['a'.repeat(TRACE_QUERY_MAX_PATH_BYTES + 1)] }, ['groupBy', 0]);
  });

  it('accepts two dimensions', () => {
    expect(parsed({ ...baseRequest, groupBy: ['entityName', 'status'] }).groupBy).toEqual(['entityName', 'status']);
  });

  it('rejects unknown intervals', () => {
    expectInvalidRequest({ ...baseRequest, interval: '2h' }, ['interval']);
  });

  it('rejects out-of-range, fractional, and string limits without coercion', () => {
    expectInvalidRequest({ ...baseRequest, limit: 0 }, ['limit']);
    expectInvalidRequest({ ...baseRequest, limit: TRACE_AGGREGATE_MAX_LIMIT + 1 }, ['limit']);
    expectInvalidRequest({ ...baseRequest, limit: 1.5 }, ['limit']);
    expectInvalidRequest({ ...baseRequest, limit: '10' }, ['limit']);
    expect(parsed({ ...baseRequest, limit: TRACE_AGGREGATE_MAX_LIMIT }).limit).toBe(1000);
  });

  it('rejects time ranges where from is not earlier than to', () => {
    expectInvalidRequest({ ...baseRequest, timeRange: { from: '2026-09-01T00:00:00Z', to: '2026-09-01T00:00:00Z' } }, [
      'timeRange',
    ]);
    expectInvalidRequest({ ...baseRequest, timeRange: { from: '2026-09-02T00:00:00Z', to: '2026-09-01T00:00:00Z' } }, [
      'timeRange',
    ]);
  });

  it('accepts a 365-day window and rejects 365 days plus one millisecond', () => {
    expect(
      parsed({ ...baseRequest, timeRange: { from: '2025-09-01T00:00:00Z', to: '2026-09-01T00:00:00Z' } }).timeRange,
    ).toEqual({ from: '2025-09-01T00:00:00Z', to: '2026-09-01T00:00:00Z' });
    expectInvalidRequest(
      { ...baseRequest, timeRange: { from: '2025-09-01T00:00:00Z', to: '2026-09-01T00:00:00.001Z' } },
      ['timeRange'],
    );
    expectInvalidRequest({ ...baseRequest, timeRange: { from: '2025-08-31T00:00:00Z', to: '2026-09-01T00:00:00Z' } }, [
      'timeRange',
    ]);
  });

  it('rejects malformed datetimes and unknown timeRange properties', () => {
    expectInvalidRequest({ ...baseRequest, timeRange: { from: '2026-08-01', to: '2026-09-01T00:00:00Z' } }, [
      'timeRange',
      'from',
    ]);
    expectInvalidRequest(
      { ...baseRequest, timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z', tz: 'UTC' } },
      ['timeRange'],
    );
  });

  it('reuses the trace-query where grammar including nested metadata paths', () => {
    const where = {
      op: 'and',
      args: [
        { op: 'eq', left: { path: 'metadata.a.b' }, right: { literal: 'x' } },
        { scores: { none: { op: 'lt', left: { path: 'score' }, right: { literal: 0.5 } } } },
      ],
    };
    expect(parsed({ ...baseRequest, where }).where).toEqual(where);
    expectInvalidRequest({ ...baseRequest, where: { op: 'like', left: { path: 'status' }, right: { literal: 'x' } } }, [
      'where',
    ]);
  });

  it('accepts scalar having predicates and rejects collection clauses in having', () => {
    const having = {
      op: 'and',
      args: [
        { op: 'gte', left: { path: 'count' }, right: { literal: 10 } },
        { op: 'not', arg: { op: 'in', value: { path: 'errorRate' }, set: [0, 1] } },
      ],
    };
    expect(parsed({ ...baseRequest, having }).having).toEqual(having);
    expectInvalidRequest(
      { ...baseRequest, having: { spans: { some: { op: 'eq', left: { path: 'name' }, right: { literal: 'x' } } } } },
      ['having'],
    );
  });

  it('reports predicate complexity for where and having before shape validation', () => {
    for (const key of ['where', 'having'] as const) {
      const error = validationError(() => parsed({ ...baseRequest, [key]: tooManyNodes() }));
      expect(error.issues).toEqual([
        expect.objectContaining({ code: 'predicate_too_complex', path: [key, 'args', TRACE_QUERY_MAX_NODES - 1] }),
      ]);
    }
  });

  it('never echoes input values in issue messages', () => {
    const error = expectInvalidRequest({ ...baseRequest, measures: ['secret-value'] }, ['measures', 0]);
    for (const issue of error.issues) {
      expect(issue.message).not.toContain('secret-value');
    }
  });
});

describe('traceAggregateResponseSchema', () => {
  it('parses the decision 11 sample row', () => {
    const response = {
      rows: [
        {
          dimensions: { entityName: 'support-agent', status: 'error' },
          bucket: '2026-09-01T00:00:00.000Z',
          measures: { count: 42, 'duration.p95': 5120, errorRate: 1 },
        },
      ],
      truncated: false,
    };
    expect(traceAggregateResponseSchema.parse(response)).toEqual(response);
  });

  it('accepts rows without dimensions or bucket, null dimension values, and countDistinct keys', () => {
    const response = {
      rows: [{ measures: { count: 1 } }, { dimensions: { threadId: null }, measures: { 'countDistinct.threadId': 0 } }],
      truncated: true,
    };
    expect(traceAggregateResponseSchema.parse(response)).toEqual(response);
  });

  it('rejects unknown row keys, non-numeric measures, and unknown measure keys', () => {
    const row = { measures: { count: 1 } };
    expect(traceAggregateResponseSchema.safeParse({ rows: [{ ...row, total: 1 }], truncated: false }).success).toBe(
      false,
    );
    expect(
      traceAggregateResponseSchema.safeParse({ rows: [{ measures: { count: '1' } }], truncated: false }).success,
    ).toBe(false);
    expect(
      traceAggregateResponseSchema.safeParse({ rows: [{ measures: { 'cost.sum': 1 } }], truncated: false }).success,
    ).toBe(false);
    expect(traceAggregateResponseSchema.safeParse({ rows: [row] }).success).toBe(false);
    expect(traceAggregateResponseSchema.safeParse({ rows: [row], truncated: false, page: null }).success).toBe(false);
  });
});

describe('countDistinct helpers', () => {
  it('recognises countDistinct measures and extracts the target field', () => {
    expect(isTraceAggregateCountDistinctMeasure('countDistinct.threadId')).toBe(true);
    expect(getTraceAggregateCountDistinctField('countDistinct.threadId')).toBe('threadId');
    expect(getTraceAggregateCountDistinctField('countDistinct.metadata.tenant')).toBe('metadata.tenant');
    expect(isTraceAggregateCountDistinctMeasure('count')).toBe(false);
    expect(getTraceAggregateCountDistinctField('count')).toBeUndefined();
    expect(isTraceAggregateCountDistinctMeasure('countDistinct.')).toBe(false);
    expect(getTraceAggregateCountDistinctField('countDistinct')).toBeUndefined();
  });
});
