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
  /**
   * @deprecated Use `feedbackSource` instead.
   * Source of the feedback (e.g., "user", "admin", "qa")
   */
  source?: string;

  /** Source of the feedback (e.g., "user", "admin", "qa") */
  feedbackSource?: string;

  /** Type of feedback (e.g., "thumbs", "rating", "correction") */
  feedbackType: string;

  /** Feedback value (e.g., "up"/"down", 1-5, correction text) */
  value: number | string;

  /** Optional comment explaining the feedback */
  comment?: string;

  /** Optional source record identifier this feedback is linked to */
  sourceId?: string;

  /**
   * @deprecated Use `feedbackUserId` instead.
   * User who provided the feedback
   */
  userId?: string;

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
 * Descriptive correlation metadata travels in `correlationContext`.
 * Signal identity stays on the top-level `traceId` / `spanId` fields.
 * User-defined metadata is inherited from the span/trace receiving feedback.
 */
export interface ExportedFeedback {
  /** Unique identifier for this feedback event, generated at emission time */
  feedbackId: string;

  /** When the feedback was recorded */
  timestamp: Date;

  /** Trace that anchors the feedback target when available */
  traceId?: string;

  /** Span anchor when the feedback is about a specific span */
  spanId?: string;

  /**
   * @deprecated Use `feedbackSource` instead.
   * Source of the feedback
   */
  source?: string;

  /** Source of the feedback */
  feedbackSource?: string;

  /** Type of feedback */
  feedbackType: string;

  /** Feedback value */
  value: number | string;

  /**
   * @deprecated Use `feedbackUserId` instead.
   * User who provided the feedback
   */
  userId?: string;

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
