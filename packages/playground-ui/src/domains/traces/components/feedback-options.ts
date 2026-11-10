import type { FeedbackWriteOptions } from '@mastra/react/hooks/traces';

/** Host-specific write context and supported actions for the existing feedback composer. */
export type FeedbackOptions = FeedbackWriteOptions & {
  /** Defaults to true. Hide deletion when the host does not support the client DELETE contract. */
  allowDelete?: boolean;
  /** Defaults to true. Hide review updates when the host does not support review-status PATCH. */
  allowReview?: boolean;
};
