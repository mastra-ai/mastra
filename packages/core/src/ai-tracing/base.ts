/**
 * MastraAITracing - Abstract base class for AI Tracing implementations
 */

import { MastraBase } from '../base';
import type { IMastraLogger } from '../logger';
import { RegisteredLogger } from '../logger/constants';
import type { RuntimeContext } from '../runtime-context';
import { NoOpAISpan } from './no-op';
import type {
  AITracingInstanceConfig,
  AISpan,
  AISpanOptions,
  AISpanType,
  AITracingExporter,
  AISpanProcessor,
  AITracingEvent,
  TraceContext,
  AISpanTypeMap,
  AnyAISpan,
} from './types';
import { SamplingStrategyType, AITracingEventType } from './types';

// ============================================================================
// Abstract Base Class
// ============================================================================

/**
 * Abstract base class for all AI Tracing implementations in Mastra.
 *
 */
export abstract class MastraAITracing extends MastraBase {
  protected config: Required<AITracingInstanceConfig>;

  constructor(config: AITracingInstanceConfig) {
    super({ component: RegisteredLogger.AI_TRACING, name: config.serviceName });

    // Apply defaults for optional fields
    this.config = {
      serviceName: config.serviceName,
      instanceName: config.instanceName,
      sampling: config.sampling ?? { type: SamplingStrategyType.ALWAYS },
      exporters: config.exporters ?? [],
      processors: config.processors ?? [],
    };
  }

  /**
   * Override setLogger to add AI tracing specific initialization log
   */
  __setLogger(logger: IMastraLogger) {
    super.__setLogger(logger);
    // Log AI tracing initialization details after logger is properly set
    this.logger.debug(
      `[AI Tracing] Initialized [service=${this.config.serviceName}] [instance=${this.config.instanceName}] [sampling=${this.config.sampling.type}]`,
    );
  }

  // ============================================================================
  // Protected getters for clean config access
  // ============================================================================

  protected get exporters(): AITracingExporter[] {
    return this.config.exporters || [];
  }

  protected get processors(): AISpanProcessor[] {
    return this.config.processors || [];
  }

  // ============================================================================
  // Public API - Single type-safe span creation method
  // ============================================================================

