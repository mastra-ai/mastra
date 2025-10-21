/**
 * Base Exporter for AI Tracing
 *
 * Provides common functionality shared by all AI tracing exporters:
 * - Logger initialization with proper Mastra logger support
 * - Disabled state management
 * - Graceful shutdown lifecycle
 */

import { ConsoleLogger, LogLevel } from '../../logger';
import type { IMastraLogger } from '../../logger';
import type { AITracingEvent, AITracingExporter } from '../types';

/**
 * Base configuration that all exporters should support
 */
export interface BaseExporterConfig {
  /** Optional Mastra logger instance */
  logger?: IMastraLogger;
  /** Log level for the exporter (defaults to INFO) - accepts both enum and string */
  logLevel?: LogLevel | 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Abstract base class for AI tracing exporters
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
 *   async exportEvent(event: AITracingEvent): Promise<void> {
 *     if (this.isDisabled) return;
 *     // Export logic
 *   }
 * }
 * ```
 */
export abstract class BaseExporter implements AITracingExporter {
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
    // Map string log level to LogLevel enum if needed
    const logLevel = this.resolveLogLevel(config.logLevel);
    // Use constructor name as fallback since this.name isn't set yet (subclass initializes it)
    this.logger = config.logger ?? new ConsoleLogger({ level: logLevel, name: this.constructor.name });
  }

  /**
   * Set the logger for the exporter (called by Mastra/AITracing during initialization)
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
    this.isDisabled = true;
    this.logger.debug(`${this.name} disabled: ${reason}`);
  }

  /**
   * Export a tracing event
   *
   * This method checks if the exporter is disabled before calling _exportEvent.
   * Subclasses should implement _exportEvent instead of overriding this method.
   */
  async exportEvent(event: AITracingEvent): Promise<void> {
    if (this.isDisabled) {
      return;
    }
    await this._exportEvent(event);
  }

  /**
   * Export a tracing event - must be implemented by subclasses
   *
   * This method is called by exportEvent after checking if the exporter is disabled.
   */
  protected abstract _exportEvent(event: AITracingEvent): Promise<void>;

  /**
   * Optional initialization hook called after Mastra is fully configured
   */
  init?(_config?: any): void;

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
