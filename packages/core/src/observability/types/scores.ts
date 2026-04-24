// packages/core/src/observability/types/scores.ts
import type { CorrelationContext } from './core';
import type { EntityType } from './tracing';

// ============================================================================
// ScoreInput (User Input)
// ============================================================================

/**
 * User-provided score data for evaluating span/trace quality.
 * Used by evaluator/scorer flows to attach score data to a recorded span or trace.
 */
export interface ScoreInput {
  /** Identifier of the scorer (e.g., "relevance", "accuracy", "toxicity") */
  scorerId: string;

  /** Display name of the scorer */
  scorerName?: string;

  /** Version of the scorer */
  scorerVersion?: string;

  /**
   * @deprecated Use `scoreSource` instead.
   * How the score was produced (e.g., "manual", "automated", "experiment")
   */
  source?: string;

  /** How the score was produced (e.g., "manual", "automated", "experiment") */
  scoreSource?: string;

  /** Numeric score value (typically 0-1 or 0-100) */
  score: number;

  /** Human-readable explanation of the score */
  reason?: string;

  /**
   * @deprecated Derived from the target trace/span. Use `correlationContext.experimentId` on the exported event instead.
   */
  experimentId?: string;

  /** Trace ID of the scoring run itself (for debugging score generation) */
  scoreTraceId?: string;

  /** Entity type the scorer evaluated when known */
  targetEntityType?: EntityType;

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
 * Descriptive correlation metadata travels in `correlationContext`.
 * Signal identity stays on the top-level `traceId` / `spanId` fields.
 * User-defined metadata is inherited from the span/trace being scored.
 */
export interface ExportedScore {
  /** Unique identifier for this score event, generated at emission time */
  scoreId: string;

  /** When the score was recorded */
  timestamp: Date;

  /** Trace that anchors the scored target when available */
  traceId?: string;

  /** Span anchor when the score is about a specific span */
  spanId?: string;

  /** Identifier of the scorer */
  scorerId: string;

  /** Display name of the scorer */
  scorerName?: string;

  /** Version of the scorer */
  scorerVersion?: string;

  /**
   * @deprecated Use `scoreSource` instead.
   * How the score was produced
   */
  source?: string;

  /** How the score was produced */
  scoreSource?: string;

  /** Numeric score value */
  score: number;

  /** Human-readable explanation */
  reason?: string;

  /**
   * @deprecated Use `correlationContext.experimentId` instead.
   */
  experimentId?: string;

  /** Trace ID of the scoring run itself (for debugging score generation) */
  scoreTraceId?: string;

  /** Entity type the scorer evaluated when known */
  targetEntityType?: EntityType;

  /** Canonical correlation context for this score event */
  correlationContext?: CorrelationContext;

  /**
   * User-defined metadata.
   * Inherited from the span/trace being scored, merged with score-specific metadata.
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