  /**
   * Start a new span of a specific AISpanType
   */
  startSpan<TType extends AISpanType>(options: {
    type: TType;
    name: string;
    input?: any;
    output?: any;
    attributes?: AISpanTypeMap[TType];
    metadata?: Record<string, any>;
    parent?: AnyAISpan;
    startOptions?: {
      runtimeContext?: RuntimeContext;
    };
    isEvent?: boolean;
  }): AISpan<TType> {
    const { type, name, input, output, attributes, metadata, parent, startOptions, isEvent } = options;
    const { runtimeContext } = startOptions || {};

    if (!this.shouldSample({ runtimeContext })) {
      return new NoOpAISpan<TType>(
        { type, name, input, output, attributes, metadata, parent, isEvent: isEvent === true },
        this,
      );
    }

    const spanOptions: AISpanOptions<TType> = {
      type,
      name,
      input,
      output,
      attributes,
      metadata,
      parent,
      isEvent: isEvent === true,
    };

    const span = this.createSpan(spanOptions);

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
  protected abstract createSpan<TType extends AISpanType>(options: AISpanOptions<TType>): AISpan<TType>;

  // ============================================================================
  // Configuration Management
  // ============================================================================

  /**
   * Get current configuration
   */
  getConfig(): Readonly<Required<AITracingInstanceConfig>> {
    return { ...this.config };
  }

  // ============================================================================
  // Plugin Access
  // ============================================================================

  /**
   * Get all exporters
   */
  getExporters(): readonly AITracingExporter[] {
    return [...this.exporters];
  }

  /**
   * Get all processors
   */
  getProcessors(): readonly AISpanProcessor[] {
    return [...this.processors];
  }

  /**
   * Get the logger instance (for exporters and other components)
   */
  getLogger() {
    return this.logger;
  }

  // ============================================================================
  // Span Lifecycle Management
  // ============================================================================

  /**
   * Automatically wires up AI tracing lifecycle events for any span
   * This ensures all spans emit events regardless of implementation
   */
  private wireSpanLifecycle<TType extends AISpanType>(span: AISpan<TType>): void {
    // Store original methods
    const originalEnd = span.end.bind(span);
    const originalUpdate = span.update.bind(span);

    // Wrap methods to automatically emit tracing events
    span.end = (options?: {
      output?: any;
      attributes?: Partial<AISpanTypeMap[TType]>;
      metadata?: Record<string, any>;
    }) => {
      originalEnd(options);
      this.emitSpanEnded(span);
    };

    span.update = (options?: {
      input?: any;
      output?: any;
      attributes?: Partial<AISpanTypeMap[TType]>;
      metadata?: Record<string, any>;
    }) => {
      originalUpdate(options);
      this.emitSpanUpdated(span);
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Check if an AI trace should be sampled
   */
  protected shouldSample(traceContext: TraceContext): boolean {
    // Check built-in sampling strategy
    const { sampling } = this.config;

    switch (sampling.type) {
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
        return sampling.sampler(traceContext);
      default:
        throw new Error(`Sampling strategy type not implemented: ${(sampling as any).type}`);
    }
  }

  /**
   * Process a span through all processors
   */
  private processSpan(span: AnyAISpan): AnyAISpan | null {
    let processedSpan: AnyAISpan | null = span;

    for (const processor of this.processors) {
      if (!processedSpan) {
        break;
      }

      try {
        processedSpan = processor.process(processedSpan);
      } catch (error) {
        this.logger.error(`[AI Tracing] Processor error [name=${processor.name}]`, error);
        // Continue with other processors
      }
    }

    return processedSpan;
  }

  // ============================================================================
  // Event-driven Export Methods
  // ============================================================================

  /**
   * Emit a span started event
   */
  protected emitSpanStarted(span: AnyAISpan): void {
    // Process the span before emitting
    const processedSpan = this.processSpan(span);
    if (processedSpan) {
      this.exportEvent({ type: AITracingEventType.SPAN_STARTED, span: processedSpan }).catch(error => {
        this.logger.error('[AI Tracing] Failed to export span_started event', error);
      });
    }
  }

  /**
   * Emit a span ended event (called automatically when spans end)
   */
  protected emitSpanEnded(span: AnyAISpan): void {
    // Process the span through all processors
    const processedSpan = this.processSpan(span);
    if (processedSpan) {
      this.exportEvent({ type: AITracingEventType.SPAN_ENDED, span: processedSpan }).catch(error => {
        this.logger.error('[AI Tracing] Failed to export span_ended event', error);
      });
    }
  }

  /**
   * Emit a span updated event
   */
  protected emitSpanUpdated(span: AnyAISpan): void {
    // Process the span before emitting
    const processedSpan = this.processSpan(span);
    if (processedSpan) {
      this.exportEvent({ type: AITracingEventType.SPAN_UPDATED, span: processedSpan }).catch(error => {
        this.logger.error('[AI Tracing] Failed to export span_updated event', error);
      });
    }
  }

  /**
   * Export tracing event through all exporters (realtime mode)
   */
  protected async exportEvent(event: AITracingEvent): Promise<void> {
    const exportPromises = this.exporters.map(async exporter => {
      try {
        if (exporter.exportEvent) {
          await exporter.exportEvent(event);
          this.logger.debug(`[AI Tracing] Event exported [exporter=${exporter.name}] [type=${event.type}]`);
        }
      } catch (error) {
        this.logger.error(`[AI Tracing] Export error [exporter=${exporter.name}]`, error);
        // Don't rethrow - continue with other exporters
      }
    });

    await Promise.allSettled(exportPromises);
  }

  // ============================================================================
  // Lifecycle Management
  // ============================================================================

  /**
   * Initialize AI tracing (called by Mastra during component registration)
   */
  init(): void {
    this.logger.debug(`[AI Tracing] Initialization started [name=${this.name}]`);

    // Any initialization logic for the AI tracing system
    // This could include setting up queues, starting background processes, etc.

    this.logger.info(`[AI Tracing] Initialized successfully [name=${this.name}]`);
  }

  /**
   * Shutdown AI tracing and clean up resources
   */
  async shutdown(): Promise<void> {
    this.logger.debug(`[AI Tracing] Shutdown started [name=${this.name}]`);

    // Shutdown all components
    const shutdownPromises = [...this.exporters.map(e => e.shutdown()), ...this.processors.map(p => p.shutdown())];

    await Promise.allSettled(shutdownPromises);

    this.logger.info(`[AI Tracing] Shutdown completed [name=${this.name}]`);
  }
}
