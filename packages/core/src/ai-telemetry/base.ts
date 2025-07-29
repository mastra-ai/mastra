/**
 * MastraAITelemetry - Abstract base class for AI Telemetry implementations
 */

import { MastraBase } from '../base';
import { RegisteredLogger } from '../logger/constants';
import type { RuntimeContext } from '../runtime-context';
import { deepMerge } from '../utils';
import { NoOpAISpan } from './no-op';
import type {
  AITelemetryConfig,
  AISpan,
  AISpanOptions,
  AITelemetryExporter,
  AISpanProcessor,
  AITelemetrySampler,
  AISpanMetadata,
  AITelemetryEvent,
  AgentRunMetadata,
  WorkflowRunMetadata,
  WorkflowStepMetadata,
  AIBaseMetadata,
  AITraceContext,
} from './types';
import { AISpanType } from './types';

// ============================================================================
// Default Configuration
// ============================================================================

export const aiTelemetryDefaultConfig: AITelemetryConfig = {
  serviceName: 'mastra-service',
  enabled: true,
  sampling: { type: 'always_on' },
  settings: {
    includeIO: true,
    excludeFields: ['password', 'token', 'secret', 'key'],
  },
};

// ============================================================================
// Abstract Base Class
// ============================================================================

/**
 * Abstract base class for all AI Telemetry implementations in Mastra.
 *
 */
export abstract class MastraAITelemetry extends MastraBase {
  protected config: AITelemetryConfig;
  protected exporters: AITelemetryExporter[] = [];
  protected processors: AISpanProcessor[] = [];
  protected samplers: AITelemetrySampler[] = [];

  constructor(config: { name: string } & AITelemetryConfig) {
    super({ component: RegisteredLogger.AI_TELEMETRY, name: config.name });

    this.config = this.getMergedTelemetryConfig(config);

    if (config.exporters) {
      this.exporters = [...config.exporters];
    }

    if (config.processors) {
      this.processors = [...config.processors];
    }

    if (config.samplers) {
      this.samplers = [...config.samplers];
    }

    this.logger.debug(`AI Telemetry initialized [name=${this.name}] [enabled=${this.config.enabled}]`);
  }

  // ============================================================================
  // Public API - Handles sampling before calling abstract methods
  // ============================================================================

  startWorkflowRunSpan({
    name,
    metadata,
    parent,
  }: {
    name: string;
    metadata: WorkflowRunMetadata;
    parent?: AISpan;
  }): AISpan<AISpanMetadata> {
    return this.startSpan<WorkflowRunMetadata>({
      name,
      type: AISpanType.WORKFLOW_RUN,
      metadata,
      parent,
    });
  }

  startWorkflowStepSpan({
    name,
    metadata,
    parent,
  }: {
    name: string;
    metadata: WorkflowStepMetadata;
    parent?: AISpan;
  }): AISpan<AISpanMetadata> {
    return this.startSpan<WorkflowStepMetadata>({
      name,
      type: AISpanType.WORKFLOW_STEP,
      metadata,
      parent,
    });
  }

  startAgentRunSpan({
    name,
    metadata,
    parent,
  }: {
    name: string;
    metadata: AgentRunMetadata;
    parent?: AISpan;
  }): AISpan<AISpanMetadata> {
    return this.startSpan<AgentRunMetadata>({
      name,
      type: AISpanType.AGENT_RUN,
      metadata,
      parent,
    });
  }

  startGenericSpan({
    name,
    metadata,
    parent,
  }: {
    name: string;
    metadata: AIBaseMetadata;
    parent?: AISpan;
  }): AISpan<AISpanMetadata> {
    return this.startSpan<AIBaseMetadata>({
      name,
      type: AISpanType.GENERIC,
      metadata,
      parent,
    });
  }

  // ============================================================================
  // Abstract Methods - Must be implemented by concrete classes
  // ============================================================================

  /**
   * Start a new span (called after sampling)
   *
   * Implementations should:
   * 1. Create a span with the provided metadata
   * 2. Set span.trace to the appropriate trace
   * 3. Set span.parent to options.parent (if any)
   * 4. Set span.trace to span.parent.trace if options.parent, else to self.
   * 5. Use createSpanWithCallbacks() helper to automatically wire up lifecycle callbacks
   *
   * The base class will automatically:
   * - Add the span to trace.rootSpans if it has no parent
   * - Emit span_started event
   */
  protected abstract _startSpan(options: AISpanOptions): AISpan;

  /**
   * Start a new span (handles sampling)
   */
  startSpan<T extends AISpanMetadata>(
    options: AISpanOptions<T>,
    runtimeContext?: RuntimeContext,
    attributes?: Record<string, any>,
  ): AISpan {
    if (!this.isEnabled()) {
      return new NoOpAISpan(options, this);
    }

    if ((runtimeContext || attributes) && !this.shouldSample({ runtimeContext, attributes })) {
      return new NoOpAISpan(options, this);
    }

    options._callbacks = {
      onEnd: (span: AISpan) => this.emitSpanEnded(span),
      onUpdate: (span: AISpan) => this.emitSpanUpdated(span),
    };
    const span = this._startSpan(options);

    span.parent = options.parent;
    span.trace = options.parent ? options.parent.trace : span;

    // Emit span started event
    this.emitSpanStarted(span);

    return span as AISpan<T>;
  }

  // ============================================================================
  // Configuration Management - Following Mastra patterns
  // ============================================================================

  /**
   * Merge user configuration with defaults
   */
  protected getMergedTelemetryConfig(config?: AITelemetryConfig): AITelemetryConfig {
    return deepMerge(aiTelemetryDefaultConfig, config || {});
  }

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

  // ============================================================================
  // Span Creation Helpers
  // ============================================================================

  /**
   * Create a span that automatically calls lifecycle callbacks
   * This is a helper for concrete implementations to wire up callbacks correctly
   */
  protected createSpanWithCallbacks(options: AISpanOptions, createSpanFn: (opts: AISpanOptions) => AISpan): AISpan {
    const span = createSpanFn(options);

    // Store original methods
    const originalEnd = span.end.bind(span);
    const originalUpdate = span.update.bind(span);

    // Wrap methods to call callbacks
    span.end = (endOptions?: any) => {
      originalEnd(endOptions);
      options._callbacks?.onEnd?.(span);
    };

    span.update = (metadata: any) => {
      originalUpdate(metadata);
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
  protected shouldSample(traceContext: AITraceContext): boolean {
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
