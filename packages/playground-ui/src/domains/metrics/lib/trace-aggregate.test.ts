import { planTraceAggregate, traceAggregateRequestSchema } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import {
  bucketTraceAggregateRows,
  buildTraceAggregateWhere,
  TRACE_AGGREGATE_SERIES_LIMIT,
  toTraceAggregateTimeRange,
  traceAggregateInterval,
  traceAggregateRowCost,
} from './trace-aggregate';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const end = new Date(2026, 9, 20, 12, 0, 0);
const window = (ms: number) => ({ start: new Date(end.getTime() - ms), end });

describe('buildTraceAggregateWhere', () => {
  describe('when no filter is set', () => {
    it('sends no predicate', () => {
      expect(buildTraceAggregateWhere({})).toEqual({ supported: true, where: undefined });
    });
  });

  describe('when trace, tag and span filters are set', () => {
    const result = buildTraceAggregateWhere({
      rootEntityType: 'agent',
      entityName: 'support-agent',
      environment: 'production',
      sessionId: 'session-1',
      tags: ['beta', 'eu'],
      model: 'gpt-4o-mini',
    });

    it('requires all of them', () => {
      expect(result).toEqual({
        supported: true,
        where: {
          op: 'and',
          args: [
            { op: 'eq', left: { path: 'entityType' }, right: { literal: 'agent' } },
            { op: 'eq', left: { path: 'entityName' }, right: { literal: 'support-agent' } },
            { op: 'eq', left: { path: 'environment' }, right: { literal: 'production' } },
            { op: 'eq', left: { path: 'sessionId' }, right: { literal: 'session-1' } },
            { op: 'includes', path: 'tags', value: 'beta' },
            { op: 'includes', path: 'tags', value: 'eu' },
            { spans: { some: { op: 'eq', left: { path: 'model' }, right: { literal: 'gpt-4o-mini' } } } },
          ],
        },
      });
    });

    it('builds a request the server accepts', () => {
      if (!result.supported) throw new Error('expected a supported filter');
      const request = {
        timeRange: toTraceAggregateTimeRange(window(DAY)),
        where: result.where,
        measures: ['count'],
      };
      expect(traceAggregateRequestSchema.safeParse(request).success).toBe(true);
    });
  });

  describe('when a filter has no trace equivalent', () => {
    it('reports it instead of dropping it', () => {
      expect(buildTraceAggregateWhere({ serviceName: 'api', environment: 'production' })).toEqual({
        supported: false,
        unsupportedFields: ['serviceName'],
      });
    });
  });
});

describe('traceAggregateInterval', () => {
  it.each([
    ['24 hours', DAY, '1h'],
    ['14 days', 14 * DAY, '1h'],
    ['30 days', 30 * DAY, '1d'],
  ])('asks for %s in %s buckets', (_label, ms, interval) => {
    expect(traceAggregateInterval(window(ms))).toBe(interval);
  });
});

describe('bucketTraceAggregateRows', () => {
  describe('when only some buckets have traces', () => {
    const range = window(6 * HOUR);
    const busyHour = new Date(end.getTime() - 2 * HOUR);
    const buckets = bucketTraceAggregateRows(
      [{ bucket: busyHour.toISOString(), dimensions: { spanType: 'agent_run' }, measures: { 'duration.p50': 120 } }],
      range,
    );

    it('keeps every hour of the window on the axis', () => {
      expect(buckets).toHaveLength(7);
    });

    it('puts the row in its own hour and leaves the others empty', () => {
      const filled = buckets.filter(bucket => bucket.rows.length > 0);
      expect(filled.map(bucket => bucket.ts)).toEqual([busyHour.getTime()]);
    });
  });
});

describe('grouped time series limits', () => {
  const plan = (days: number, limit?: number) => {
    const window = { start: new Date(Date.UTC(2026, 0, 1)), end: new Date(Date.UTC(2026, 0, 1) + days * 86_400_000) };
    return () =>
      planTraceAggregate(
        traceAggregateRequestSchema.parse({
          timeRange: toTraceAggregateTimeRange(window),
          interval: traceAggregateInterval(window),
          groupBy: ['spanType'],
          measures: ['duration.p50'],
          limit,
        }),
      );
  };

  it("breaks the server's row cap at the default limit over two weeks", () => {
    expect(plan(14)).toThrow();
  });

  it.each([1, 14, 30, 365])('fits a %i-day window at the series limit', days => {
    expect(plan(days, TRACE_AGGREGATE_SERIES_LIMIT)).not.toThrow();
  });
});

describe('traceAggregateRowCost', () => {
  describe('when the row has a priced total', () => {
    it('keeps the total, coverage and currency', () => {
      const row = { measures: { 'cost.sum': 4.2 }, cost: { coverage: 0.5, unit: 'USD' } };
      expect(traceAggregateRowCost(row)).toEqual({ value: 4.2, coverage: 0.5, unit: 'USD' });
    });
  });

  describe('when the row has nothing priced', () => {
    it('reads the nulls as absent', () => {
      const row = { measures: { 'cost.sum': null }, cost: { coverage: null, unit: null } };
      expect(traceAggregateRowCost(row)).toEqual({});
    });
  });

  describe('when there is no row', () => {
    it('has no cost', () => {
      expect(traceAggregateRowCost(undefined)).toEqual({});
    });
  });
});
