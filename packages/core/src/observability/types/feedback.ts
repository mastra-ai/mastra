// packages/core/src/observability/types/feedback.ts
import type { CorrelationContext } from './core';

// ============================================================================
// FeedbackInput (User Input)
// ============================================================================

/**
 * User-provided feedback data for human evaluation of span/trace quality.
 * Used with recordedSpan.addFeedback() and recordedTrace.addFeedback().
 */
export interface FeedbackInput {
  /** Source of the feedback (e.g., "user", "admin", "qa") */
  source: string;

  /** Type of feedback (e.g., "thumbs", "rating", "correction") */
  feedbackType: string;

  /** Feedback value (e.g., "up"/"down", 1-5, correction text) */
  value: number | string;

  /** Optional comment explaining the feedback */
  comment?: string;

  /** Optional source record identifier this feedback is linked to */
  sourceId?: string;

  /** User who provided the feedback */
  feedbackUserId?: string;

  /**
   * @deprecated Derived from the target trace/span. Use `correlationContext.experimentId` on the exported event instead.
   */
  experimentId?: string;

  /** Additional metadata specific to this feedback */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// ExportedFeedback (Event Bus Transport)
// ============================================================================

/**
 * Feedback data transported via the event bus.
 * Must be JSON-serializable (Date serializes via toJSON()).
 *
 * Canonical correlation fields travel in `correlationContext`.
 * User-defined metadata is inherited from the span/trace receiving feedback.
 */
export interface ExportedFeedback {
  /** When the feedback was recorded */
  timestamp: Date;

  /** Trace receiving feedback */
  traceId: string;

  /** Specific span receiving feedback (undefined = trace-level feedback) */
  spanId?: string;

  /** Source of the feedback */
  source: string;

  /** Type of feedback */
  feedbackType: string;

  /** Feedback value */
  value: number | string;

  /** User who provided the feedback */
  feedbackUserId?: string;

  /** Optional comment */
  comment?: string;

  /** Optional source record identifier this feedback is linked to */
  sourceId?: string;

  /**
   * @deprecated Use `correlationContext.experimentId` instead.
   */
  experimentId?: string;

  /** Context for correlation to traces */
  correlationContext?: CorrelationContext;

  /**
   * User-defined metadata.
   * Inherited from the span/trace receiving feedback, merged with feedback-specific metadata.
   */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// FeedbackEvent (Event Bus Event)
// ============================================================================

/** Feedback event emitted to the ObservabilityBus */
export interface FeedbackEvent {
  type: 'feedback';
  feedback: ExportedFeedback;
}
