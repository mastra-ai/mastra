import type { FeedbackRecord } from '@mastra/core/storage';

/** Human-readable body of a feedback record: comment → string value → thumbs → raw JSON. */
export function feedbackDisplayValue(feedback: Pick<FeedbackRecord, 'comment' | 'value' | 'feedbackType'>) {
  if (feedback.comment) return feedback.comment;
  if (typeof feedback.value === 'string') return feedback.value;
  if (feedback.feedbackType === 'thumbs') return feedback.value === 1 ? 'Thumbs up' : 'Thumbs down';
  return JSON.stringify(feedback.value) ?? String(feedback.value);
}
