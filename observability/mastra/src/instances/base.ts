/**
 * BaseObservability - Abstract base class for Observability implementations
 */

import { MastraBase } from '@mastra/core/base';
import type { RequestContext } from '@mastra/core/di';
import type { IMastraLogger } from '@mastra/core/logger';
import { RegisteredLogger } from '@mastra/core/logger';
import { TracingEventType } from '@mastra/core/observability';
import type {
  Span,
  SpanType,
  ObservabilityExporter,
  ObservabilityBridge,
  SpanOutputProcessor,
  TracingEvent,
  AnySpan,
  EndSpanOptions,
  UpdateSpanOptions,
  StartSpanOptions,
  CreateSpanOptions,
  ObservabilityInstance,
  CustomSamplerOptions,
  ExportedSpan,
  AnyExportedSpan,
  TraceState,
  TracingOptions,
  TracingContext,
  LoggerContext,
  MetricsContext,
  LogLevel,
  ObservabilityEvent,
} from '@mastra/core/observability';
import { getNestedValue, setNestedValue } from '@mastra/core/utils';
import { ObservabilityBus } from '../bus';
import type { ObservabilityInstanceConfig } from '../config';
import { SamplingStrategyType } from '../config';
import { LoggerContextImpl } from '../context/logger';
import { MetricsContextImpl } from '../context/metrics';
import { CardinalityFilter } from '../metrics/cardinality';
import { NoOpSpan } from '../spans';

// ============================================================================
// Abstract Base Class
// ============================================================================

/**
 * Abstract base class for all Observability implementations in Mastra.
 */
export abstract class BaseObservabilityInstance extends MastraBase implements ObservabilityInstance {
  protected config: ObservabilityInstanceConfig;

  /**
   * Unified event bus for all observability signals.
   * Routes events to registered exporters based on event type.
   */
  protected observabilityBus: ObservabilityBus;

  /**
   * Cardinality filter for metrics label protection.
   */
  protected cardinalityFilter: CardinalityFilter;

  constructor(config: ObservabilityInstanceConfig) {
    super({ component: RegisteredLogger.OBSERVABILITY, name: config.serviceName });

    // Apply defaults for optional fields
    this.config = {
      serviceName: config.serviceName,
      name: config.name,
      sampling: config.sampling ?? { type: SamplingStrategyType.ALWAYS },
      exporters: config.exporters ?? [],
      spanOutputProcessors: config.spanOutputProcessors ?? [],
      bridge: config.bridge ?? undefined,
      includeInternalSpans: config.includeInternalSpans ?? false,
      requestContextKeys: config.requestContextKeys ?? [],
      serializationOptions: config.serializationOptions,
    };

    // Initialize cardinality filter for metrics
    this.cardinalityFilter = new CardinalityFilter();

    // Initialize the unified ObservabilityBus and register all exporters
    this.observabilityBus = new ObservabilityBus();
    for (const exporter of this.exporters) {
      this.observabilityBus.registerExporter(exporter);
    }

    // Enable auto-extracted metrics (TracingEvent → MetricEvent cross-emission)
    this.observabilityBus.enableAutoExtractedMetrics();

    // Initialize bridge if present
    if (this.config.bridge?.init) {
      this.config.bridge.init({ config: this.config });
    }
  }

  /**
   * Override setLogger to add Observability specific initialization log
   * and propagate logger to exporters and bridge
   */
  __setLogger(logger: IMastraLogger) {
    super.__setLogger(logger);

    // Propagate logger to all exporters that support it
    this.exporters.forEach(exporter => {
      if (typeof exporter.__setLogger === 'function') {
        exporter.__setLogger(logger);
      }
    });

    // Propagate logger to bridge if present
    if (this.config.bridge?.__setLogger) {
      this.config.bridge.__setLogger(logger);
    }

    // Log Observability initialization details after logger is properly set
    this.logger.debug(
      `[Observability] Initialized [service=${this.config.serviceName}] [instance=${this.config.name}] [sampling=${this.config.sampling?.type}] [bridge=${!!this.config.bridge}]`,
    );
  }

  // ============================================================================
  // Protected getters for clean config access
  // ============================================================================

