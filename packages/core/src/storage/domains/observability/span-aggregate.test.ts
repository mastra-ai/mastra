import { describe, expect, it } from 'vitest';
import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import { ObservabilityStorage } from './base';
import {
  getSpanAggregateDimensionDescriptors,
  getSpanAggregateMeasureDescriptors,
  planSpanAggregate,
  SPAN_AGGREGATE_DIMENSION_REGISTRY,
} from './span-aggregate';
import { planSpanQuery } from './span-query';
import { TRACE_AGGREGATE_MAX_ROWS } from './trace-aggregate-planner';
import { TRACE_AGGREGATE_MEASURE_REGISTRY } from './trace-aggregate-registry';
import { TraceQueryValidationError } from './trace-query';
import type { TraceQueryIssueCode } from './trace-query';

const timeRange = { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' };
const base = { timeRange, measures: ['count'] };
const eq = (path: string, literal: string) => ({ op: 'eq', left: { path }, right: { literal } });

function issues(request: unknown) {
  try {
    planSpanAggregate(request);
  } catch (error) {
    expect(error).toBeInstanceOf(TraceQueryValidationError);
    return (error as TraceQueryValidationError).issues.map(issue => ({ code: issue.code, path: issue.path }));
  }
  throw new Error('Expected a TraceQueryValidationError');
}

const expectIssue = (request: unknown, code: TraceQueryIssueCode, path: Array<string | number>) =>
  expect(issues(request)).toContainEqual({ code, path });

describe('planSpanAggregate', () => {
  it('plans the defaults', () => {
    expect(planSpanAggregate(base)).toEqual({
      result: 'spanAggregate',
      timeRange: { from: '2026-08-01T00:00:00.000Z', to: '2026-09-01T00:00:00.000Z' },
      where: undefined,
      scope: undefined,
      dimensions: [],
      interval: undefined,
      measures: [{ type: 'canonical', name: 'count' }],
      having: undefined,
      orderBy: { target: 'measure', measure: 'count', direction: 'desc' },
      limit: 100,
    });
  });

  it('plans where exactly as querySpans plans it', () => {
    const where = {
      op: 'and',
      args: [eq('spanType', 'tool_call'), eq('rootEntityName', 'support'), eq('parentEntityType', 'agent')],
    };
    expect(planSpanAggregate({ ...base, where }).where).toEqual(planSpanQuery({ timeRange, where }).where);
  });

  it.each([
    ['model', 'not a span query field'],
    ['provider', 'not a span query field'],
    ['metadata.tenant', 'trace-only'],
  ])('rejects %s in where (%s)', field => {
    expectIssue({ ...base, where: eq(field, 'x') }, 'field_not_allowed', ['where', 'left', 'path']);
  });

  it.each(Object.keys(SPAN_AGGREGATE_DIMENSION_REGISTRY))('groups by %s', dimension => {
    expect(planSpanAggregate({ ...base, groupBy: [dimension] }).dimensions).toEqual([dimension]);
  });

  it.each([
    'traceId',
    'spanId',
    'parentSpanId',
    'runId',
    'requestId',
    'metadata.tenant',
    'durationMs',
    'attributes.x',
    'model',
    'provider',
  ])('rejects %s as a dimension', dimension => {
    expectIssue({ ...base, groupBy: [dimension] }, 'field_not_allowed', ['groupBy', 0]);
  });

  it('accepts countDistinct over traceId and span dimensions, normalizing templates', () => {
    const plan = planSpanAggregate({
      ...base,
      measures: ['count', 'countDistinct.${traceId}', 'countDistinct.rootEntityName'],
      orderBy: { field: 'countDistinct.traceId', direction: 'desc' },
    });
    expect(plan.measures).toEqual([
      { type: 'canonical', name: 'count' },
      { type: 'countDistinct', name: 'countDistinct.traceId', field: 'traceId' },
      { type: 'countDistinct', name: 'countDistinct.rootEntityName', field: 'rootEntityName' },
    ]);
    expect(plan.orderBy).toEqual({ target: 'measure', measure: 'countDistinct.traceId', direction: 'desc' });
  });

  it.each(['countDistinct.spanId', 'countDistinct.metadata.tenant', 'timeToFirstChunkMs.avg'])(
    'rejects the measure %s',
    measure => {
      expectIssue(
        { ...base, measures: [measure] },
        measure.startsWith('countDistinct') ? 'field_not_allowed' : 'invalid_request',
        ['measures', 0],
      );
    },
  );

  it('accepts every trace measure, including tokens and cost', () => {
    const measures = Object.keys(TRACE_AGGREGATE_MEASURE_REGISTRY);
    expect(planSpanAggregate({ ...base, measures }).measures.map(measure => measure.name)).toEqual(measures);
  });

  it('plans having and orderBy over measures and span dimensions', () => {
    const plan = planSpanAggregate({
      ...base,
      groupBy: ['rootEntityName', 'parentEntityName'],
      measures: ['count', 'cost.sum'],
      having: { op: 'gt', left: { path: 'cost.sum' }, right: { literal: 1 } },
      orderBy: { field: 'parentEntityName', direction: 'asc' },
    });
    expect(plan.having).toEqual({ type: 'comparison', measure: 'cost.sum', operator: 'gt', value: 1 });
    expect(plan.orderBy).toEqual({ target: 'dimension', dimension: 'parentEntityName', direction: 'asc' });
  });

  it('enforces the shared window, bucket and row caps', () => {
    expectIssue(
      { ...base, timeRange: { from: '2025-01-01T00:00:00Z', to: '2026-09-01T00:00:00Z' } },
      'invalid_request',
      ['timeRange'],
    );
    expectIssue({ ...base, interval: '1m' }, 'too_many_buckets', ['interval']);
    const day = { from: '2026-08-01T00:00:00Z', to: '2026-08-02T00:00:00Z' };
    expect(24 * 1000).toBeGreaterThan(TRACE_AGGREGATE_MAX_ROWS);
    expectIssue({ ...base, timeRange: day, interval: '1h', limit: 1000 }, 'too_many_rows', ['limit']);
    expect(planSpanAggregate({ ...base, timeRange: day, interval: '1h', limit: 400 }).interval).toBe('1h');
  });

  it('reports every issue at once', () => {
    expect(
      issues({ ...base, where: eq('model', 'x'), groupBy: ['traceId'], orderBy: { field: 'nope', direction: 'asc' } }),
    ).toEqual([
      { code: 'field_not_allowed', path: ['where', 'left', 'path'] },
      { code: 'field_not_allowed', path: ['groupBy', 0] },
      { code: 'field_not_allowed', path: ['orderBy', 'field'] },
    ]);
  });

  it('normalizes the tenant scope', () => {
    expect(planSpanAggregate(base, { scope: { organizationId: 'org' } }).scope).toEqual({ organizationId: 'org' });
  });

  it('rejects unknown properties', () => {
    expectIssue({ ...base, page: { limit: 10 } }, 'invalid_request', []);
  });
});

describe('span aggregate discovery descriptors', () => {
  it('lists every span dimension and trace measure', () => {
    expect(getSpanAggregateDimensionDescriptors().map(d => d.path)).toEqual(
      Object.keys(SPAN_AGGREGATE_DIMENSION_REGISTRY),
    );
    expect(getSpanAggregateMeasureDescriptors().map(d => d.name)).toEqual(
      Object.keys(TRACE_AGGREGATE_MEASURE_REGISTRY),
    );
  });
});

describe('ObservabilityStorage.aggregateSpans', () => {
  it('is not implemented by default', async () => {
    const error = await new ObservabilityStorage().aggregateSpans(planSpanAggregate(base)).catch(e => e);
    expect(error).toBeInstanceOf(MastraError);
    expect(error).toMatchObject({
      id: 'OBSERVABILITY_STORAGE_AGGREGATE_SPANS_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
    });
  });
});
