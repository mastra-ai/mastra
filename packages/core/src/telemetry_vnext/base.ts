/**
 * MastraTelemetry - Abstract base class for telemetry implementations
 * 
 * Follows Mastra's architectural patterns while providing a comprehensive
 * telemetry interface that addresses the limitations of the current system.
 */

import { MastraBase } from '../base';
import { RegisteredLogger } from '../logger/constants';
import { deepMerge } from '../utils';
import type {
  TelemetryConfig,
  SharedTelemetryConfig,
  Trace,
  AISpan,
  SpanOptions,
  TracingOptions,
  TelemetryExporter,
  SpanProcessor,
  TelemetrySampler,
  SpanType,
  SpanMetadata,
  TelemetrySupports,
  TelemetryEvent,
  EvaluationScore,
  HumanAnnotation,
  LLMAnnotation,
} from './types';

// ============================================================================
// Default Configuration
// ============================================================================

export const telemetryDefaultOptions: TelemetryConfig = {
  serviceName: 'mastra-service',
  enabled: true,
  sampling: { type: 'always_on' },
  context: {
    includeIO: true,
    maxDataSize: 64 * 1024, // 64KB
    excludeFields: ['password', 'token', 'secret', 'key'],
  },
  errorHandling: {
    enableRetries: true,
    maxRetries: 3,
    retryDelay: 1000,
    exponentialBackoff: true,
  },
};

// ============================================================================
// Abstract Base Class
// ============================================================================

/**
 * Abstract base class for all telemetry implementations in Mastra.
 * 
 * Follows Mastra's patterns:
 * - Extends MastraBase for consistent logging and component registration
 * - Uses dependency injection pattern
 * - Provides capability-based feature detection
 * - Supports pluggable exporters, processors, and samplers
 */
export abstract class MastraTelemetry extends MastraBase {
  protected config: TelemetryConfig;
  protected exporters: TelemetryExporter[] = [];
  protected processors: SpanProcessor[] = [];
  protected samplers: TelemetrySampler[] = [];

  constructor(config: { name: string } & SharedTelemetryConfig) {
    super({ component: RegisteredLogger.TELEMETRY, name: config.name });
    
    this.config = this.getMergedTelemetryConfig(config.options);
    
    if (config.exporters) {
      this.exporters = [...config.exporters];
    }
    
    if (config.processors) {
      this.processors = [...config.processors];
    }
    
    if (config.samplers) {
      this.samplers = [...config.samplers];
    }

    this.logger.debug(`Telemetry initialized [name=${this.name}] [enabled=${this.config.enabled}]`);
  }

  // ============================================================================
  // Public API - Handles sampling before calling abstract methods
  // ============================================================================

  /**
   * Start a new trace (handles sampling)
   */
  startTrace(name: string, options?: {
    user?: { id?: string; sessionId?: string; [key: string]: any };
    attributes?: Record<string, any>;
    tags?: string[];
  }): Trace {
    if (!this.isEnabled()) {
      return this.createNoOpTrace(name);
    }

    const traceContext = { name, user: options?.user, attributes: options?.attributes };
    if (!this.shouldSample(traceContext)) {
      return this.createNoOpTrace(name);
    }

    return this._startTrace(name, options);
  }

  /**
   * Start a new span (handles sampling)
   */
  startSpan(options: SpanOptions): AISpan {
    if (!this.isEnabled()) {
      return this.createNoOpSpan(options);
    }

    // For spans, we typically inherit the trace sampling decision
    // But we could add span-level sampling here if needed
    
    // Set up lifecycle callbacks
    const optionsWithCallbacks: SpanOptions = {
      ...options,
      _callbacks: {
        onEnd: (span: AISpan) => this.emitSpanEnded(span),
        onUpdate: (span: AISpan) => this.emitSpanUpdated(span),
        onScoreAdded: (span: AISpan, score: EvaluationScore) => 
          this.emitScoreAdded('span', span.id, score),
        onAnnotationAdded: (span: AISpan, annotation: HumanAnnotation | LLMAnnotation) => 
          this.emitAnnotationAdded('span', span.id, annotation),
      },
    };
    
    const span = this._startSpan(optionsWithCallbacks);
    
    // Add to trace if it's a root span
    this.addSpanToTrace(span);
    
    // Emit span started event
    this.emitSpanStarted(span);
    
    return span;
  }

