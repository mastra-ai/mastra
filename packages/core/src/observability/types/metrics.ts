// ============================================================================
// Metric Type
// ============================================================================

/** Types of metrics */
export type MetricType = 'counter' | 'gauge' | 'histogram';

// ============================================================================
// MetricsContext (API Interface)
// ============================================================================

/**
 * MetricsContext - API for emitting metrics.
 * Provides counter, gauge, and histogram metric types.
 */
export interface MetricsContext {
  counter(name: string): Counter;
  gauge(name: string): Gauge;
  histogram(name: string): Histogram;
}

export interface Counter {
  add(value: number, additionalLabels?: Record<string, string>): void;
}

export interface Gauge {
  set(value: number, additionalLabels?: Record<string, string>): void;
}

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

  /** Type of metric */
  metricType: MetricType;

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
   * Labels to block from metrics.
   * Set to undefined to use DEFAULT_BLOCKED_LABELS.
   * Set to empty array to allow all labels.
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