  protected get exporters(): ObservabilityExporter[] {
    return this.config.exporters || [];
  }

  protected get spanOutputProcessors(): SpanOutputProcessor[] {
    return this.config.spanOutputProcessors || [];
  }

  // ============================================================================
  // Public API - Single type-safe span creation method
  // ============================================================================

  /**
   * Start a new span of a specific SpanType
   *
   * Sampling Decision:
   * - For root spans (no parent): Perform sampling check using the configured strategy
   * - For child spans: Inherit the sampling decision from the parent
   *   - If parent is a NoOpSpan (not sampled), child is also a NoOpSpan
   *   - If parent is a valid span (sampled), child is also sampled
   *
   * This ensures trace-level sampling: either all spans in a trace are sampled or none are.
   * See: https://github.com/mastra-ai/mastra/issues/11504
   */
  startSpan<TType extends SpanType>(options: StartSpanOptions<TType>): Span<TType> {
    const { customSamplerOptions, requestContext, metadata, tracingOptions, ...rest } = options;

    // Determine sampling: inherit from parent or make new decision for root spans
    if (options.parent) {
      // Child span: inherit sampling decision from parent
      // If parent is a NoOpSpan (not sampled), child should also be a NoOpSpan
      if (!options.parent.isValid) {
        return new NoOpSpan<TType>({ ...rest, metadata }, this);
      }
      // Parent is valid (sampled), so child will also be sampled - continue to create actual span
    } else {
      // Root span: perform sampling check
      if (!this.shouldSample(customSamplerOptions)) {
        return new NoOpSpan<TType>({ ...rest, metadata }, this);
      }
    }

    // Compute or inherit TraceState
    let traceState: TraceState | undefined;

    if (options.parent) {
      // Child span: inherit from parent
      traceState = options.parent.traceState;
    } else {
      // Root span: compute new TraceState
      traceState = this.computeTraceState(tracingOptions);
    }

    // Merge tracingOptions.metadata with span metadata (tracingOptions.metadata takes precedence for root spans)
    const tracingMetadata = !options.parent ? tracingOptions?.metadata : undefined;
    const mergedMetadata = metadata || tracingMetadata ? { ...metadata, ...tracingMetadata } : undefined;

    // Extract metadata from RequestContext
    const enrichedMetadata = this.extractMetadataFromRequestContext(requestContext, mergedMetadata, traceState);

    // Tags are only passed for root spans (no parent)
    const tags = !options.parent ? tracingOptions?.tags : undefined;

    // Extract traceId and parentSpanId from tracingOptions for root spans (no parent)
    // These allow nested workflows to join the parent workflow's trace
    const traceId = !options.parent ? (options.traceId ?? tracingOptions?.traceId) : options.traceId;
    const parentSpanId = !options.parent
      ? (options.parentSpanId ?? tracingOptions?.parentSpanId)
      : options.parentSpanId;

    const span = this.createSpan<TType>({
      ...rest,
      traceId,
      parentSpanId,
      metadata: enrichedMetadata,
      traceState,
      tags,
    });

    if (span.isEvent) {
      this.emitSpanEnded(span);
    } else {
      // Automatically wire up tracing lifecycle
      this.wireSpanLifecycle(span);

      // Emit span started event
      this.emitSpanStarted(span);
    }

    return span;
  }

  /**
   * Rebuild a span from exported data for lifecycle operations.
   * Used by durable execution engines (e.g., Inngest) to end/update spans
   * that were created in a previous durable operation.
   *
   * The rebuilt span:
   * - Does NOT emit SPAN_STARTED (assumes original span already did)
   * - Can have end(), update(), error() called on it
   * - Will emit SPAN_ENDED or SPAN_UPDATED when those methods are called
   *
   * @param cached - The exported span data to rebuild from
   * @returns A span that can have lifecycle methods called on it
   */
  rebuildSpan<TType extends SpanType>(cached: ExportedSpan<TType>): Span<TType> {
    // Create span with existing IDs from cached data
    const span = this.createSpan<TType>({
      name: cached.name,
      type: cached.type,
      traceId: cached.traceId,
      spanId: cached.id,
      parentSpanId: cached.parentSpanId,
      startTime: cached.startTime instanceof Date ? cached.startTime : new Date(cached.startTime),
      input: cached.input,
      attributes: cached.attributes,
      metadata: cached.metadata,
      entityType: cached.entityType,
      entityId: cached.entityId,
      entityName: cached.entityName,
    });

    // Wire up lifecycle events (but skip SPAN_STARTED since it was already emitted)
    this.wireSpanLifecycle(span);

    return span;
  }

