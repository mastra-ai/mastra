import { describe, expect, it } from 'vitest';
import {
  createScoreArgsSchema,
  createScoreRecordSchema,
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

    it('rejects missing traceId', () => {
      expect(() =>
        scoreRecordSchema.parse({
          id: 'score-3',
          timestamp: now,
          scorerId: 'test',
          score: 0.5,
          createdAt: now,
          updatedAt: null,
        }),
      ).toThrow();
    });
  });

  describe('scoreInputSchema', () => {
    it('accepts valid user input', () => {
      const input = scoreInputSchema.parse({
        scorerId: 'relevance',
        score: 0.85,
        reason: 'Good match',
        metadata: { threshold: 0.8 },
        experimentId: 'exp-1',
      });
      expect(input.scorerId).toBe('relevance');
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
        experimentId: 'exp-1',
        environment: 'production',
      });
      expect(filter.scorerId).toEqual(['relevance', 'accuracy']);
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
            createdAt: now,
            updatedAt: null,
          },
        ],
      });
      expect(response.scores).toHaveLength(1);
      expect(response.pagination.hasMore).toBe(false);
    });
  });
});
