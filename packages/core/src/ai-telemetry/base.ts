/**
 * MastraAITelemetry - Abstract base class for AI Telemetry implementations
 */

import { MastraBase } from '../base';
import { RegisteredLogger } from '../logger/constants';
import type { RuntimeContext } from '../runtime-context';
import { NoOpAISpan } from './no-op';
import type {
  AITelemetryConfig,
  AISpan,
  AISpanOptions,
  AITelemetryExporter,
  AISpanProcessor,
  AITelemetrySampler,
  AITelemetryEvent,
  AITraceContext,
  AISpanTypeMap,
  AnyAISpan,
} from './types';
import { AISpanType } from './types';

// ============================================================================
// Abstract Base Class
// ============================================================================

/**
 * Abstract base class for all AI Telemetry implementations in Mastra.
 *
 */
export abstract class MastraAITelemetry extends MastraBase {
  protected config: AITelemetryConfig;

  constructor(config: AITelemetryConfig) {
    const serviceName = config.serviceName || 'mastra-ai-telemetry';
    super({ component: RegisteredLogger.AI_TELEMETRY, name: serviceName });

    this.config = config;

    this.logger.debug(
      `AI Telemetry initialized [service=${serviceName}] [sampling=${this.config.sampling?.type || 'always_on'}]`,
    );
  }

  // ============================================================================
  // Protected getters for clean config access
  // ============================================================================

  protected get exporters(): AITelemetryExporter[] {
    return this.config.exporters || [];
  }

  protected get processors(): AISpanProcessor[] {
    return this.config.processors || [];
  }

  protected get samplers(): AITelemetrySampler[] {
    return this.config.samplers || [];
  }

  // ============================================================================
  // Public API - Single type-safe span creation method
  // ============================================================================

  /**
   * Start a new span with full type safety
   */
  startSpan<TType extends AISpanType>(
    type: TType,
    name: string,
    metadata: AISpanTypeMap[TType],
    parent?: AnyAISpan,
    runtimeContext?: RuntimeContext,
    attributes?: Record<string, any>,
  ): AISpan<TType> {
    if (!this.shouldSample({ runtimeContext, attributes })) {
      return new NoOpAISpan<TType>({ type, name, metadata, parent }, this);
    }

    const options: AISpanOptions<TType> = {
      type,
      name,
      metadata,
      parent,
    };

    const span = this.createSpan(options);
    span.trace = parent ? parent.trace : span;

    // Automatically wire up telemetry lifecycle
    this.wireSpanLifecycle(span);

    // Emit span started event
    this.emitSpanStarted(span);

    return span;
  }

  // ============================================================================
  // Abstract Methods - Must be implemented by concrete classes
  // ============================================================================

  /**
   * Create a new span (called after sampling)
   *
   * Implementations should:
   * 1. Create a plain span with the provided metadata
   * 2. Return the span - base class handles all telemetry lifecycle automatically
   *
   * The base class will automatically:
   * - Set trace relationships
   * - Wire span lifecycle callbacks
   * - Emit span_started event
   */
  protected abstract createSpan<TType extends AISpanType>(options: AISpanOptions<TType>): AISpan<TType>;

  // ============================================================================
  // Configuration Management - Following Mastra patterns
  // ============================================================================

  /**
   * Get current configuration
   */
  getConfig(): Readonly<AITelemetryConfig> {
    return { ...this.config };
  }

  // ============================================================================
  // Plugin Access - Following Mastra patterns
  // ============================================================================

  /**
   * Get all exporters
   */
  getExporters(): readonly AITelemetryExporter[] {
    return [...this.exporters];
  }

  /**
   * Get all processors
   */
  getProcessors(): readonly AISpanProcessor[] {
    return [...this.processors];
  }

  /**
   * Get all samplers
   */
  getSamplers(): readonly AITelemetrySampler[] {
    return [...this.samplers];
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
   * Automatically wire up telemetry lifecycle for any span
   * This ensures all spans emit events regardless of implementation
   */
  private wireSpanLifecycle<TType extends AISpanType>(span: AISpan<TType>): void {
    // Store original methods
    const originalEnd = span.end.bind(span);
    const originalUpdate = span.update.bind(span);

    // Wrap methods to automatically emit telemetry events
    span.end = (metadata?: Partial<AISpanTypeMap[TType]>) => {
      originalEnd(metadata);
      this.emitSpanEnded(span);
    };

    span.update = (metadata: Partial<AISpanTypeMap[TType]>) => {
      originalUpdate(metadata);
      this.emitSpanUpdated(span);
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Check if a trace should be sampled
   */
  protected shouldSample(traceContext: AITraceContext): boolean {
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
        if (sampling.probability === undefined || sampling.probability < 0 || sampling.probability > 1) {
          this.logger.warn(
            `Invalid sampling probability: ${sampling.probability}. Expected value between 0 and 1. Defaulting to no sampling.`,
          );
          return false;
        }
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
  private processSpan(span: AnyAISpan): AnyAISpan | null {
    let processedSpan: AnyAISpan | null = span;

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
   * Emit a span started event
   */
  protected emitSpanStarted(span: AnyAISpan): void {
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
  protected emitSpanEnded(span: AnyAISpan): void {
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
  protected emitSpanUpdated(span: AnyAISpan): void {
    // Process the span before emitting
    const processedSpan = this.processSpan(span);
    if (processedSpan) {
      this.exportEvent({ type: 'span_updated', span: processedSpan }).catch(error => {
        this.logger.error('Failed to export span_updated event', error);
      });
    }
  }

  /**
   * Export telemetry event through all exporters (realtime mode)
   */
  protected async exportEvent(event: AITelemetryEvent): Promise<void> {
    const exportPromises = this.exporters.map(async exporter => {
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
    const shutdownPromises = [...this.exporters.map(e => e.shutdown()), ...this.processors.map(p => p.shutdown())];

    await Promise.allSettled(shutdownPromises);

    this.logger.info(`Telemetry shutdown completed [name=${this.name}]`);
  }
}