  // ============================================================================
  // Abstract Methods - Must be implemented by concrete classes
  // ============================================================================

  /**
   * Create a new span (called after sampling)
   *
   * Implementations should:
   * 1. Create a plain span with the provided attributes
   * 2. Return the span - base class handles all tracing lifecycle automatically
   *
   * The base class will automatically:
   * - Set trace relationships
   * - Wire span lifecycle callbacks
   * - Emit span_started event
   */
  protected abstract createSpan<TType extends SpanType>(options: CreateSpanOptions<TType>): Span<TType>;

  // ============================================================================
  // Configuration Management
  // ============================================================================

  /**
   * Get current configuration
   */
  getConfig(): Readonly<ObservabilityInstanceConfig> {
    return { ...this.config };
  }

  // ============================================================================
  // Plugin Access
  // ============================================================================

  /**
   * Get all exporters
   */
  getExporters(): readonly ObservabilityExporter[] {
    return [...this.exporters];
  }

  /**
   * Get all span output processors
   */
  getSpanOutputProcessors(): readonly SpanOutputProcessor[] {
    return [...this.spanOutputProcessors];
  }

  /**
   * Get the bridge instance if configured
   */
  getBridge(): ObservabilityBridge | undefined {
    return this.config.bridge;
  }

  /**
   * Get the logger instance (for exporters and other components)
   */
  getLogger() {
    return this.logger;
  }

  /**
   * Get the ObservabilityBus for this instance.
   * The bus routes all observability events (tracing, logs, metrics, scores, feedback)
   * to registered exporters based on event type.
   */
  getObservabilityBus(): ObservabilityBus {
    return this.observabilityBus;
  }

  // ============================================================================
  // Context-factory bridge methods
  // ============================================================================

  /**
   * Get a LoggerContext correlated to a span.
   * Called by the context-factory in core (deriveLoggerContext) so that
   * `observabilityContext.loggerVNext` is a real logger instead of no-op.
   */
  getLoggerContext(span?: AnySpan): LoggerContext {
    return new LoggerContextImpl({
      currentSpan: span,
      observabilityBus: this.observabilityBus,
    });
  }

  /**
   * Get a MetricsContext, optionally tagged from a span's entity info.
   * Called by the context-factory in core (deriveMetricsContext) so that
   * `observabilityContext.metrics` is a real metrics context instead of no-op.
   */
  getMetricsContext(span?: AnySpan): MetricsContext {
    const baseLabels: Record<string, string> = {};
    if (span?.entityType) baseLabels.entity_type = span.entityType;
    if (span?.entityName) baseLabels.entity_name = span.entityName;

    const context: Record<string, unknown> = {};
    if (this.config.serviceName) context.serviceName = this.config.serviceName;

    return new MetricsContextImpl({
      baseLabels,
      observabilityBus: this.observabilityBus,
      cardinalityFilter: this.cardinalityFilter,
      context,
    });
  }

  // ============================================================================
  // Direct context creation methods
  // ============================================================================

  /**
   * Create a LoggerContext for a given TracingContext.
   * Logs emitted through this context are automatically correlated with
   * the current span's traceId, spanId, tags, and metadata.
   */
  createLoggerContext(tracingContext: TracingContext, minLevel?: LogLevel): LoggerContext {
    return new LoggerContextImpl({
      currentSpan: tracingContext.currentSpan,
      observabilityBus: this.observabilityBus,
      minLevel,
    });
  }

  /**
   * Create a LoggerContext without trace correlation.
   * Use for logging outside of any span/trace context (e.g., startup, background tasks).
   */
  createDirectLoggerContext(minLevel?: LogLevel): LoggerContext {
    return new LoggerContextImpl({
      currentSpan: undefined,
      observabilityBus: this.observabilityBus,
      minLevel,
    });
  }

