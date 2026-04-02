import { describe, expect, it } from 'vitest';
import {
  createFeedbackArgsSchema,
  createFeedbackRecordSchema,
  feedbackFilterSchema,
  feedbackInputSchema,
  feedbackRecordSchema,
  getFeedbackAggregateArgsSchema,
  getFeedbackAggregateResponseSchema,
  getFeedbackBreakdownArgsSchema,
  getFeedbackBreakdownResponseSchema,
  getFeedbackPercentilesArgsSchema,
  getFeedbackPercentilesResponseSchema,
  getFeedbackTimeSeriesArgsSchema,
  getFeedbackTimeSeriesResponseSchema,
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
        feedbackSource: 'user',
        feedbackType: 'thumbs',
        value: 1,
        comment: 'Great response!',
        experimentId: 'exp-1',
        userId: 'trace-user-123',
        feedbackUserId: 'user-123',
        entityType: 'agent',
        executionSource: 'cloud',
        tags: ['prod'],
        metadata: { page: '/chat' },
      });
      expect(record.feedbackSource).toBe('user');
      expect(record.feedbackType).toBe('thumbs');
      expect(record.value).toBe(1);
      expect(record.feedbackUserId).toBe('user-123');
      expect(record.userId).toBe('trace-user-123');
    });

    it('accepts string value', () => {
      const record = feedbackRecordSchema.parse({
        id: 'fb-2',
        timestamp: now,
        traceId: 'trace-1',
        feedbackSource: 'qa',
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
        feedbackSource: 'user',
        feedbackType: 'rating',
        value: 4,
        createdAt: now,
        updatedAt: null,
      });
      expect(record.spanId).toBeUndefined();
      expect(record.comment).toBeUndefined();
    });

    it('accepts unanchored feedback without traceId', () => {
      const record = feedbackRecordSchema.parse({
        id: 'fb-4',
        timestamp: now,
        feedbackSource: 'user',
        feedbackType: 'thumbs',
        value: 1,
        createdAt: now,
        updatedAt: null,
      });
      expect(record.traceId).toBeUndefined();
    });
  });

  describe('feedbackInputSchema', () => {
    it('accepts valid user input', () => {
      const input = feedbackInputSchema.parse({
        source: 'user',
        feedbackType: 'thumbs',
        value: 1,
        comment: 'Helpful',
        feedbackUserId: 'user-123',
        metadata: { page: '/chat' },
        experimentId: 'exp-1',
      });
      expect(input.source).toBe('user');
      expect(input.feedbackUserId).toBe('user-123');
    });

    it('accepts minimal input', () => {
      const input = feedbackInputSchema.parse({
        source: 'system',
        feedbackType: 'rating',
        value: 3,
      });
      expect(input.comment).toBeUndefined();
      expect(input.feedbackUserId).toBeUndefined();
    });
  });

  describe('createFeedbackRecordSchema', () => {
    it('omits db timestamps', () => {
      const record = createFeedbackRecordSchema.parse({
        timestamp: now,
        traceId: 'trace-1',
        feedbackSource: 'user',
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
          feedbackSource: 'user',
          feedbackType: 'thumbs',
          value: 1,
        },
      });
      expect(args.feedback.traceId).toBe('trace-1');
      expect(args.feedback.feedbackSource).toBe('user');
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
        feedbackSource: 'user',
        experimentId: 'exp-1',
        userId: 'trace-user-123',
        feedbackUserId: 'user-123',
        tags: ['prod'],
        environment: 'production',
        executionSource: 'cloud',
      });
      expect(filter.feedbackType).toEqual(['thumbs', 'rating']);
      expect(filter.feedbackSource).toBe('user');
      expect(filter.executionSource).toBe('cloud');
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
            feedbackSource: 'user',
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

  describe('feedback OLAP schemas', () => {
    it('getFeedbackAggregateArgsSchema validates', () => {
      const args = getFeedbackAggregateArgsSchema.parse({
        feedbackType: 'rating',
        feedbackSource: 'user',
        aggregation: 'avg',
        comparePeriod: 'previous_week',
      });
      expect(args.feedbackType).toBe('rating');
      expect(args.feedbackSource).toBe('user');
    });

    it('getFeedbackAggregateResponseSchema validates', () => {
      const response = getFeedbackAggregateResponseSchema.parse({
        value: 4.2,
        previousValue: 4.0,
        changePercent: 5,
      });
      expect(response.value).toBe(4.2);
    });

    it('getFeedbackBreakdownArgsSchema validates', () => {
      const args = getFeedbackBreakdownArgsSchema.parse({
        feedbackType: 'rating',
        aggregation: 'avg',
        groupBy: ['entityName'],
      });
      expect(args.groupBy).toEqual(['entityName']);
    });

    it('getFeedbackBreakdownResponseSchema validates', () => {
      const response = getFeedbackBreakdownResponseSchema.parse({
        groups: [{ dimensions: { entityName: 'agent-a' }, value: 4.5 }],
      });
      expect(response.groups[0]?.value).toBe(4.5);
    });

    it('getFeedbackTimeSeriesArgsSchema validates', () => {
      const args = getFeedbackTimeSeriesArgsSchema.parse({
        feedbackType: 'rating',
        feedbackSource: 'user',
        aggregation: 'avg',
        interval: '1d',
      });
      expect(args.interval).toBe('1d');
    });

    it('getFeedbackTimeSeriesResponseSchema validates', () => {
      const response = getFeedbackTimeSeriesResponseSchema.parse({
        series: [{ name: 'rating', points: [{ timestamp: now, value: 4.5 }] }],
      });
      expect(response.series[0]?.points[0]?.value).toBe(4.5);
    });

    it('getFeedbackPercentilesArgsSchema validates', () => {
      const args = getFeedbackPercentilesArgsSchema.parse({
        feedbackType: 'rating',
        feedbackSource: 'user',
        percentiles: [0.5, 0.95],
        interval: '1h',
      });
      expect(args.percentiles).toEqual([0.5, 0.95]);
    });

    it('getFeedbackPercentilesArgsSchema rejects empty percentile arrays', () => {
      expect(() =>
        getFeedbackPercentilesArgsSchema.parse({
          feedbackType: 'rating',
          feedbackSource: 'user',
          percentiles: [],
          interval: '1h',
        }),
      ).toThrow();
    });

    it('getFeedbackPercentilesResponseSchema validates', () => {
      const response = getFeedbackPercentilesResponseSchema.parse({
        series: [{ percentile: 0.95, points: [{ timestamp: now, value: 5 }] }],
      });
      expect(response.series[0]?.percentile).toBe(0.95);
    });
  });
});
