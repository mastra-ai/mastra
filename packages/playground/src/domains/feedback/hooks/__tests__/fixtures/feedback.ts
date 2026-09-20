import type { ListFeedbackResponse } from '@mastra/client-js';

export const emptyFeedback: ListFeedbackResponse = {
  feedback: [],
  pagination: { total: 0, page: 0, perPage: 1, hasMore: false },
};
