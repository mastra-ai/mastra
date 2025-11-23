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
import type { TracingEvent, ObservabilityExporter, InitExporterOptions } from '@mastra/core/observability';

/**
 * Base configuration that all exporters should support
 */
export interface BaseExporterConfig {
  /** Optional Mastra logger instance */
  logger?: IMastraLogger;
  /** Log level for the exporter (defaults to INFO) - use LogLevel.INFO or 'info' string directly */
  logLevel?: LogLevel;
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
 *     // LogLevel can be passed as LogLevel.DEBUG or 'debug' string
 *     super({ ...config, logLevel: config.logLevel ?? 'info' });
 *
 *     if (!config.apiKey) {
 *       this.setDisabled('Missing API key');
 *       return;
 *     }
 *
 *     // Initialize exporter-specific logic
 *   }
 *
 *   async _exportTracingEvent(event: TracingEvent): Promise<void> {
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

  /** Whether this exporter is disabled */
  protected isDisabled: boolean = false;

  /**
   * Initialize the base exporter with logger
   */
  constructor(config: BaseExporterConfig = {}) {
    // Default to INFO level if not specified
    const logLevel = config.logLevel ?? LogLevel.INFO;
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
   * Mark the exporter as disabled and log a message
   *
   * @param reason - Reason why the exporter is disabled
   */
  protected setDisabled(reason: string): void {
    this.isDisabled = true;
    this.logger.warn(`${this.name} disabled: ${reason}`);
  }

  /**
   * Export a tracing event
   *
   * This method checks if the exporter is disabled before calling _exportTracingEvent.
   * Subclasses should implement _exportTracingEvent instead of overriding this method.
   */
  async exportTracingEvent(event: TracingEvent): Promise<void> {
    if (this.isDisabled) {
      return;
    }
    await this._exportTracingEvent(event);
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
   * Shutdown the exporter and clean up resources
   *
   * Default implementation just logs. Override to add custom cleanup.
   */
  async shutdown(): Promise<void> {
    this.logger.info(`${this.name} shutdown complete`);
  }
}
