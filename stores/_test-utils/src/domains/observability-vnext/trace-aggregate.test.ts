import { parseTraceQueryRequest, planTraceQuery, type TraceQueryPredicate } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import {
  evaluateTraceAggregateRequest,
  traceAggregateDimensionValue,
  traceAggregatePercentile,
} from './trace-aggregate';
import {
  evaluateTraceQuery,
  makeTraceQuerySpan as span,
  TRACE_QUERY_FIXTURE_DATA,
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
    expect(traceAggregateDimensionValue(root, 'metadata.padded')).toBe('tenant-a');
    expect(traceAggregateDimensionValue(root, 'metadata.empty')).toBeNull();
    expect(traceAggregateDimensionValue(root, 'metadata.blank')).toBeNull();
    expect(traceAggregateDimensionValue(root, 'metadata.numeric')).toBeNull();
    expect(traceAggregateDimensionValue(root, 'metadata.nested')).toBeNull();
    expect(traceAggregateDimensionValue(root, 'metadata.missing')).toBeNull();
    expect(traceAggregateDimensionValue(span(2, 'u', 'u'), 'metadata.padded')).toBeNull();
    expect(traceAggregateDimensionValue(span(3, 'e', 'e', { error: { message: 'x' } }), 'status')).toBe('error');
    expect(traceAggregateDimensionValue(span(4, 's', 's'), 'status')).toBe('success');
  });
});
