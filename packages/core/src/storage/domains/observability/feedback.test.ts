import { describe, expect, it } from 'vitest';
import {
  createFeedbackArgsSchema,
  createFeedbackRecordSchema,
  feedbackFilterSchema,
  feedbackInputSchema,
  feedbackRecordSchema,
  listFeedbackArgsSchema,
  listFeedbackResponseSchema,
} from './feedback';

describe('Feedback Schemas', () => {
  const now = new Date();

  describe('feedbackRecordSchema', () => {
    it('accepts a complete feedback record', () => {
      const record = feedbackRecordSchema.parse({
        timestamp: now,
        traceId: 'trace-1',
        spanId: 'span-1',
        source: 'user',
        feedbackType: 'thumbs',
        value: 1,
        comment: 'Great response!',
        experimentId: 'exp-1',
        userId: 'user-123',
        metadata: { page: '/chat' },
      });
      expect(record.source).toBe('user');
      expect(record.feedbackType).toBe('thumbs');
      expect(record.value).toBe(1);
      expect(record.userId).toBe('user-123');
    });

    it('accepts string value', () => {
      const record = feedbackRecordSchema.parse({
        id: 'fb-2',
        timestamp: now,
        traceId: 'trace-1',
        source: 'qa',
        feedbackType: 'correction',
        value: 'The correct answer is 42',
        createdAt: now,
        updatedAt: null,
      });
      expect(record.value).toBe('The correct answer is 42');
    });

    it('accepts a minimal feedback record', () => {
      const record = feedbackRecordSchema.parse({
        id: 'fb-3',
        timestamp: now,
        traceId: 'trace-1',
        source: 'user',
        feedbackType: 'rating',
        value: 4,
        createdAt: now,
        updatedAt: null,
      });
      expect(record.spanId).toBeUndefined();
      expect(record.comment).toBeUndefined();
    });

    it('rejects missing traceId', () => {
      expect(() =>
        feedbackRecordSchema.parse({
          id: 'fb-4',
          timestamp: now,
          source: 'user',
          feedbackType: 'thumbs',
          value: 1,
          createdAt: now,
          updatedAt: null,
        }),
      ).toThrow();
    });
  });

  describe('feedbackInputSchema', () => {
    it('accepts valid user input', () => {
      const input = feedbackInputSchema.parse({
        source: 'user',
        feedbackType: 'thumbs',
        value: 1,
        comment: 'Helpful',
        userId: 'user-123',
        metadata: { page: '/chat' },
        experimentId: 'exp-1',
      });
      expect(input.source).toBe('user');
      expect(input.userId).toBe('user-123');
    });

    it('accepts minimal input', () => {
      const input = feedbackInputSchema.parse({
        source: 'system',
        feedbackType: 'rating',
        value: 3,
      });
      expect(input.comment).toBeUndefined();
      expect(input.userId).toBeUndefined();
    });
  });

  describe('createFeedbackRecordSchema', () => {
    it('omits db timestamps', () => {
      const record = createFeedbackRecordSchema.parse({
        timestamp: now,
        traceId: 'trace-1',
        source: 'user',
        feedbackType: 'thumbs',
        value: 1,
      });
      expect(record).not.toHaveProperty('createdAt');
      expect(record).not.toHaveProperty('updatedAt');
    });
  });

  describe('createFeedbackArgsSchema', () => {
    it('wraps a feedback record', () => {
      const args = createFeedbackArgsSchema.parse({
        feedback: {
          timestamp: now,
          traceId: 'trace-1',
          source: 'user',
          feedbackType: 'thumbs',
          value: 1,
        },
      });
      expect(args.feedback.traceId).toBe('trace-1');
      expect(args.feedback.source).toBe('user');
      expect(args.feedback.value).toBe(1);
    });
  });

  describe('feedbackFilterSchema', () => {
    it('accepts all filter options', () => {
      const filter = feedbackFilterSchema.parse({
        timestamp: { start: now, end: now },
        traceId: 'trace-1',
        spanId: 'span-1',
        feedbackType: ['thumbs', 'rating'],
        source: 'user',
        experimentId: 'exp-1',
        userId: 'user-123',
        environment: 'production',
      });
      expect(filter.feedbackType).toEqual(['thumbs', 'rating']);
      expect(filter.source).toBe('user');
    });

    it('accepts single feedback type as string', () => {
      const filter = feedbackFilterSchema.parse({ feedbackType: 'thumbs' });
      expect(filter.feedbackType).toBe('thumbs');
    });

    it('accepts empty filter', () => {
      const filter = feedbackFilterSchema.parse({});
      expect(filter).toEqual({});
    });
  });

  describe('listFeedbackArgsSchema', () => {
    it('applies defaults', () => {
      const args = listFeedbackArgsSchema.parse({});
      expect(args.pagination).toEqual({ page: 0, perPage: 10 });
      expect(args.orderBy).toEqual({ field: 'timestamp', direction: 'DESC' });
    });

    it('accepts custom pagination', () => {
      const args = listFeedbackArgsSchema.parse({
        pagination: { page: 1, perPage: 25 },
      });
      expect(args.pagination.page).toBe(1);
      expect(args.pagination.perPage).toBe(25);
    });
  });

  describe('listFeedbackResponseSchema', () => {
    it('validates a response', () => {
      const response = listFeedbackResponseSchema.parse({
        pagination: { total: 5, page: 0, perPage: 10, hasMore: false },
        feedback: [
          {
            id: 'fb-1',
            timestamp: now,
            traceId: 'trace-1',
            source: 'user',
            feedbackType: 'thumbs',
            value: 1,
            createdAt: now,
            updatedAt: null,
          },
        ],
      });
      expect(response.feedback).toHaveLength(1);
      expect(response.pagination.hasMore).toBe(false);
    });
  });
});
