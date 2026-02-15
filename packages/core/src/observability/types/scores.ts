// packages/core/src/observability/types/scores.ts

// ============================================================================
// ScoreInput (User Input)
// ============================================================================

/**
 * User-provided score data for evaluating span/trace quality.
 * Used with span.addScore() and trace.addScore().
 */
export interface ScoreInput {
  /** Name of the scorer (e.g., "relevance", "accuracy", "toxicity") */
  scorerName: string;

  /** Numeric score value (typically 0-1 or 0-100) */
  score: number;

  /** Human-readable explanation of the score */
  reason?: string;

  /** Experiment identifier for A/B testing or evaluation runs */
  experimentId?: string;

  /** Additional metadata specific to this score */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// ExportedScore (Event Bus Transport)
// ============================================================================

/**
 * Score data transported via the event bus.
 * Must be JSON-serializable (Date serializes via toJSON()).
 *
 * Context fields (organizationId, userId, environment, etc.) are stored
 * in metadata, following the same pattern as tracing spans. The metadata
 * is inherited from the span/trace being scored.
 */
export interface ExportedScore {
  /** When the score was recorded */
  timestamp: Date;

  /** Trace being scored */
  traceId: string;

  /** Specific span being scored (undefined = trace-level score) */
  spanId?: string;

  /** Name of the scorer */
  scorerName: string;

  /** Numeric score value */
  score: number;

  /** Human-readable explanation */
  reason?: string;

  /** Experiment identifier for A/B testing */
  experimentId?: string;

  /**
   * User-defined metadata.
   * Inherited from the span/trace being scored, merged with score-specific metadata.
   * Contains context fields: organizationId, userId, environment, serviceName,
   * entityType, entityName, etc.
   */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// ScoreEvent (Event Bus Event)
// ============================================================================

/** Score event emitted to the ObservabilityBus */
export interface ScoreEvent {
  type: 'score';
  score: ExportedScore;
}