  /**
   * Create a MetricsContext with optional entity labels.
   * Metrics emitted through this context are filtered by the cardinality filter
   * and include base labels for the entity.
   */
  createMetricsContext(entityContext?: { entityType?: string; entityName?: string }): MetricsContext {
    const baseLabels: Record<string, string> = {};
    if (entityContext?.entityType) baseLabels.entity_type = entityContext.entityType;
    if (entityContext?.entityName) baseLabels.entity_name = entityContext.entityName;

    const context: Record<string, unknown> = {};
    if (this.config.serviceName) context.serviceName = this.config.serviceName;

    return new MetricsContextImpl({
      baseLabels,
      observabilityBus: this.observabilityBus,
      cardinalityFilter: this.cardinalityFilter,
      context,
    });
  }

  /**
   * Create a MetricsContext without entity labels.
   * Use for emitting metrics outside of any entity context (e.g., custom application metrics).
   */
  createDirectMetricsContext(): MetricsContext {
    const context: Record<string, unknown> = {};
    if (this.config.serviceName) context.serviceName = this.config.serviceName;

    return new MetricsContextImpl({
      baseLabels: {},
      observabilityBus: this.observabilityBus,
      cardinalityFilter: this.cardinalityFilter,
      context,
    });
  }

  /**
   * Emit any observability event through the bus.
   * The bus routes the event to the appropriate handler on each registered exporter,
   * and for tracing events triggers auto-extracted metrics.
   */
  protected emitObservabilityEvent(event: ObservabilityEvent): void {
    this.observabilityBus.emit(event);
  }

  // ============================================================================
  // Span Lifecycle Management
  // ============================================================================

