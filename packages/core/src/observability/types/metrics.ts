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
export interface MetricsContext {
  /** Emit a metric observation. */
  emit(name: string, value: number, labels?: Record<string, string>): void;

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
 * Metric data transported via the event bus.
 * Represents a single metric observation.
 * Must be JSON-serializable (Date serializes via toJSON()).
 *
 * Environment fields (organizationId, environment, serviceName) are stored
 * in metadata, following the same pattern as tracing spans.
 *
 * Note: Histogram aggregation (bucket counts, sum, count) is computed at
 * the storage layer, not in the individual metric event.
 */
export interface ExportedMetric {
  /** When the metric was recorded */
  timestamp: Date;

  /** Metric name (e.g., mastra_agent_duration_ms) */
  name: string;

  /** Metric value (single observation) */
  value: number;

  /** Metric labels for dimensional filtering */
  labels: Record<string, string>;

  /**
   * User-defined metadata.
   * Environment fields are stored here: organizationId, environment,
   * serviceName, etc. These are kept separate from labels to avoid
   * cardinality issues.
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
