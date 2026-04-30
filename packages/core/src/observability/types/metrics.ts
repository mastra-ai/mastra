import type { CorrelationContext } from './core';

// ============================================================================
// Metric Type
// ============================================================================

/**
 * @deprecated MetricType is no longer stored. All metrics are raw events
 * with aggregation determined at query time.
 */
export type MetricType = 'counter' | 'gauge' | 'histogram';

// ============================================================================
// MetricsContext (API Interface)
// ============================================================================

/**
 * MetricsContext - API for emitting metrics.
 * Use `emit()` to record a metric observation.
 */
export interface MetricEmitOptions {
  /** Canonical model/cost context for this specific metric row */
  costContext?: CostContext;
}

export interface MetricsContext {
  /** Emit a metric observation. */
  emit(name: string, value: number, labels?: Record<string, string>, options?: MetricEmitOptions): void;

  /** @deprecated Use `emit()` instead. */
  counter(name: string): Counter;
  /** @deprecated Use `emit()` instead. */
  gauge(name: string): Gauge;
  /** @deprecated Use `emit()` instead. */
  histogram(name: string): Histogram;
}

/** @deprecated Use MetricsContext.emit() instead. */
export interface Counter {
  add(value: number, additionalLabels?: Record<string, string>): void;
}

/** @deprecated Use MetricsContext.emit() instead. */
export interface Gauge {
  set(value: number, additionalLabels?: Record<string, string>): void;
}

/** @deprecated Use MetricsContext.emit() instead. */
export interface Histogram {
  record(value: number, additionalLabels?: Record<string, string>): void;
}

// ============================================================================
// ExportedMetric (Event Bus Transport)
// ============================================================================

/**
 * Typed context used for cost estimations.
 */
export interface CostContext {
  provider?: string;
  model?: string;
  estimatedCost?: number;
  costUnit?: string;
  costMetadata?: Record<string, unknown>;
}

/**
 * Metric data transported via the event bus.
 * Represents a single metric observation.
 * Must be JSON-serializable (Date serializes via toJSON()).
 *
 * Descriptive correlation metadata travels in `correlationContext`.
 * Signal identity stays on the top-level `traceId` / `spanId` fields.
 * pricing/model fields travel in `costContext`.
 */
export interface ExportedMetric {
  /** Unique identifier for this metric event, generated at emission time */
  metricId: string;

  /** When the metric was recorded */
  timestamp: Date;

  /** Trace associated with this metric (undefined = not tied to a trace) */
  traceId?: string;

  /** Specific span associated with this metric */
  spanId?: string;

  /** Metric name (e.g., mastra_agent_duration_ms) */
  name: string;

  /** Metric value (single observation) */
  value: number;

  /** Metric labels for dimensional filtering */
  labels: Record<string, string>;

  /** Context for correlation to traces */
  correlationContext?: CorrelationContext;

  /** Context for cost estimation */
  costContext?: CostContext;

  /**
   * User-defined metadata.
   * This is reserved for non-canonical metadata that does not belong
   * in record context or cost context.
   */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// MetricEvent (Event Bus Event)
// ============================================================================

/** Metric event emitted to the ObservabilityBus */
export interface MetricEvent {
  type: 'metric';
  metric: ExportedMetric;
}

// ============================================================================
// Cardinality Protection
// ============================================================================

/**
 * Default labels to block from metrics to prevent cardinality explosion.
 * These are high-cardinality fields that should not be used as metric labels.
 */
export const DEFAULT_BLOCKED_LABELS = [
  'trace_id',
  'span_id',
  'run_id',
  'request_id',
  'user_id',
  'resource_id',
  'session_id',
  'thread_id',
] as const;

/** Cardinality protection configuration */
export interface CardinalityConfig {
  /**
   * Labels to block from metrics. **Replaces** the default list entirely —
   * DEFAULT_BLOCKED_LABELS are NOT merged in when this is set.
   *
   * - `undefined` (default) → uses DEFAULT_BLOCKED_LABELS
   * - `[]` → disables label blocking (allows all labels through)
   * - `['x', 'y']` → blocks only x and y; defaults like trace_id are allowed
   *
   * To extend the defaults, spread them into your list:
   * ```ts
   * blockedLabels: [...DEFAULT_BLOCKED_LABELS, 'my_custom_label']
   * ```
   */
  blockedLabels?: string[];

  /**
   * Whether to block UUID-like values in labels.
   * @default true
   */
  blockUUIDs?: boolean;
}

/** Metrics-specific configuration */
export interface MetricsConfig {
  /** Whether metrics are enabled */
  enabled?: boolean;
  /** Cardinality protection settings */
  cardinality?: CardinalityConfig;
}
