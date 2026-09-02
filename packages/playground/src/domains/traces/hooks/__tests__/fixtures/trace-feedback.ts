import type { RouteResponse } from '@mastra/client-js';

type ListFeedbackResponse = RouteResponse<'GET /observability/feedback'>;

export const TRACE_ID = 'trace-1';
export const SPAN_ID = 'span-a';
export const OTHER_SPAN_ID = 'span-b';

type Feedback = ListFeedbackResponse['feedback'][number];

const baseFeedback = {
  timestamp: new Date('2026-08-26T10:00:00.000Z'),
  traceId: TRACE_ID,
  feedbackType: 'thumbs',
  value: 1,
  reviewStatus: 'needs-review',
} satisfies Feedback;

export function feedbackRecord(overrides: Partial<Feedback> = {}): Feedback {
  return { ...baseFeedback, ...overrides };
}

export function listFeedbackResponse(feedback: Feedback[], page = 0): ListFeedbackResponse {
  return {
    feedback,
    pagination: { page, perPage: 10, total: feedback.length, hasMore: false },
  };
}

/** Mixed page: trace-level records (spanId absent / null) alongside span-scoped ones. */
export const mixedFeedbackResponse = listFeedbackResponse([
  feedbackRecord({ feedbackId: 'trace-level-undefined' }),
  feedbackRecord({ feedbackId: 'trace-level-null', spanId: null }),
  feedbackRecord({ feedbackId: 'span-scoped', spanId: SPAN_ID }),
]);

export const spanFeedbackResponse = listFeedbackResponse([
  feedbackRecord({ feedbackId: 'span-a-feedback', spanId: SPAN_ID }),
]);

export const otherSpanFeedbackResponse = listFeedbackResponse([
  feedbackRecord({ feedbackId: 'span-b-feedback', spanId: OTHER_SPAN_ID, value: 0 }),
]);
