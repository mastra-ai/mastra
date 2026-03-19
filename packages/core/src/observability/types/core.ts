/**
 * Top-level observability infrastructure types.
 *
 * This file contains the core observability interfaces for managing instances,
 * exporters, bridges, configuration, event bus, and the context mixin.
 *
 * For tracing-specific types (spans, span types, attributes, etc.), see tracing.ts.
 */
import type { IMastraLogger } from '../../logger';
import type { Mastra } from '../../mastra';
import type { RequestContext } from '../../request-context';
import type { FeedbackEvent } from './feedback';
import type { LoggerContext, LogEvent } from './logging';
import type { MetricsContext, MetricEvent } from './metrics';
import type { ScoreEvent } from './scores';
import type {
  AnySpan,
  CreateSpanOptions,
  ExportedSpan,
  Span,
  SpanIds,
  SpanOutputProcessor,
  SpanType,
  StartSpanOptions,
  TracingContext,
  TracingEvent,
} from './tracing';

// ============================================================================
// ObservabilityContext
// ============================================================================

/**
 * Mixin interface that provides unified observability access.
 * All execution contexts (tools, workflow steps, processors) extend this
 * to gain access to tracing, logging, and metrics.
 *
 * ## Naming conventions
 *
 * `tracingContext` is the **source** — it represents your position in the span tree.
 * Creating a child span produces a new `tracingContext` with that child as `currentSpan`.
 *
 * `loggerVNext` and `metrics` are **derived** — they are rebuilt from the current span so that
 * log entries and metric data points are automatically correlated to the active trace:
 *
 * ```
 * tracingContext → create child span → new tracingContext
 *                                    → new loggerVNext (correlated to child span)
 *                                    → new metrics     (tagged with child span metadata)
 * ```
 *
 * The short names (`tracing`, `loggerVNext`, `metrics`) read naturally at **usage sites**:
 * `tracing.createSpan()`, `loggerVNext.info()`, `metrics.record()`.
 *
 * `loggerVNext` uses the VNext suffix to distinguish from the existing `logger: IMastraLogger`
 * infrastructure logger used throughout the codebase (e.g. `MastraPrimitives.logger`).
 *
 * The `tracingContext` alias is preferred at **forwarding sites** where the "Context"
 * suffix clarifies that a structural context object is being passed, not a subsystem.
 */
export interface ObservabilityContext {
  /** Tracing context for span creation and tree navigation. */
  tracing: TracingContext;

  /** Logger derived from the current span — log entries are trace-correlated. Uses VNext suffix to avoid conflict with IMastraLogger. */
  loggerVNext: LoggerContext;

  /** Metrics derived from the current span — data points are span-tagged. */
  metrics: MetricsContext;

  /**
   * Alias for `tracing`. Preferred at forwarding sites where the "Context" suffix
   * clarifies that a structural context object is being passed between functions.
   */
  tracingContext: TracingContext;
}

// ============================================================================
// ObservabilityEventBus
// ============================================================================

/**
 * Generic event bus interface for observability events.
 * Implementations handle buffering, batching, and delivery to exporters.
 */
export interface ObservabilityEventBus<TEvent> {
  /** Emit an event to the bus */
  emit(event: TEvent): void;

  /** Subscribe to events. Returns unsubscribe function. */
  subscribe(handler: (event: TEvent) => void): () => void;

  /** Flush any buffered events */
  flush(): Promise<void>;

  /** Shutdown the bus and release resources */
  shutdown(): Promise<void>;
}

/**
 * Union of all observability event types.
 * Used by the unified ObservabilityBus that handles all signals.
 */
export type ObservabilityEvent = TracingEvent | LogEvent | MetricEvent | ScoreEvent | FeedbackEvent;

// ============================================================================
// ObservabilityInstance
// ============================================================================

/**
 * Primary interface for Observability
 */
export interface ObservabilityInstance {
  /**
   * Get current configuration
   */
  getConfig(): Readonly<ObservabilityInstanceConfig>;

  /**
   * Get all exporters
   */
  getExporters(): readonly ObservabilityExporter[];

  /**
   * Get all span output processors
   */
  getSpanOutputProcessors(): readonly SpanOutputProcessor[];

  /**
   * Get the logger instance (for exporters and other components)
   */
  getLogger(): IMastraLogger;

  /**
   * Get the bridge instance if configured
   */
  getBridge(): ObservabilityBridge | undefined;

  /**
   * Start a new span of a specific SpanType
   */
  startSpan<TType extends SpanType>(options: StartSpanOptions<TType>): Span<TType>;

  /**
   * Rebuild a span from exported data for lifecycle operations.
   * Used by durable execution engines (e.g., Inngest) to end/update spans
   * that were created in a previous durable operation.
   *
   * @param cached - The exported span data to rebuild from
   * @returns A span that can have end()/update()/error() called on it
   */
  rebuildSpan<TType extends SpanType>(cached: ExportedSpan<TType>): Span<TType>;

