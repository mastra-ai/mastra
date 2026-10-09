import type { FeedbackItem } from '@mastra/client-js';

/** Display label for a feedback author: name → email → id. */
export function feedbackAuthorLabel(feedback: Pick<FeedbackItem, 'author'>): string | undefined {
  const author = feedback.author;
  return author ? author.name || author.email || author.id : undefined;
}
