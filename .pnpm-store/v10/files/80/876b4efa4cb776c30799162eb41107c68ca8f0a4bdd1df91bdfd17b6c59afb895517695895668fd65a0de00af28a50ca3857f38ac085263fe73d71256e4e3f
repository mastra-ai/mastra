import { ThreadMessage } from "../../../types/AssistantTypes";

/**
 * Feedback data structure for rating messages.
 */
type FeedbackAdapterFeedback = {
  /** The message being rated */
  message: ThreadMessage;
  /** The type of feedback being provided */
  type: "positive" | "negative";
};

/**
 * Interface for handling user feedback on assistant messages.
 *
 * FeedbackAdapter allows users to provide positive or negative feedback
 * on assistant responses, which can be used for analytics, model improvement,
 * or user experience tracking.
 *
 * @example
 * ```tsx
 * const feedbackAdapter: FeedbackAdapter = {
 *   submit: (feedback) => {
 *     console.log(`User gave ${feedback.type} feedback on message:`, feedback.message.id);
 *
 *     // Send to analytics service
 *     analytics.track('message_feedback', {
 *       messageId: feedback.message.id,
 *       feedbackType: feedback.type,
 *       messageContent: feedback.message.content
 *     });
 *   }
 * };
 * ```
 */
export type FeedbackAdapter = {
  /**
   * Submits user feedback for a message.
   *
   * @param feedback - The feedback data containing message and rating type
   */
  submit: (feedback: FeedbackAdapterFeedback) => void;
};
