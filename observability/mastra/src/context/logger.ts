/**
 * LoggerContextImpl - Structured logging with automatic trace correlation.
 *
 * Emits LogEvent to the ObservabilityBus with trace/span IDs
 * inherited from the current span.
 */

import type { LogLevel, LoggerContext, ExportedLog, LogEvent, AnySpan } from '@mastra/core/observability';

import type { ObservabilityBus } from '../bus';

export interface LoggerContextConfig {
  /** Current span - provides traceId, spanId, tags, and metadata */
  currentSpan?: AnySpan;

  /** Bus for event emission */
  observabilityBus: ObservabilityBus;

  /** Minimum log level (logs below this are discarded) */
  minLevel?: LogLevel;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

export class LoggerContextImpl implements LoggerContext {
  private config: LoggerContextConfig;

  constructor(config: LoggerContextConfig) {
    this.config = config;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  fatal(message: string, data?: Record<string, unknown>): void {
    this.log('fatal', message, data);
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const minLevel = this.config.minLevel ?? 'debug';
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[minLevel]) {
      return;
    }

    const span = this.config.currentSpan;

    const exportedLog: ExportedLog = {
      timestamp: new Date(),
      level,
      message,
      data,
      traceId: span?.traceId,
      spanId: span?.id,
      tags: span?.tags,
      metadata: span?.metadata,
    };

    const event: LogEvent = { type: 'log', log: exportedLog };
    this.config.observabilityBus.emit(event);
  }
}
