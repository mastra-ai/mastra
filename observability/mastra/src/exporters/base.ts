/**
 * Base Exporter for Observability
 *
 * Provides common functionality shared by all observability exporters:
 * - Logger initialization with proper Mastra logger support
 * - Disabled state management
 * - Graceful shutdown lifecycle
 */

import { ConsoleLogger, LogLevel } from '@mastra/core/logger';
import type { IMastraLogger } from '@mastra/core/logger';
import type {
  TracingEvent,
  ObservabilityExporter,
  InitExporterOptions,
  CustomSpanFormatter,
} from '@mastra/core/observability';

/**
 * Base configuration that all exporters should support
 */
export interface BaseExporterConfig {
  /** Optional Mastra logger instance */
  logger?: IMastraLogger;
  /** Log level for the exporter (defaults to INFO) - accepts both enum and string */
  logLevel?: LogLevel | 'debug' | 'info' | 'warn' | 'error';
  /**
   * Custom span formatter function to transform exported spans before they are
   * processed by the exporter. This allows customization of how spans appear
   * in vendor-specific observability platforms.
   *
   * Use cases:
   * - Extract plain text from structured AI SDK messages for better readability
   * - Transform input/output format for specific vendor requirements
   * - Add or remove fields based on the target platform
   *
   * @example
   * ```typescript
   * const exporter = new BraintrustExporter({
   *   customSpanFormatter: (span) => {
   *     // Extract plain text user message for AGENT_RUN spans
   *     if (span.type === SpanType.AGENT_RUN && Array.isArray(span.input)) {
   *       const userMsg = span.input.find(m => m.role === 'user');
   *       return { ...span, input: userMsg?.content ?? span.input };
   *     }
   *     return span;
   *   },
   * });
   * ```
   */
  customSpanFormatter?: CustomSpanFormatter;
}

/**
 * Abstract base class for observability exporters
 *
 * Handles common concerns:
 * - Logger setup with proper Mastra logger
 * - Disabled state management
 * - Basic lifecycle methods
 *
 * @example
 * ```typescript
 * class MyExporter extends BaseExporter {
 *   name = 'my-exporter';
 *
 *   constructor(config: MyExporterConfig) {
 *     super(config);
 *
 *     if (!config.apiKey) {
 *       this.setDisabled('Missing API key');
 *       return;
 *     }
 *
 *     // Initialize exporter-specific logic
 *   }
 *
 *   async _exportEvent(event: TracingEvent): Promise<void> {
 *     // Export logic
 *   }
 * }
 * ```
 */
export abstract class BaseExporter implements ObservabilityExporter {
  /** Exporter name - must be implemented by subclasses */
  abstract name: string;

  /** Mastra logger instance */
  protected logger: IMastraLogger;

  /** Base configuration (accessible by subclasses) */
  protected readonly baseConfig: BaseExporterConfig;

  /** Whether this exporter is disabled */
  #disabled: boolean = false;

  /** Public getter for disabled state */
  get isDisabled(): boolean {
    return this.#disabled;
  }

  /**
   * Initialize the base exporter with logger
   */
  constructor(config: BaseExporterConfig = {}) {
    this.baseConfig = config;
    // Map string log level to LogLevel enum if needed
    const logLevel = this.resolveLogLevel(config.logLevel);
    // Use constructor name as fallback since this.name isn't set yet (subclass initializes it)
    this.logger = config.logger ?? new ConsoleLogger({ level: logLevel, name: this.constructor.name });
  }

  /**
   * Set the logger for the exporter (called by Mastra/ObservabilityInstance during initialization)
   */
  __setLogger(logger: IMastraLogger): void {
    this.logger = logger;
    // Use this.name here since it's guaranteed to be set by the subclass at this point
    this.logger.debug(`Logger updated for exporter [name=${this.name}]`);
  }