  // ============================================================================
  // Abstract Methods - Must be implemented by concrete classes
  // ============================================================================

  /**
   * Start a new trace (called after sampling)
   */
  protected abstract _startTrace(name: string, options?: {
    user?: { id?: string; sessionId?: string; [key: string]: any };
    attributes?: Record<string, any>;
    tags?: string[];
  }): Trace;

  /**
   * Start a new span (called after sampling)
   * 
   * Implementations should:
   * 1. Create a span with the provided metadata
   * 2. Set span.trace to the appropriate trace
   * 3. Set span.parent to options.parent (if any)
   * 4. Use createSpanWithCallbacks() helper to automatically wire up lifecycle callbacks
   * 
   * The base class will automatically:
   * - Add the span to trace.rootSpans if it has no parent
   * - Emit span_started event
   * 
   * Example:
   * ```typescript
   * protected _startSpan(options: SpanOptions): AISpan {
   *   return this.createSpanWithCallbacks(options, (opts) => {
   *     const span = new MySpanImplementation(opts);
   *     span.trace = getCurrentTrace(); // Set trace reference
   *     span.parent = opts.parent;      // Set parent if any
   *     return span;
   *   });
   * }
   * ```
   */
  protected abstract _startSpan(options: SpanOptions): AISpan;

  /**
   * Trace a class instance with automatic instrumentation (handles sampling)
   */
  traceClass<T extends object>(
    instance: T,
    options?: TracingOptions
  ): T {
    if (!this.isEnabled()) {
      return instance; // Return unwrapped instance if disabled
    }
    return this._traceClass(instance, options);
  }

  /**
   * Trace a method with manual instrumentation (handles sampling)
   */
  traceMethod<TMethod extends Function>(
    method: TMethod,
    options: {
      spanName: string;
      spanType?: SpanType;
      attributes?: Record<string, any>;
    }
  ): TMethod {
    if (!this.isEnabled()) {
      return method; // Return unwrapped method if disabled
    }
    return this._traceMethod(method, options);
  }

  /**
   * Trace a class instance (called after sampling)
   */
  protected abstract _traceClass<T extends object>(
    instance: T,
    options?: TracingOptions
  ): T;

  /**
   * Trace a method (called after sampling)
   */
  protected abstract _traceMethod<TMethod extends Function>(
    method: TMethod,
    options: {
      spanName: string;
      spanType?: SpanType;
      attributes?: Record<string, any>;
    }
  ): TMethod;

  /**
   * Execute a function within a specific span context
   */
  abstract withSpan<T>(span: AISpan, fn: () => T): T;

  // ============================================================================
  // Capability Detection - Following Mastra patterns
  // ============================================================================

  /**
   * Declare what features this telemetry implementation supports
   */
  get supports(): TelemetrySupports {
    return {
      /** Basic tracing capabilities */
      tracing: true,
      /** AI-specific span types */
      aiSpanTypes: true,
      /** Human annotations */
      humanAnnotations: true,
      /** LLM annotations */
      llmAnnotations: true,
      /** Context propagation */
      contextPropagation: true,
      /** OpenTelemetry compatibility */
      openTelemetry: true,
      /** Distributed tracing */
      distributedTracing: true,
      /** Custom exporters */
      customExporters: true,
      /** Sampling strategies */
      sampling: true,
    };
  }

  // ============================================================================
  // Configuration Management - Following Mastra patterns
  // ============================================================================

