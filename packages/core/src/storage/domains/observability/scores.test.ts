import { describe, expect, it } from 'vitest';
import {
  createScoreArgsSchema,
  createScoreRecordSchema,
  getScoreAggregateArgsSchema,
  getScoreAggregateResponseSchema,
  getScoreBreakdownArgsSchema,
  getScoreBreakdownResponseSchema,
  getScorePercentilesArgsSchema,
  getScorePercentilesResponseSchema,
  getScoreTimeSeriesArgsSchema,
  getScoreTimeSeriesResponseSchema,
  listScoresArgsSchema,
  listScoresResponseSchema,
  scoreInputSchema,
  scoreRecordSchema,
  scoresFilterSchema,
} from './scores';

describe('Score Schemas', () => {
  const now = new Date();

  describe('scoreRecordSchema', () => {
    it('accepts a complete score record', () => {
      const record = scoreRecordSchema.parse({
        id: 'score-1',
        timestamp: now,
        traceId: 'trace-1',
        spanId: 'span-1',
        scorerId: 'relevance',
        score: 0.85,
        reason: 'Highly relevant response',
        experimentId: 'exp-1',
        entityType: 'agent',
        userId: 'user-123',
        executionSource: 'cloud',
        tags: ['prod'],
        metadata: { model: 'gpt-4' },
        createdAt: now,
        updatedAt: now,
      });
      expect(record.scorerId).toBe('relevance');
      expect(record.score).toBe(0.85);
    });

    it('accepts a minimal score record', () => {
      const record = scoreRecordSchema.parse({
        id: 'score-2',
        timestamp: now,
        traceId: 'trace-1',
        scorerId: 'accuracy',
        score: 0.9,
        createdAt: now,
        updatedAt: null,
      });
      expect(record.spanId).toBeUndefined();
      expect(record.reason).toBeUndefined();
    });

    it('accepts an unanchored score record without traceId', () => {
      const record = scoreRecordSchema.parse({
        id: 'score-3',
        timestamp: now,
        scorerId: 'test',
        score: 0.5,
        createdAt: now,
        updatedAt: null,
      });
      expect(record.traceId).toBeUndefined();
    });
  });

  describe('scoreInputSchema', () => {
    it('accepts valid user input', () => {
      const input = scoreInputSchema.parse({
        scorerId: 'relevance',
        source: 'manual',
        score: 0.85,
        reason: 'Good match',
        metadata: { threshold: 0.8 },
        experimentId: 'exp-1',
      });
      expect(input.scorerId).toBe('relevance');
      expect(input.source).toBe('manual');
    });

    it('accepts minimal input', () => {
      const input = scoreInputSchema.parse({
        scorerId: 'accuracy',
        score: 0.9,
      });
      expect(input.reason).toBeUndefined();
      expect(input.experimentId).toBeUndefined();
    });
  });

  describe('createScoreRecordSchema', () => {
    it('omits db timestamps', () => {
      const record = createScoreRecordSchema.parse({
        id: 'score-1',
        timestamp: now,
        traceId: 'trace-1',
        scorerId: 'test',
        score: 0.5,
      });
      expect(record).not.toHaveProperty('createdAt');
      expect(record).not.toHaveProperty('updatedAt');
    });
  });

  describe('createScoreArgsSchema', () => {
    it('wraps a score record', () => {
      const args = createScoreArgsSchema.parse({
        score: {
          timestamp: now,
          traceId: 'trace-1',
          scorerId: 'test',
          score: 0.5,
        },
      });
      expect(args.score.traceId).toBe('trace-1');
      expect(args.score.scorerId).toBe('test');
      expect(args.score.score).toBe(0.5);
    });
  });

  describe('scoresFilterSchema', () => {
    it('accepts all filter options', () => {
      const filter = scoresFilterSchema.parse({
        timestamp: { start: now, end: now },
        traceId: 'trace-1',
        spanId: 'span-1',
        scorerId: ['relevance', 'accuracy'],
        scoreSource: 'manual',
        experimentId: 'exp-1',
        userId: 'user-123',
        tags: ['prod'],
        environment: 'production',
        executionSource: 'cloud',
      });
      expect(filter.scorerId).toEqual(['relevance', 'accuracy']);
      expect(filter.scoreSource).toBe('manual');
      expect(filter.executionSource).toBe('cloud');
    });

    it('accepts single scorer ID as string', () => {
      const filter = scoresFilterSchema.parse({ scorerId: 'relevance' });
      expect(filter.scorerId).toBe('relevance');
    });

    it('accepts empty filter', () => {
      const filter = scoresFilterSchema.parse({});
      expect(filter).toEqual({});
    });
  });

  describe('listScoresArgsSchema', () => {
    it('applies defaults', () => {
      const args = listScoresArgsSchema.parse({});
      expect(args.pagination).toEqual({ page: 0, perPage: 10 });
      expect(args.orderBy).toEqual({ field: 'timestamp', direction: 'DESC' });
    });

    it('accepts order by score value', () => {
      const args = listScoresArgsSchema.parse({
        orderBy: { field: 'score', direction: 'ASC' },
      });
      expect(args.orderBy.field).toBe('score');
    });
  });

  describe('listScoresResponseSchema', () => {
    it('validates a response', () => {
      const response = listScoresResponseSchema.parse({
        pagination: { total: 10, page: 0, perPage: 10, hasMore: false },
        scores: [
          {
            id: 'score-1',
            timestamp: now,
            traceId: 'trace-1',
            scorerId: 'relevance',
            score: 0.85,
            userId: 'user-123',
            createdAt: now,
            updatedAt: null,
          },
        ],
      });
      expect(response.scores).toHaveLength(1);
      expect(response.pagination.hasMore).toBe(false);
    });
  });

  describe('score OLAP schemas', () => {
    it('getScoreAggregateArgsSchema validates', () => {
      const args = getScoreAggregateArgsSchema.parse({
        scorerId: 'relevance',
        scoreSource: 'manual',
        aggregation: 'avg',
        comparePeriod: 'previous_period',
        filters: { experimentId: 'exp-1' },
      });
      expect(args.scorerId).toBe('relevance');
      expect(args.scoreSource).toBe('manual');
    });

    it('getScoreAggregateResponseSchema validates', () => {
      const response = getScoreAggregateResponseSchema.parse({
        value: 0.8,
        previousValue: 0.75,
        changePercent: 6.67,
      });
      expect(response.value).toBe(0.8);
    });

    it('getScoreBreakdownArgsSchema validates', () => {
      const args = getScoreBreakdownArgsSchema.parse({
        scorerId: 'relevance',
        aggregation: 'avg',
        groupBy: ['experimentId'],
      });
      expect(args.groupBy).toEqual(['experimentId']);
    });

    it('getScoreBreakdownResponseSchema validates', () => {
      const response = getScoreBreakdownResponseSchema.parse({
        groups: [{ dimensions: { experimentId: 'exp-1' }, value: 0.8 }],
      });
      expect(response.groups[0]?.value).toBe(0.8);
    });

    it('getScoreTimeSeriesArgsSchema validates', () => {
      const args = getScoreTimeSeriesArgsSchema.parse({
        scorerId: 'relevance',
        scoreSource: 'manual',
        aggregation: 'avg',
        interval: '1h',
        groupBy: ['entityName'],
      });
      expect(args.interval).toBe('1h');
    });

    it('getScoreTimeSeriesResponseSchema validates', () => {
      const response = getScoreTimeSeriesResponseSchema.parse({
        series: [{ name: 'relevance', points: [{ timestamp: now, value: 0.8 }] }],
      });
      expect(response.series[0]?.points[0]?.value).toBe(0.8);
    });

    it('getScorePercentilesArgsSchema validates', () => {
      const args = getScorePercentilesArgsSchema.parse({
        scorerId: 'relevance',
        percentiles: [0.5, 0.95],
        interval: '1h',
      });
      expect(args.percentiles).toEqual([0.5, 0.95]);
    });

    it('getScorePercentilesArgsSchema rejects empty percentile arrays', () => {
      expect(() =>
        getScorePercentilesArgsSchema.parse({
          scorerId: 'relevance',
          percentiles: [],
          interval: '1h',
        }),
      ).toThrow();
    });

    it('getScorePercentilesResponseSchema validates', () => {
      const response = getScorePercentilesResponseSchema.parse({
        series: [{ percentile: 0.5, points: [{ timestamp: now, value: 0.8 }] }],
      });
      expect(response.series[0]?.percentile).toBe(0.5);
    });
  });
});
