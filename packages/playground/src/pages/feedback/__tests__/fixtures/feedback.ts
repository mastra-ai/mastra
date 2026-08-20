import type { ListFeedbackResponse } from '@mastra/core/storage';

export const emptyFeedbackList: ListFeedbackResponse = {
  feedback: [],
  pagination: { total: 0, page: 0, perPage: 25, hasMore: false },
};

export const twoFeedbackRecords: ListFeedbackResponse = {
  feedback: [
    {
      feedbackId: 'fb-1',
      timestamp: new Date('2026-08-19T10:00:00.000Z'),
      traceId: 'trace-1',
      spanId: 'span-1',
      feedbackSource: 'user',
      feedbackType: 'thumbs',
      value: 1,
      comment: 'Great answer',
      feedbackUserId: 'user-1',
      sourceId: 'msg-1',
      metadata: null,
    },
    {
      feedbackId: 'fb-2',
      timestamp: new Date('2026-08-19T11:00:00.000Z'),
      traceId: 'trace-2',
      spanId: 'span-2',
      feedbackSource: 'system',
      feedbackType: 'rating',
      value: 4,
      comment: 'Solid response overall',
      feedbackUserId: 'user-2',
      sourceId: 'msg-2',
      metadata: null,
    },
  ],
  pagination: { total: 2, page: 0, perPage: 25, hasMore: false },
};
