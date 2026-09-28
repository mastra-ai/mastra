import { describe, expect, it } from 'vitest';
import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import { ObservabilityStorage } from './base';
import { parseTraceAggregateRequest, TRACE_AGGREGATE_DEFAULT_LIMIT } from './trace-aggregate';
import {
  countTraceAggregateBuckets,
  planTraceAggregate,
  TRACE_AGGREGATE_INTERVAL_MS,
  TRACE_AGGREGATE_MAX_BUCKETS,
  TRACE_AGGREGATE_MAX_ROWS,
} from './trace-aggregate-planner';
import type { TrustedTraceAggregatePlan } from './trace-aggregate-planner';
import { TRACE_AGGREGATE_DIMENSION_REGISTRY, TRACE_AGGREGATE_IDENTITY_FIELDS } from './trace-aggregate-registry';
import {
  parseTraceQueryRequest,
  planTraceQuery,
  TRACE_QUERY_MAX_DEPTH,
  TRACE_QUERY_MAX_NODES,
  TraceQueryValidationError,
} from './trace-query';
import type { TraceQueryIssueCode, TraceQueryScalarPredicate } from './trace-query';

const timeRange = { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' };
const baseRequest = { timeRange, measures: ['count'] };

function plan(request: unknown = baseRequest, options?: Parameters<typeof planTraceAggregate>[1]) {
  return planTraceAggregate(parseTraceAggregateRequest(request), options);
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

function expectIssue(request: unknown, code: TraceQueryIssueCode, path: Array<string | number>) {
  const error = validationError(() => plan(request));
  expect(error.code).toBe('TRACE_QUERY_INVALID');
  expect(error.issues).toContainEqual(expect.objectContaining({ code, path }));
  return error.issues.find(issue => issue.code === code && JSON.stringify(issue.path) === JSON.stringify(path))!;
}

const gt = (path: string, literal: unknown): TraceQueryScalarPredicate =>
  ({ op: 'gt', left: { path }, right: { literal } }) as TraceQueryScalarPredicate;

describe('planTraceAggregate', () => {
  describe('canonical examples', () => {
    it('plans example 1: runs per agent per day, production only', () => {
      const request = {
        timeRange: { from: '2026-07-01T00:00:00Z', to: '2026-09-01T00:00:00Z' },
        where: { op: 'eq', left: { path: 'environment' }, right: { literal: 'production' } },
        groupBy: ['entityName'],
        interval: '1d',
        measures: ['count', 'errorRate'],
      };
      const expectedWhere = planTraceQuery(parseTraceQueryRequest({ timeRange, where: request.where })).where;
      expect(plan(request)).toEqual<TrustedTraceAggregatePlan>({
        result: 'aggregate',
        timeRange: { from: '2026-07-01T00:00:00.000Z', to: '2026-09-01T00:00:00.000Z' },
        where: expectedWhere,
        scope: undefined,
        dimensions: ['entityName'],
        interval: '1d',
        measures: [
          { type: 'canonical', name: 'count' },
          { type: 'canonical', name: 'errorRate' },
        ],
        having: undefined,
        orderBy: { target: 'measure', measure: 'count', direction: 'desc' },
        limit: TRACE_AGGREGATE_DEFAULT_LIMIT,
      });
    });

    it('plans example 2: ten slowest agents by p95 above 5 seconds', () => {
      expect(
        plan({
          timeRange,
          groupBy: ['entityName'],
          measures: ['count', 'duration.p95'],
          having: gt('duration.p95', 5000),
          orderBy: { field: 'duration.p95', direction: 'desc' },
          limit: 10,
        }),
      ).toEqual<TrustedTraceAggregatePlan>({
        result: 'aggregate',
        timeRange: { from: '2026-08-01T00:00:00.000Z', to: '2026-09-01T00:00:00.000Z' },
        where: undefined,
        scope: undefined,
        dimensions: ['entityName'],
        interval: undefined,
        measures: [
          { type: 'canonical', name: 'count' },
          { type: 'canonical', name: 'duration.p95' },
        ],
        having: { type: 'comparison', measure: 'duration.p95', operator: 'gt', value: 5000 },
        orderBy: { target: 'measure', measure: 'duration.p95', direction: 'desc' },
        limit: 10,
      });
    });

    it('plans example 3: traces that called a named tool grouped by a metadata tenant key', () => {
      const where = { spans: { some: { op: 'eq', left: { path: 'name' }, right: { literal: 'medication_lookup' } } } };
      const result = plan({
        timeRange,
        where,
        groupBy: ['metadata.tenant'],
        measures: ['count', 'countDistinct.threadId'],
      });
      expect(result.where).toEqual(planTraceQuery(parseTraceQueryRequest({ timeRange, where })).where);
      expect(result.dimensions).toEqual(['metadata.tenant']);
      expect(result.measures).toEqual([
        { type: 'canonical', name: 'count' },
        { type: 'countDistinct', name: 'countDistinct.threadId', field: 'threadId' },
      ]);
      expect(result.orderBy).toEqual({ target: 'measure', measure: 'count', direction: 'desc' });
    });
  });

  describe('defaults and scope', () => {
    it('applies orderBy count desc and limit 100 when omitted', () => {
      const result = plan({ timeRange, measures: ['duration.p95'] });
      expect(result.orderBy).toEqual({ target: 'measure', measure: 'count', direction: 'desc' });
      expect(result.limit).toBe(100);
    });

    it('lets orderBy and having target count even when count is not a requested measure', () => {
      const result = plan({
        timeRange,
        measures: ['errorRate'],
        having: { op: 'gte', left: { path: 'count' }, right: { literal: 10 } },
        orderBy: { field: 'count', direction: 'asc' },
      });
      expect(result.orderBy).toEqual({ target: 'measure', measure: 'count', direction: 'asc' });
      expect(result.having).toEqual({ type: 'comparison', measure: 'count', operator: 'gte', value: 10 });
      expect(result.measures).toEqual([{ type: 'canonical', name: 'errorRate' }]);
    });

    it('normalizes the tenant scope', () => {
      expect(plan(baseRequest, { scope: { organizationId: 'org', resourceId: undefined } }).scope).toEqual({
        organizationId: 'org',
      });
      expect(plan(baseRequest, { scope: { organizationId: 'org', resourceId: 'res' } }).scope).toEqual({
        organizationId: 'org',
        resourceId: 'res',
      });
      expect(plan(baseRequest).scope).toBeUndefined();
    });
  });

  describe('dimensions (Decision 4)', () => {
    it('accepts every canonical dimension and top-level metadata keys', () => {
      for (const dimension of Object.keys(TRACE_AGGREGATE_DIMENSION_REGISTRY)) {
        expect(plan({ ...baseRequest, groupBy: [dimension] }).dimensions).toEqual([dimension]);
      }
      expect(plan({ ...baseRequest, groupBy: ['metadata.tenant', 'status'] }).dimensions).toEqual([
        'metadata.tenant',
        'status',
      ]);
    });

    it('rejects identity fields, attributes, span-scope fields and unknown names', () => {
      for (const field of [...TRACE_AGGREGATE_IDENTITY_FIELDS, 'attributes.foo', 'name', 'model', 'bucket']) {
        const issue = expectIssue({ ...baseRequest, groupBy: ['status', field] }, 'field_not_allowed', ['groupBy', 1]);
        expect(issue.message).not.toContain(field);
      }
    });

    it('rejects nested metadata paths as dimensions', () => {
      expectIssue({ ...baseRequest, groupBy: ['metadata.a.b'] }, 'invalid_metadata_key', ['groupBy', 0]);
    });

    it('normalizes template paths and rejects duplicates that appear after normalization', () => {
      expect(plan({ ...baseRequest, groupBy: ['${threadId}'] }).dimensions).toEqual(['threadId']);
      expectIssue({ ...baseRequest, groupBy: ['threadId', '${threadId}'] }, 'invalid_request', ['groupBy', 1]);
    });
  });

  describe('measures (Decision 3)', () => {
    it('accepts countDistinct over traceId and groupable fields', () => {
      expect(
        plan({ timeRange, measures: ['countDistinct.traceId', 'countDistinct.metadata.tenant'] }).measures,
      ).toEqual([
        { type: 'countDistinct', name: 'countDistinct.traceId', field: 'traceId' },
        { type: 'countDistinct', name: 'countDistinct.metadata.tenant', field: 'metadata.tenant' },
      ]);
    });

    it('rejects countDistinct over non-groupable fields', () => {
      for (const field of ['spanId', 'runId', 'attributes.x', 'name']) {
        const issue = expectIssue({ timeRange, measures: ['count', `countDistinct.${field}`] }, 'field_not_allowed', [
          'measures',
          1,
        ]);
        expect(issue.message).not.toContain(field);
      }
      expectIssue({ timeRange, measures: ['countDistinct.metadata.a.b'] }, 'invalid_metadata_key', ['measures', 0]);
    });

    it('normalizes countDistinct fields and rejects duplicates after normalization', () => {
      expect(plan({ timeRange, measures: ['countDistinct.${threadId}'] }).measures).toEqual([
        { type: 'countDistinct', name: 'countDistinct.threadId', field: 'threadId' },
      ]);
      expectIssue({ timeRange, measures: ['countDistinct.threadId', 'countDistinct.${threadId}'] }, 'invalid_request', [
        'measures',
        1,
      ]);
    });
  });

  describe('having (Decision 5)', () => {
    const measures = ['count', 'duration.p95'];

    it('compiles boolean, comparison and membership predicates over requested measures', () => {
      expect(
        plan({
          timeRange,
          measures,
          having: {
            op: 'and',
            args: [gt('count', 10), { op: 'not', arg: { op: 'in', value: { path: '${duration.p95}' }, set: [1, 2] } }],
          },
        }).having,
      ).toEqual({
        type: 'boolean',
        operator: 'and',
        args: [
          { type: 'comparison', measure: 'count', operator: 'gt', value: 10 },
          { type: 'not', arg: { type: 'membership', measure: 'duration.p95', operator: 'in', values: [1, 2] } },
        ],
      });
    });

    it('rejects measures that were not requested, including dimension names', () => {
      const issue = expectIssue({ timeRange, measures, having: gt('duration.p99', 1) }, 'field_not_allowed', [
        'having',
        'left',
        'path',
      ]);
      expect(issue.message).not.toContain('duration.p99');
      expectIssue({ timeRange, measures, groupBy: ['status'], having: gt('status', 1) }, 'field_not_allowed', [
        'having',
        'left',
        'path',
      ]);
      expectIssue(
        { timeRange, measures, having: { op: 'and', args: [gt('count', 1), gt('errorRate', 1)] } },
        'field_not_allowed',
        ['having', 'args', 1, 'left', 'path'],
      );
      expectIssue(
        { timeRange, measures, having: { op: 'in', value: { path: 'errorRate' }, set: [1] } },
        'field_not_allowed',
        ['having', 'value', 'path'],
      );
    });

    it('rejects non-numeric literals', () => {
      for (const literal of ['5000', null, true]) {
        const issue = expectIssue({ timeRange, measures, having: gt('count', literal) }, 'invalid_literal', [
          'having',
          'right',
          'literal',
        ]);
        expect(issue.message).not.toContain(String(literal));
      }
      expectIssue(
        { timeRange, measures, having: { op: 'in', value: { path: 'count' }, set: [1, '2'] } },
        'invalid_literal',
        ['having', 'set'],
      );
    });

    it('rejects presence operators and literal-only operands', () => {
      expectIssue({ timeRange, measures, having: { op: 'exists', path: 'count' } }, 'operator_not_allowed', [
        'having',
        'op',
      ]);
      expectIssue(
        { timeRange, measures, having: { op: 'gt', left: { literal: 1 }, right: { literal: 2 } } },
        'invalid_operands',
        ['having'],
      );
      expectIssue({ timeRange, measures, having: { op: 'in', value: { literal: 1 }, set: [1] } }, 'invalid_operands', [
        'having',
        'value',
      ]);
    });

    it('enforces the predicate complexity budget', () => {
      const having = { op: 'and', args: Array.from({ length: TRACE_QUERY_MAX_NODES }, () => gt('count', 1)) };
      expectIssue({ timeRange, measures, having }, 'predicate_too_complex', [
        'having',
        'args',
        TRACE_QUERY_MAX_NODES - 1,
      ]);

      // Bypass the schema's pre-parse guard so the planner's own node/depth budget is exercised.
      const parsedRequest = parseTraceAggregateRequest({ timeRange, measures });
      const wide = validationError(() =>
        planTraceAggregate({ ...parsedRequest, having: having as TraceQueryScalarPredicate }),
      );
      expect(wide.issues).toEqual([
        expect.objectContaining({ code: 'predicate_too_complex', path: ['having', 'args', TRACE_QUERY_MAX_NODES - 1] }),
      ]);

      let deep: TraceQueryScalarPredicate = gt('count', 1);
      const deepPath: Array<string | number> = ['having'];
      for (let level = 0; level < TRACE_QUERY_MAX_DEPTH; level += 1) {
        deep = { op: 'not', arg: deep };
      }
      for (let level = 0; level < TRACE_QUERY_MAX_DEPTH; level += 1) deepPath.push('arg');
      const nested = validationError(() => planTraceAggregate({ ...parsedRequest, having: deep }));
      expect(nested.issues).toEqual([expect.objectContaining({ code: 'predicate_too_complex', path: deepPath })]);
    });
  });

  describe('orderBy (Decision 5)', () => {
    it('targets requested dimensions, including metadata keys', () => {
      expect(
        plan({ ...baseRequest, groupBy: ['metadata.tenant'], orderBy: { field: 'metadata.tenant', direction: 'asc' } })
          .orderBy,
      ).toEqual({ target: 'dimension', dimension: 'metadata.tenant', direction: 'asc' });
      expect(
        plan({ ...baseRequest, groupBy: ['status'], orderBy: { field: '${status}', direction: 'desc' } }).orderBy,
      ).toEqual({ target: 'dimension', dimension: 'status', direction: 'desc' });
    });

    it('rejects fields that are neither requested measures nor requested dimensions', () => {
      for (const field of ['duration.p99', 'bucket', 'status', 'startedAt']) {
        const issue = expectIssue({ ...baseRequest, orderBy: { field, direction: 'asc' } }, 'field_not_allowed', [
          'orderBy',
          'field',
        ]);
        expect(issue.message).not.toContain(field);
      }
    });

    it('normalizes countDistinct measure names identically in measures, having, and orderBy', () => {
      const spellings = ['countDistinct.threadId', 'countDistinct.${threadId}', '${countDistinct.threadId}'];
      for (const requested of spellings.slice(0, 2)) {
        for (const reference of spellings) {
          const result = plan({
            timeRange,
            measures: [requested],
            having: gt(reference, 1),
            orderBy: { field: reference, direction: 'asc' },
          });
          expect(result.measures).toEqual([
            { type: 'countDistinct', name: 'countDistinct.threadId', field: 'threadId' },
          ]);
          expect(result.having).toEqual({
            type: 'comparison',
            measure: 'countDistinct.threadId',
            operator: 'gt',
            value: 1,
          });
          expect(result.orderBy).toEqual({ target: 'measure', measure: 'countDistinct.threadId', direction: 'asc' });
        }
      }
    });
  });

  describe('time range and buckets (Decision 6)', () => {
    const day = TRACE_AGGREGATE_INTERVAL_MS['1d'];
    const range = (ms: number) => ({
      from: '2026-01-01T00:00:00Z',
      to: new Date(Date.parse('2026-01-01T00:00:00Z') + ms).toISOString(),
    });

    it('accepts 365 days at 1d and exactly 1000 aligned buckets', () => {
      expect(plan({ timeRange: range(365 * day), interval: '1d', measures: ['count'], limit: 10 }).interval).toBe('1d');
      expect(
        plan({
          timeRange: range(1000 * TRACE_AGGREGATE_INTERVAL_MS['1m']),
          interval: '1m',
          measures: ['count'],
          limit: 10,
        }).interval,
      ).toBe('1m');
    });

    it('counts UTC-aligned buckets, so an unaligned from touches one more bucket', () => {
      const minute = TRACE_AGGREGATE_INTERVAL_MS['1m'];
      const start = Date.parse('2026-01-01T00:00:30Z');
      const unaligned = { from: new Date(start).toISOString(), to: new Date(start + 1000 * minute).toISOString() };
      expect(countTraceAggregateBuckets(start, start + 1000 * minute, '1m')).toBe(1001);
      const issue = expectIssue(
        { timeRange: unaligned, interval: '1m', measures: ['count'], limit: 10 },
        'too_many_buckets',
        ['interval'],
      );
      expect(issue.message).toContain('5m');
      // One millisecond short of the boundary keeps the last bucket unopened.
      expect(countTraceAggregateBuckets(0, 1000 * minute, '1m')).toBe(1000);
      expect(countTraceAggregateBuckets(0, 1000 * minute + 1, '1m')).toBe(1001);
    });

    it('rejects too many buckets and names the smallest permitted interval', () => {
      const issue = expectIssue({ timeRange: range(day), interval: '1m', measures: ['count'] }, 'too_many_buckets', [
        'interval',
      ]);
      expect(issue.message).toContain(`${TRACE_AGGREGATE_MAX_BUCKETS}`);
      expect(issue.message).toContain('5m');
      expect(
        expectIssue({ timeRange: range(30 * day), interval: '5m', measures: ['count'] }, 'too_many_buckets', [
          'interval',
        ]).message,
      ).toContain('1h');
    });

    it('caps limit × buckets at 10,000 rows when interval is present (Decision 5)', () => {
      // Canonical example 1: default limit 100 × 62 daily buckets = 6,200.
      expect(plan({ timeRange: range(62 * day), interval: '1d', measures: ['count'] }).limit).toBe(100);
      const hours16 = 16 * TRACE_AGGREGATE_INTERVAL_MS['1h'];
      const issue = expectIssue(
        { timeRange: range(hours16), interval: '1m', measures: ['count'], limit: 1000 },
        'too_many_rows',
        ['limit'],
      );
      expect(issue.message).toContain(`${TRACE_AGGREGATE_MAX_ROWS}`);
      // Without an interval the row count equals the group count, so no cap applies.
      expect(plan({ timeRange: range(365 * day), measures: ['count'], limit: 1000 }).limit).toBe(1000);
      // The bucket cap wins when both are exceeded.
      expect(
        validationError(() => plan({ timeRange: range(day), interval: '1m', measures: ['count'], limit: 1000 })).issues,
      ).toEqual([expect.objectContaining({ code: 'too_many_buckets' })]);
    });

    it('re-checks the window even though the schema already does', () => {
      const oversized = parseTraceAggregateRequest({ timeRange: range(365 * day), measures: ['count'] });
      const error = validationError(() => planTraceAggregate({ ...oversized, timeRange: range(366 * day) }));
      expect(error.issues).toEqual([expect.objectContaining({ code: 'time_range_too_large', path: ['timeRange'] })]);
      const inverted = validationError(() =>
        planTraceAggregate({ ...oversized, interval: '1m', timeRange: { from: timeRange.to, to: timeRange.from } }),
      );
      expect(inverted.issues).toEqual([expect.objectContaining({ code: 'invalid_time_range', path: ['timeRange'] })]);
    });
  });

  it('accumulates every issue into one error', () => {
    const error = validationError(() =>
      plan({ ...baseRequest, groupBy: ['traceId'], orderBy: { field: 'duration.p99', direction: 'asc' } }),
    );
    expect(error.issues).toHaveLength(2);
    expect(error.issues.map(issue => issue.path)).toEqual([
      ['groupBy', 0],
      ['orderBy', 'field'],
    ]);
  });
});

describe('trace-aggregate storage capability', () => {
  it('fails closed for stores that do not implement trace aggregation', async () => {
    const storage = new ObservabilityStorage();
    const rejection = storage.aggregateTraces(plan());
    await expect(rejection).rejects.toBeInstanceOf(MastraError);
    await expect(rejection).rejects.toMatchObject({
      id: 'OBSERVABILITY_STORAGE_AGGREGATE_TRACES_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
    });
  });
});
