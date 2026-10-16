import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { FeedbackReviewStatus, UpdateFeedbackReviewStatusArgs } from '@mastra/core/storage';

// Local mirror of `feedbackReviewStatusSchema` / `updateFeedbackReviewStatusArgsSchema`
// from `@mastra/core/storage`: this package's `@mastra/core` peer floor predates those
// exports and the core-imports check forbids value imports newer than the floor.
// Keep in sync with core.
const FEEDBACK_REVIEW_STATUSES: readonly FeedbackReviewStatus[] = ['needs-review', 'reviewed'];

function isFeedbackReviewStatus(value: unknown): value is FeedbackReviewStatus {
  return FEEDBACK_REVIEW_STATUSES.some(status => status === value);
}

/** Normalize a stored value to a review status, defaulting legacy/unknown values to `needs-review`. */
export function coerceFeedbackReviewStatus(value: unknown): FeedbackReviewStatus {
  return isFeedbackReviewStatus(value) ? value : 'needs-review';
}

export function parseUpdateFeedbackReviewStatusArgs(
  args: UpdateFeedbackReviewStatusArgs,
): UpdateFeedbackReviewStatusArgs {
  const invalid = (text: string) =>
    new MastraError({
      id: 'OBSERVABILITY_UPDATE_FEEDBACK_REVIEW_STATUS_INVALID_ARGS',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.USER,
      text,
    });
  if (typeof args !== 'object' || args === null) {
    throw invalid('args must be an object');
  }
  if (typeof args.feedbackId !== 'string' || args.feedbackId.length === 0) {
    throw invalid('feedbackId is required');
  }
  if (!isFeedbackReviewStatus(args.reviewStatus)) {
    throw invalid(`reviewStatus must be one of: ${FEEDBACK_REVIEW_STATUSES.join(', ')}`);
  }
  return { feedbackId: args.feedbackId, reviewStatus: args.reviewStatus };
}