  /**
   * Force flush any buffered/queued spans from all exporters and the bridge
   * without shutting down the observability instance.
   *
   * This is useful in serverless environments (like Vercel's fluid compute) where
   * you need to ensure all spans are exported before the runtime instance is
   * terminated, while keeping the observability system active for future requests.
   *
   * Unlike shutdown(), flush() does not release resources or prevent future tracing.
   */
  flush(): Promise<void>;

  /**
   * Shutdown tracing and clean up resources
   */
  shutdown(): Promise<void>;

  /**
   * Override setLogger to add tracing specific initialization log
   */
  __setLogger(logger: IMastraLogger): void;

  /**
   * Get a LoggerContext for this instance, optionally correlated to a span.
   * When a span is provided, the returned logger automatically includes
   * the span's traceId, spanId, and other metadata in every log entry.
   * Returns no-op context when logging is not configured on this instance.
   *
   * @param span - Optional span to correlate logs with
   */
  getLoggerContext?(span?: AnySpan): LoggerContext;

  /**
   * Get a MetricsContext for this instance, optionally tagged from a span.
   * When a span is provided, the returned metrics context automatically
   * includes the span's metadata as labels/tags on emitted data points.
   * Returns no-op context when metrics are not configured on this instance.
   *
   * @param span - Optional span to derive metric tags from
   */
  getMetricsContext?(span?: AnySpan): MetricsContext;
}

// ============================================================================
// ObservabilityEntrypoint
// ============================================================================

export interface ObservabilityEntrypoint {
  shutdown(): Promise<void>;

  setMastraContext(options: { mastra: Mastra }): void;

  setLogger(options: { logger: IMastraLogger }): void;

  getSelectedInstance(options: ConfigSelectorOptions): ObservabilityInstance | undefined;

  // Registry management methods
  registerInstance(name: string, instance: ObservabilityInstance, isDefault?: boolean): void;
  getInstance(name: string): ObservabilityInstance | undefined;
  getDefaultInstance(): ObservabilityInstance | undefined;
  listInstances(): ReadonlyMap<string, ObservabilityInstance>;
  unregisterInstance(name: string): boolean;
  hasInstance(name: string): boolean;
  setConfigSelector(selector: ConfigSelector): void;
  clear(): void;
}

// ============================================================================
// Sampling Strategy
// ============================================================================

/**
 * Sampling strategy types
 */
export enum SamplingStrategyType {
  ALWAYS = 'always',
  NEVER = 'never',
  RATIO = 'ratio',
  CUSTOM = 'custom',
}

/**
 * Sampling strategy configuration
 */
export type SamplingStrategy =
  | { type: SamplingStrategyType.ALWAYS }
  | { type: SamplingStrategyType.NEVER }
  | { type: SamplingStrategyType.RATIO; probability: number }
  | { type: SamplingStrategyType.CUSTOM; sampler: (options?: CustomSamplerOptions) => boolean };

/**
 * Options passed when using a custom sampler strategy
 */
export interface CustomSamplerOptions {
  requestContext?: RequestContext;
  metadata?: Record<string, any>;
}

// ============================================================================
// Serialization Options
// ============================================================================

/**
 * Options for controlling serialization of span data.
 * These options control how input, output, and attributes are cleaned before export.
 */
export interface SerializationOptions {
  /**
   * Maximum length for string values
   * @default 1024
   */
  maxStringLength?: number;
  /**
   * Maximum depth for nested objects
   * @default 6
   */
  maxDepth?: number;
  /**
   * Maximum number of items in arrays
   * @default 50
   */
  maxArrayLength?: number;
  /**
   * Maximum number of keys in objects
   * @default 50
   */
  maxObjectKeys?: number;
}

// ============================================================================
// Registry Config
// ============================================================================

/**
 * Configuration for a single observability instance
 */
export interface ObservabilityInstanceConfig {
  /** Unique identifier for this config in the observability registry */
  name: string;
  /** Service name for observability */
  serviceName: string;
  /** Sampling strategy - controls whether tracing is collected (defaults to ALWAYS) */
  sampling?: SamplingStrategy;
  /** Custom exporters */
  exporters?: ObservabilityExporter[];
  /** Custom processors */
  spanOutputProcessors?: SpanOutputProcessor[];
  /** OpenTelemetry bridge for integration with existing OTEL infrastructure */
  bridge?: ObservabilityBridge;
  /** Set to `true` if you want to see spans internal to the operation of mastra */
  includeInternalSpans?: boolean;
  /**
   * RequestContext keys to automatically extract as metadata for all spans
   * created with this observability configuration.
   * Supports dot notation for nested values.
   */
  requestContextKeys?: string[];
  /**
   * Options for controlling serialization of span data (input/output/attributes).
   * Use these to customize truncation limits for large payloads.
   */
  serializationOptions?: SerializationOptions;
}

/**
 * Complete Observability registry configuration
 */
