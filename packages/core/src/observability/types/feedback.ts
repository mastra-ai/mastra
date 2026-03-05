// packages/core/src/observability/types/feedback.ts

// ============================================================================
// FeedbackInput (User Input)
// ============================================================================

/**
 * User-provided feedback data for human evaluation of span/trace quality.
 * Used with span.addFeedback() and trace.addFeedback().
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

  /** User who provided the feedback */
  userId?: string;

  /** Experiment identifier for A/B testing or evaluation runs */
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
 * Context fields (organizationId, environment, etc.) are stored
 * in metadata, following the same pattern as tracing spans. The metadata
 * is inherited from the span/trace receiving feedback.
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

  /** Optional comment */
  comment?: string;

  /** Experiment identifier for A/B testing */
  experimentId?: string;

  /**
   * User-defined metadata.
   * Inherited from the span/trace receiving feedback, merged with feedback-specific metadata.
   * Contains context fields: organizationId, environment, serviceName,
   * entityType, entityName, etc. The userId from FeedbackInput is also stored here.
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