  /**
   * Automatically wires up Observability lifecycle events for any span
   * This ensures all spans emit events regardless of implementation
   */
  private wireSpanLifecycle<TType extends SpanType>(span: Span<TType>): void {
    // bypass wire up if internal span and not includeInternalSpans
    if (!this.config.includeInternalSpans && span.isInternal) {
      return;
    }

    // Store original methods
    const originalEnd = span.end.bind(span);
    const originalUpdate = span.update.bind(span);

    // Wrap methods to automatically emit tracing events
    span.end = (options?: EndSpanOptions<TType>) => {
      if (span.isEvent) {
        this.logger.warn(`End event is not available on event spans`);
        return;
      }
      originalEnd(options);
      this.emitSpanEnded(span);
    };

    span.update = (options: UpdateSpanOptions<TType>) => {
      if (span.isEvent) {
        this.logger.warn(`Update() is not available on event spans`);
        return;
      }
      originalUpdate(options);
      this.emitSpanUpdated(span);
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Check if a trace should be sampled
   */
  protected shouldSample(options?: CustomSamplerOptions): boolean {
    // Check built-in sampling strategy
    const { sampling } = this.config;

    switch (sampling?.type) {
      case undefined:
        return true;
      case SamplingStrategyType.ALWAYS:
        return true;
      case SamplingStrategyType.NEVER:
        return false;
      case SamplingStrategyType.RATIO:
        if (sampling.probability === undefined || sampling.probability < 0 || sampling.probability > 1) {
          this.logger.warn(
            `Invalid sampling probability: ${sampling.probability}. Expected value between 0 and 1. Defaulting to no sampling.`,
          );
          return false;
        }
        return Math.random() < sampling.probability;
      case SamplingStrategyType.CUSTOM:
        return sampling.sampler(options);
      default:
        throw new Error(`Sampling strategy type not implemented: ${(sampling as any).type}`);
    }
  }

  /**
   * Compute TraceState for a new trace based on configured and per-request keys
   */
  protected computeTraceState(tracingOptions?: TracingOptions): TraceState | undefined {
    const configuredKeys = this.config.requestContextKeys ?? [];
    const additionalKeys = tracingOptions?.requestContextKeys ?? [];

    // Merge: configured + additional
    const allKeys = [...configuredKeys, ...additionalKeys];

    const hideInput = tracingOptions?.hideInput;
    const hideOutput = tracingOptions?.hideOutput;

    // Return undefined if no TraceState properties are needed
    if (allKeys.length === 0 && !hideInput && !hideOutput) {
      return undefined;
    }

    return {
      requestContextKeys: allKeys,
      ...(hideInput !== undefined && { hideInput }),
      ...(hideOutput !== undefined && { hideOutput }),
    };
  }

  /**
   * Extract metadata from RequestContext using TraceState
   */
  protected extractMetadataFromRequestContext(
    requestContext: RequestContext | undefined,
    explicitMetadata: Record<string, any> | undefined,
    traceState: TraceState | undefined,
  ): Record<string, any> | undefined {
    if (!requestContext || !traceState || traceState.requestContextKeys.length === 0) {
      return explicitMetadata;
    }

    const extracted = this.extractKeys(requestContext, traceState.requestContextKeys);

    // Only return an object if we have extracted or explicit metadata
    if (Object.keys(extracted).length === 0 && !explicitMetadata) {
      return undefined;
    }

    return {
      ...extracted,
      ...explicitMetadata, // Explicit metadata always wins
    };
  }

  /**
   * Extract specific keys from RequestContext
   */
  protected extractKeys(requestContext: RequestContext, keys: string[]): Record<string, any> {
    const result: Record<string, any> = {};

    for (const key of keys) {
      // Handle dot notation: get first part from RequestContext, then navigate nested properties
      const parts = key.split('.');
      const rootKey = parts[0]!; // parts[0] always exists since key is a non-empty string
      const value = requestContext.get(rootKey);

      if (value !== undefined) {
        // If there are nested parts, extract them from the value
        if (parts.length > 1) {
          const nestedPath = parts.slice(1).join('.');
          const nestedValue = getNestedValue(value, nestedPath);
          if (nestedValue !== undefined) {
            setNestedValue(result, key, nestedValue);
          }
        } else {
          // Simple key, set directly
          setNestedValue(result, key, value);
        }
      }
    }

    return result;
  }

  /**
   * Process a span through all output processors
   */
  private processSpan(span?: AnySpan): AnySpan | undefined {
    for (const processor of this.spanOutputProcessors) {
      if (!span) {
        break;
      }

      try {
        span = processor.process(span);
      } catch (error) {
        this.logger.error(`[Observability] Processor error [name=${processor.name}]`, error);
        // Continue with other processors
      }
    }

    return span;
  }

  // ============================================================================
  // Event-driven Export Methods
  // ============================================================================

  getSpanForExport(span: AnySpan): AnyExportedSpan | undefined {
    if (!span.isValid) return undefined;
    if (span.isInternal && !this.config.includeInternalSpans) return undefined;

    const processedSpan = this.processSpan(span);
    return processedSpan?.exportSpan(this.config.includeInternalSpans);
  }

  /**
   * Emit a span started event.
   * Routes through the ObservabilityBus so exporters receive it via onTracingEvent
   * and auto-extracted metrics are generated.
   */
  protected emitSpanStarted(span: AnySpan): void {
    const exportedSpan = this.getSpanForExport(span);
    if (exportedSpan) {
      const event: TracingEvent = { type: TracingEventType.SPAN_STARTED, exportedSpan };
      this.emitTracingEvent(event);
    }
  }

  /**
   * Emit a span ended event (called automatically when spans end).
   * Routes through the ObservabilityBus so exporters receive it via onTracingEvent
   * and auto-extracted metrics are generated.
   */
  protected emitSpanEnded(span: AnySpan): void {
    const exportedSpan = this.getSpanForExport(span);
    if (exportedSpan) {
      const event: TracingEvent = { type: TracingEventType.SPAN_ENDED, exportedSpan };
      this.emitTracingEvent(event);
    }
  }

  /**
   * Emit a span updated event.
   * Routes through the ObservabilityBus so exporters receive it via onTracingEvent
   * and auto-extracted metrics are generated.
   */
  protected emitSpanUpdated(span: AnySpan): void {
    const exportedSpan = this.getSpanForExport(span);
    if (exportedSpan) {
      const event: TracingEvent = { type: TracingEventType.SPAN_UPDATED, exportedSpan };
      this.emitTracingEvent(event);
    }
  }

  /**
   * Emit a tracing event through the bus and bridge.
   *
   * The bus routes the event to each registered exporter's onTracingEvent handler
   * and triggers auto-extracted metrics (e.g., mastra_agent_runs_started,
   * mastra_model_duration_ms). The bridge receives the event directly via
   * exportTracingEvent since it is not registered on the bus.
   */
  private emitTracingEvent(event: TracingEvent): void {
    // Route through the bus for exporter delivery + auto-extracted metrics
    this.observabilityBus.emit(event);

    // Export to bridge directly (bridge is not registered on the bus)
    if (this.config.bridge) {
      this.config.bridge.exportTracingEvent(event).catch(error => {
        this.logger.error(`[Observability] Bridge export error [bridge=${this.config.bridge!.name}]`, error);
      });
    }
  }

  /**
   * Export tracing event through all exporters and bridge.
   *
   * @deprecated Prefer emitTracingEvent() which routes through the bus.
   * Kept for backward compatibility with subclasses that may override it.
   */
  protected async exportTracingEvent(event: TracingEvent): Promise<void> {
    // Collect all export targets
    const targets: Array<{ name: string; exportTracingEvent: (event: TracingEvent) => Promise<void> }> = [
      ...this.exporters,
    ];

    // Add bridge if present
    if (this.config.bridge) {
      targets.push(this.config.bridge);
    }

    // Export to all targets
    const exportPromises = targets.map(async target => {
      try {
        await target.exportTracingEvent(event);
        this.logger.debug(`[Observability] Event exported [target=${target.name}] [type=${event.type}]`);
      } catch (error) {
        this.logger.error(`[Observability] Export error [target=${target.name}]`, error);
        // Don't rethrow - continue with other targets
      }
    });

    await Promise.allSettled(exportPromises);
  }

  // ============================================================================
  // Lifecycle Management
  // ============================================================================

  /**
   * Initialize Observability (called by Mastra during component registration)
   */
  init(): void {
    this.logger.debug(`[Observability] Initialization started [name=${this.name}]`);

    // Any initialization logic for the Observability system
    // This could include setting up queues, starting background processes, etc.

    this.logger.info(`[Observability] Initialized successfully [name=${this.name}]`);
  }

  /**
   * Force flush any buffered/queued spans from all exporters and the bridge
   * without shutting down the observability instance.
   *
   * This is useful in serverless environments (like Vercel's fluid compute) where
   * you need to ensure all spans are exported before the runtime instance is
   * terminated, while keeping the observability system active for future requests.
   */
  async flush(): Promise<void> {
    this.logger.debug(`[Observability] Flush started [name=${this.name}]`);

    // Flush the ObservabilityBus (no-op today, but keeps the interface contract)
    const flushPromises: Promise<void>[] = [this.observabilityBus.flush()];

    // Flush all exporters and bridge
    flushPromises.push(...this.exporters.map(e => e.flush()));

    // Add bridge flush if present
    if (this.config.bridge) {
      flushPromises.push(this.config.bridge.flush());
    }

    const results = await Promise.allSettled(flushPromises);

    // Log any errors but don't throw
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const targetName =
          index === 0
            ? 'observability-bus'
            : index <= this.exporters.length
              ? this.exporters[index - 1]?.name
              : 'bridge';
        this.logger.error(`[Observability] Flush error [target=${targetName}]`, result.reason);
      }
    });

    this.logger.debug(`[Observability] Flush completed [name=${this.name}]`);
  }

  /**
   * Shutdown Observability and clean up resources
   */
  async shutdown(): Promise<void> {
    this.logger.debug(`[Observability] Shutdown started [name=${this.name}]`);

    // Shutdown the ObservabilityBus first (flushes remaining events, clears subscribers)
    const shutdownPromises: Promise<void>[] = [this.observabilityBus.shutdown()];

    // Shutdown all components including bridge
    shutdownPromises.push(...this.exporters.map(e => e.shutdown()));
    shutdownPromises.push(...this.spanOutputProcessors.map(p => p.shutdown()));

    // Add bridge shutdown if present
    if (this.config.bridge) {
      shutdownPromises.push(this.config.bridge.shutdown());
    }

    await Promise.allSettled(shutdownPromises);

    this.logger.info(`[Observability] Shutdown completed [name=${this.name}]`);
  }
}