export interface ObservabilityRegistryConfig {
  /** Enables default exporters, with sampling: always, and sensitive data filtering */
  default?: {
    enabled?: boolean;
  };
  /** Map of tracing instance names to their configurations or pre-instantiated instances */
  configs?: Record<string, Omit<ObservabilityInstanceConfig, 'name'> | ObservabilityInstance>;
  /** Optional selector function to choose which tracing instance to use */
  configSelector?: ConfigSelector;
}

// ============================================================================
// Config Selector
// ============================================================================

/**
 *  Options passed when using a custom tracing config selector
 */
export interface ConfigSelectorOptions {
  /** Request Context */
  requestContext?: RequestContext;
}

/**
 * Function to select which tracing instance to use for a given span
 * Returns the name of the tracing instance, or undefined to use default
 */
export type ConfigSelector = (
  options: ConfigSelectorOptions,
  availableConfigs: ReadonlyMap<string, ObservabilityInstance>,
) => string | undefined;

// ============================================================================
// Exporter and Bridge Interfaces
// ============================================================================

export interface InitExporterOptions {
  mastra?: Mastra;
  config?: ObservabilityInstanceConfig;
}

export interface InitBridgeOptions {
  mastra?: Mastra;
  config?: ObservabilityInstanceConfig;
}

/**
 * Shared Observability event interface for Exporters & Bridges
 */
export interface ObservabilityEvents {
  /** Handle tracing events */
  onTracingEvent?(event: TracingEvent): void | Promise<void>;

  /** Handle log events */
  onLogEvent?(event: LogEvent): void | Promise<void>;

  /** Handle metric events */
  onMetricEvent?(event: MetricEvent): void | Promise<void>;

  /** Handle score events */
  onScoreEvent?(event: ScoreEvent): void | Promise<void>;

  /** Handle feedback events */
  onFeedbackEvent?(event: FeedbackEvent): void | Promise<void>;

  /** Export tracing events */
  exportTracingEvent(event: TracingEvent): Promise<void>;
}

/**
 * Interface for tracing exporters
 */
export interface ObservabilityExporter extends ObservabilityEvents {
  /** Exporter name */
  name: string;

  /** Initialize exporter with tracing configuration and/or access to Mastra */
  init?(options: InitExporterOptions): void;

  /** Sets logger instance on the exporter.  */
  __setLogger?(logger: IMastraLogger): void;

  addScoreToTrace?({
    traceId,
    spanId,
    score,
    reason,
    scorerName,
    metadata,
  }: {
    traceId: string;
    spanId?: string;
    score: number;
    reason?: string;
    scorerName: string;
    metadata?: Record<string, any>;
  }): Promise<void>;

  /**
   * Force flush any buffered/queued spans without shutting down the exporter.
   * This is useful in serverless environments where you need to ensure spans
   * are exported before the runtime instance is terminated, while keeping
   * the exporter active for future requests.
   *
   * Unlike shutdown(), flush() does not release resources or prevent future exports.
   */
  flush(): Promise<void>;

  /** Shutdown exporter */
  shutdown(): Promise<void>;
}

/**
 * Interface for observability bridges
 */
export interface ObservabilityBridge extends ObservabilityEvents {
  /** Bridge name */
  name: string;

  /** Initialize bridge with observability configuration and/or access to Mastra */
  init?(options: InitBridgeOptions): void;

  /** Sets logger instance on the bridge  */
  __setLogger?(logger: IMastraLogger): void;

  /**
   * Execute an async function within the tracing context of a Mastra span.
   * This enables auto-instrumented operations (HTTP, DB) to have correct parent spans
   * in the external tracing system (e.g., OpenTelemetry, DataDog, etc.).
   *
   * @param spanId - The ID of the Mastra span to use as context
   * @param fn - The async function to execute within the span context
   * @returns The result of the function execution
   */
  executeInContext?<T>(spanId: string, fn: () => Promise<T>): Promise<T>;

  /**
   * Execute a synchronous function within the tracing context of a Mastra span.
   * This enables auto-instrumented operations (HTTP, DB) to have correct parent spans
   * in the external tracing system (e.g., OpenTelemetry, DataDog, etc.).
   *
   * @param spanId - The ID of the Mastra span to use as context
   * @param fn - The synchronous function to execute within the span context
   * @returns The result of the function execution
   */
  executeInContextSync?<T>(spanId: string, fn: () => T): T;

  /**
   * Create a span in the bridge's tracing system.
   * Called during Mastra span construction to get bridge-generated identifiers.
   *
   * @param options - Span creation options from Mastra
   * @returns Span identifiers (spanId, traceId, parentSpanId) from bridge, or undefined if creation fails
   */
  createSpan(options: CreateSpanOptions<SpanType>): SpanIds | undefined;

  /**
   * Force flush any buffered/queued spans without shutting down the bridge.
   * This is useful in serverless environments where you need to ensure spans
   * are exported before the runtime instance is terminated, while keeping
   * the bridge active for future requests.
   *
   * Unlike shutdown(), flush() does not release resources or prevent future exports.
   */
  flush(): Promise<void>;

  /** Shutdown bridge and cleanup resources */
  shutdown(): Promise<void>;
}