  /**
   * Convert string log level to LogLevel enum
   */
  private resolveLogLevel(logLevel?: LogLevel | 'debug' | 'info' | 'warn' | 'error'): LogLevel {
    if (!logLevel) {
      return LogLevel.INFO;
    }

    // If already a LogLevel enum, return as-is
    if (typeof logLevel === 'number') {
      return logLevel;
    }

    // Map string to enum
    const logLevelMap: Record<string, LogLevel> = {
      debug: LogLevel.DEBUG,
      info: LogLevel.INFO,
      warn: LogLevel.WARN,
      error: LogLevel.ERROR,
    };

    return logLevelMap[logLevel] ?? LogLevel.INFO;
  }

  /**
   * Mark the exporter as disabled and log a message
   *
   * @param reason - Reason why the exporter is disabled
   */
  protected setDisabled(reason: string): void {
    this.#disabled = true;
    this.logger.warn(`${this.name} disabled: ${reason}`);
  }

  /**
   * Apply the customSpanFormatter if configured.
   * This is called automatically by exportTracingEvent before _exportTracingEvent.
   *
   * Supports both synchronous and asynchronous formatters. If the formatter
   * returns a Promise, it will be awaited.
   *
   * @param event - The incoming tracing event
   * @returns The (possibly modified) event to process
   */
  protected async applySpanFormatter(event: TracingEvent): Promise<TracingEvent> {
    if (this.baseConfig.customSpanFormatter) {
      try {
        const formattedSpan = await this.baseConfig.customSpanFormatter(event.exportedSpan);
        return {
          ...event,
          exportedSpan: formattedSpan,
        };
      } catch (error) {
        this.logger.error(`${this.name}: Error in customSpanFormatter`, {
          error,
          spanId: event.exportedSpan.id,
          traceId: event.exportedSpan.traceId,
        });
        // Fall through to return original event if formatter fails
      }
    }
    return event;
  }

  /**
   * Default onTracingEvent handler that delegates to exportTracingEvent.
   *
   * This provides backward compatibility: existing exporters that only implement
   * _exportTracingEvent will automatically receive tracing events routed through
   * the ObservabilityBus. Subclasses can override this if they need different
   * routing behavior for bus-delivered events.
   *
   * Handler presence on ObservabilityExporter = signal support.
   */
  onTracingEvent(event: TracingEvent): void | Promise<void> {
    return this.exportTracingEvent(event);
  }

  /**
   * Export a tracing event
   *
   * This method checks if the exporter is disabled, applies the customSpanFormatter,
   * then calls _exportTracingEvent.
   * Subclasses should implement _exportTracingEvent instead of overriding this method.
   */
  async exportTracingEvent(event: TracingEvent): Promise<void> {
    if (this.isDisabled) {
      return;
    }
    const processedEvent = await this.applySpanFormatter(event);
    await this._exportTracingEvent(processedEvent);
  }

  /**
   * Export a tracing event - must be implemented by subclasses
   *
   * This method is called by exportTracingEvent after checking if the exporter is disabled.
   */
  protected abstract _exportTracingEvent(event: TracingEvent): Promise<void>;

  /**
   * Optional initialization hook called after Mastra is fully configured
   */
  init?(_options: InitExporterOptions): void;

  /**
   * Optional method to add scores to traces
   */
  addScoreToTrace?(_args: {
    traceId: string;
    spanId?: string;
    score: number;
    reason?: string;
    scorerName: string;
    metadata?: Record<string, any>;
  }): Promise<void>;

  /**
   * Force flush any buffered/queued spans without shutting down the exporter.
   *
   * This is useful in serverless environments where you need to ensure spans
   * are exported before the runtime instance is terminated, while keeping
   * the exporter active for future requests.
   *
   * Default implementation is a no-op. Override to add flush logic.
   */
  async flush(): Promise<void> {
    this.logger.debug(`${this.name} flush called (no-op in base class)`);
  }

  /**
   * Shutdown the exporter and clean up resources
   *
   * Default implementation just logs. Override to add custom cleanup.
   */
  async shutdown(): Promise<void> {
    this.logger.info(`${this.name} shutdown complete`);
  }
}