  /**
   * Merge user configuration with defaults
   */
  protected getMergedTelemetryConfig(options?: TelemetryConfig): TelemetryConfig {
    return deepMerge(telemetryDefaultOptions, options || {});
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<TelemetryConfig> {
    return { ...this.config };
  }


  // ============================================================================
  // Plugin Access - Following Mastra patterns  
  // ============================================================================

  /**
   * Get all exporters
   */
  getExporters(): readonly TelemetryExporter[] {
    return [...this.exporters];
  }

  /**
   * Get all processors
   */
  getProcessors(): readonly SpanProcessor[] {
    return [...this.processors];
  }

  /**
   * Get all samplers
   */
  getSamplers(): readonly TelemetrySampler[] {
    return [...this.samplers];
  }

  // ============================================================================
  // No-op Methods for Disabled/Unsampled Operations
  // ============================================================================

  /**
   * Create a no-op trace for disabled/unsampled operations
   */
  protected createNoOpTrace(name: string): Trace {
    return {
      id: 'noop',
      name,
      startTime: new Date(),
      status: 'completed',
      rootSpans: [],
    };
  }

  /**
   * Create a no-op span for disabled/unsampled operations
   */
  protected createNoOpSpan(options: SpanOptions): AISpan {
    const noOpTrace: Trace = {
      id: 'noop',
      name: 'noop',
      startTime: new Date(),
      status: 'completed',
      rootSpans: [],
    };

    const noOpSpan: AISpan = {
      id: 'noop',
      metadata: {
        ...options.metadata,
        traceId: 'noop',
        createdAt: new Date(),
      } as SpanMetadata,
      children: [],
      parent: options.parent,
      trace: noOpTrace,
      end: () => {},
      addScore: () => {},
      addHumanAnnotation: () => {},
      addLLMAnnotation: () => {},
      createChildSpan: () => noOpSpan,
      updateMetadata: () => {},
      export: async () => '',
    };
    return noOpSpan;
  }

  // ============================================================================
  // Span Creation Helpers
  // ============================================================================

  /**
   * Add a span to its trace's rootSpans if it has no parent
   */
  protected addSpanToTrace(span: AISpan): void {
    if (!span.parent && !span.trace.rootSpans.includes(span)) {
      span.trace.rootSpans.push(span);
    }
  }

  /**
   * Create a span that automatically calls lifecycle callbacks
   * This is a helper for concrete implementations to wire up callbacks correctly
   */
  protected createSpanWithCallbacks(
    options: SpanOptions,
    createSpanFn: (opts: SpanOptions) => AISpan
  ): AISpan {
    const span = createSpanFn(options);
    
    // Store original methods
    const originalEnd = span.end.bind(span);
    const originalAddScore = span.addScore.bind(span);
    const originalAddHumanAnnotation = span.addHumanAnnotation.bind(span);
    const originalAddLLMAnnotation = span.addLLMAnnotation.bind(span);
    const originalUpdateMetadata = span.updateMetadata.bind(span);
    
    // Wrap methods to call callbacks
    span.end = (endTime?: Date) => {
      originalEnd(endTime);
      options._callbacks?.onEnd?.(span);
    };
    
    span.addScore = (score) => {
      originalAddScore(score);
      const fullScore: EvaluationScore = {
        ...score,
        id: `score-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        createdAt: new Date(),
      };
      options._callbacks?.onScoreAdded?.(span, fullScore);
    };
    
    span.addHumanAnnotation = (annotation) => {
      originalAddHumanAnnotation(annotation);
      const fullAnnotation: HumanAnnotation = {
        ...annotation,
        id: `annotation-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        createdAt: new Date(),
      };
      options._callbacks?.onAnnotationAdded?.(span, fullAnnotation);
    };
    
    span.addLLMAnnotation = (annotation) => {
      originalAddLLMAnnotation(annotation);
      const fullAnnotation: LLMAnnotation = {
        ...annotation,
        id: `annotation-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        createdAt: new Date(),
      };
      options._callbacks?.onAnnotationAdded?.(span, fullAnnotation);
    };
    
    span.updateMetadata = (updates) => {
      originalUpdateMetadata(updates);
      options._callbacks?.onUpdate?.(span);
    };
    
    return span;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Check if telemetry is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled ?? true;
  }


  /**
   * Check if a trace should be sampled
   */
  protected shouldSample(traceContext: any): boolean {
    if (!this.isEnabled()) {
      return false;
    }

    // Check custom samplers first
    for (const sampler of this.samplers) {
      if (!sampler.shouldSample(traceContext)) {
        return false;
      }
    }

    // Check built-in sampling strategy
    const { sampling } = this.config;
    if (!sampling) {
      return true;
    }

    switch (sampling.type) {
      case 'always_on':
        return true;
      case 'always_off':
        return false;
      case 'ratio':
        return Math.random() < sampling.probability;
      case 'custom':
        return sampling.sampler(traceContext);
      default:
        return true;
    }
  }


  /**
   * Process a span through all processors
   */
  private processSpan(span: AISpan): AISpan | null {
    let processedSpan: AISpan | null = span;

    for (const processor of this.processors) {
      if (!processedSpan) {
        break;
      }
      
      try {
        processedSpan = processor.process(processedSpan);
      } catch (error) {
        this.logger.error(`Processor error [name=${processor.name}]`, error);
        // Continue with other processors
      }
    }

    return processedSpan;
  }


  // ============================================================================
  // Event-driven Export Methods
  // ============================================================================

  /**
   * Emit a trace started event
   */
  protected emitTraceStarted(trace: Trace): void {
    this.exportEvent({ type: 'trace_started', trace }).catch(error => {
      this.logger.error('Failed to export trace_started event', error);
    });
  }

  /**
   * Emit a trace updated event
   */
  protected emitTraceUpdated(trace: Trace): void {
    this.exportEvent({ type: 'trace_updated', trace }).catch(error => {
      this.logger.error('Failed to export trace_updated event', error);
    });
  }

  /**
   * Emit a trace ended event
   */
  protected emitTraceEnded(trace: Trace): void {
    this.exportEvent({ type: 'trace_ended', trace }).catch(error => {
      this.logger.error('Failed to export trace_ended event', error);
    });
  }

  /**
   * Emit a span started event
   */
  protected emitSpanStarted(span: AISpan): void {
    // Process the span before emitting
    const processedSpan = this.processSpan(span);
    if (processedSpan) {
      this.exportEvent({ type: 'span_started', span: processedSpan }).catch(error => {
        this.logger.error('Failed to export span_started event', error);
      });
    }
  }

  /**
   * Emit a span ended event (called automatically when spans end)
   */
  protected emitSpanEnded(span: AISpan): void {
    // Process the span through all processors
    const processedSpan = this.processSpan(span);
    if (processedSpan) {
      this.exportEvent({ type: 'span_ended', span: processedSpan }).catch(error => {
        this.logger.error('Failed to export span_ended event', error);
      });
    }
  }

  /**
   * Emit a span updated event
   */
  protected emitSpanUpdated(span: AISpan): void {
    // Process the span before emitting
    const processedSpan = this.processSpan(span);
    if (processedSpan) {
      this.exportEvent({ type: 'span_updated', span: processedSpan }).catch(error => {
        this.logger.error('Failed to export span_updated event', error);
      });
    }
  }

  /**
   * Emit a score added event
   */
  protected emitScoreAdded(targetType: 'trace' | 'span', targetId: string, score: EvaluationScore): void {
    const event: TelemetryEvent = { type: 'score_added', targetType, targetId, score };
    this.exportEvent(event).catch(error => {
      this.logger.error('Failed to export score_added event', error);
    });
  }

  /**
   * Emit an annotation added event
   */
  protected emitAnnotationAdded(
    targetType: 'trace' | 'span', 
    targetId: string, 
    annotation: HumanAnnotation | LLMAnnotation
  ): void {
    const event: TelemetryEvent = { type: 'annotation_added', targetType, targetId, annotation };
    this.exportEvent(event).catch(error => {
      this.logger.error('Failed to export annotation_added event', error);
    });
  }


  /**
   * Export telemetry event through all exporters (realtime mode)
   */
  protected async exportEvent(event: TelemetryEvent): Promise<void> {
    const exportPromises = this.exporters.map(async (exporter) => {
      try {
        if (exporter.exportEvent) {
          await exporter.exportEvent(event);
          this.logger.debug(`Event exported [exporter=${exporter.name}] [type=${event.type}]`);
        }
      } catch (error) {
        this.logger.error(`Export error [exporter=${exporter.name}]`, error);
        // Don't rethrow - continue with other exporters
      }
    });

    await Promise.allSettled(exportPromises);
  }


  // ============================================================================
  // Lifecycle Management
  // ============================================================================

  /**
   * Initialize telemetry (called by Mastra during component registration)
   */
  async init(): Promise<void> {
    this.logger.debug(`Telemetry initialization started [name=${this.name}]`);
    
    // Any initialization logic for the telemetry system
    // This could include setting up queues, starting background processes, etc.
    
    this.logger.info(`Telemetry initialized successfully [name=${this.name}]`);
  }

  /**
   * Shutdown telemetry and clean up resources
   */
  async shutdown(): Promise<void> {
    this.logger.debug(`Telemetry shutdown started [name=${this.name}]`);

    // Shutdown all components
    const shutdownPromises = [
      ...this.exporters.map(e => e.shutdown()),
      ...this.processors.map(p => p.shutdown()),
    ];

    await Promise.allSettled(shutdownPromises);

    this.logger.info(`Telemetry shutdown completed [name=${this.name}]`);
  }

}