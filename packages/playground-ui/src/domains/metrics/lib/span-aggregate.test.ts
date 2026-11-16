import { spanAggregateRequestSchema } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import { andSpanWhere, buildSpanAggregateWhere, spanEq } from './span-aggregate';

const timeRange = { from: '2026-10-19T12:00:00.000Z', to: '2026-10-20T12:00:00.000Z' };

describe('buildSpanAggregateWhere', () => {
  describe('when no filter is set', () => {
    it('sends no predicate', () => {
      expect(buildSpanAggregateWhere({})).toEqual({ supported: true, where: undefined });
    });
  });

  describe('when span fields are filtered, including ones traces cannot filter on', () => {
    const result = buildSpanAggregateWhere({
      rootEntityType: 'agent',
      entityName: 'support-agent',
      environment: 'production',
      serviceName: 'api',
      experimentId: 'exp-1',
    });

    it('requires all of them, the primitive type as the span entity type', () => {
      expect(result).toEqual({
        supported: true,
        where: {
          op: 'and',
          args: [
            spanEq('entityType', 'agent'),
            spanEq('entityName', 'support-agent'),
            spanEq('environment', 'production'),
            spanEq('serviceName', 'api'),
            spanEq('experimentId', 'exp-1'),
          ],
        },
      });
    });

    it('is a predicate the server accepts, alongside a span type', () => {
      if (!result.supported || !result.where) throw new Error('expected a predicate');
      const where = andSpanWhere(spanEq('spanType', 'agent_run'), result.where);
      expect(spanAggregateRequestSchema.safeParse({ timeRange, where, measures: ['count'] }).success).toBe(true);
    });
  });

  describe('when a filter has no span equivalent', () => {
    it('reports it, so the card can say so', () => {
      expect(buildSpanAggregateWhere({ environment: 'production', tags: ['beta'], model: 'gpt-4o-mini' })).toEqual({
        supported: false,
        unsupportedFields: ['tags', 'model'],
      });
    });
  });
});

describe('andSpanWhere', () => {
  describe('when the page has no filter', () => {
    it('sends the card predicate alone', () => {
      expect(andSpanWhere(spanEq('spanType', 'tool_call'), undefined)).toEqual(spanEq('spanType', 'tool_call'));
    });
  });
});
