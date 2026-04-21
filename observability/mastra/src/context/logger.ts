/**
 * LoggerContextImpl - Structured logging with automatic trace correlation.
 *
 * Emits LogEvent to the ObservabilityBus. All context (correlationContext,
 * metadata) is snapshotted at construction time.
 */

import { generateSignalId } from '@mastra/core/observability';
import type { LogLevel, LoggerContext, ExportedLog, LogEvent, CorrelationContext } from '@mastra/core/observability';

import type { ObservabilityBus } from '../bus';

export interface LoggerContextConfig {
  /** Top-level trace identity for emitted log events */
  traceId?: string;

  /** Top-level span identity for emitted log events */
  spanId?: string;

  /** Canonical correlation context for log correlation */
  correlationContext?: CorrelationContext;

  /** Metadata (entity context, runId, environment, serviceName, etc.) */
  metadata?: Record<string, unknown>;

  /** Bus for event emission */
  observabilityBus: ObservabilityBus;

  /** Minimum log level (logs below this are discarded) */
  minLevel?: LogLevel;
}

/** Numeric priority used to compare log levels against the configured minimum. */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

export class LoggerContextImpl implements LoggerContext {
  private config: LoggerContextConfig;

  /**
   * Create a logger context. Context and metadata are defensively copied so
   * mutations after construction do not affect emitted logs.
   */
  constructor(config: LoggerContextConfig) {
    const correlationContext = config.correlationContext ? { ...config.correlationContext } : undefined;

    this.config = {
      ...config,
      traceId: config.traceId ?? correlationContext?.traceId,
      spanId: config.spanId ?? correlationContext?.spanId,
      correlationContext,
      metadata: config.metadata ? structuredClone(config.metadata) : undefined,
    };
  }

  /** Log at DEBUG level. */
  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  /** Log at INFO level. */
  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  /** Log at WARN level. */
  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  /** Log at ERROR level. */
  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  /** Log at FATAL level. */
  fatal(message: string, data?: Record<string, unknown>): void {
    this.log('fatal', message, data);
  }

  /**
   * Build an ExportedLog, check against the minimum level, and emit it through the bus.
   */
  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const minLevel = this.config.minLevel ?? 'debug';
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[minLevel]) {
      return;
    }

    const exportedLog: ExportedLog = {
      logId: generateSignalId(),
      timestamp: new Date(),
      level,
      message,
      data,
      traceId: this.config.traceId,
      spanId: this.config.spanId,
      correlationContext: this.config.correlationContext,
      metadata: this.config.metadata,
    };

    const event: LogEvent = { type: 'log', log: exportedLog };
    this.config.observabilityBus.emit(event);
  }
}
