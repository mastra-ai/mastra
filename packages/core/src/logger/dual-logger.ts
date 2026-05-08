import type { MastraError } from '../error';
import type { LoggerContext } from '../observability/types/logging';
import { resolveCurrentSpan } from '../observability/utils';
import type { LogLevel } from './constants';
import type { IMastraLogger } from './logger';
import type { BaseLogMessage, LoggerTransport } from './transport';

/**
 * A transparent wrapper around IMastraLogger that also forwards log calls
 * to a LoggerContext (loggerVNext) for observability dual-write.
 *
 * All existing `this.logger.info(...)` call sites automatically get
 * dual-write when this wrapper is injected via `__setLogger()`.
 *
 * Span-aware: when called inside an executeWithContext() scope, forwards to
 * a span-correlated loggerVNext (with traceId/spanId). Otherwise falls back
 * to the global loggerVNext (no correlation, still persisted to storage).
 *
 * Uses a lazy getter function for loggerVNext so it always resolves the
 * current LoggerContext at call time (observability may initialize after the logger).
 */
export class DualLogger implements IMastraLogger {
  #inner: IMastraLogger;
  #getLoggerVNext: (() => LoggerContext | undefined) | undefined;

  constructor(inner: IMastraLogger, getLoggerVNext?: () => LoggerContext | undefined) {
    this.#inner = inner;
    this.#getLoggerVNext = getLoggerVNext;
  }

  /**
   * Set or update the loggerVNext getter.
   * Called after observability initializes (which may happen after logger creation).
   */
  setLoggerVNext(getLoggerVNext: (() => LoggerContext | undefined) | undefined): void {
    this.#getLoggerVNext = getLoggerVNext;
  }

  debug(message: string, ...args: any[]): void {
    this.#inner.debug(message, ...args);
    this.#forwardToVNext('debug', message, args);
  }

  info(message: string, ...args: any[]): void {
    this.#inner.info(message, ...args);
    this.#forwardToVNext('info', message, args);
  }

  warn(message: string, ...args: any[]): void {
    this.#inner.warn(message, ...args);
    this.#forwardToVNext('warn', message, args);
  }

  error(message: string, ...args: any[]): void {
    this.#inner.error(message, ...args);
    this.#forwardToVNext('error', message, args);
  }

  trackException(error: MastraError, metadata?: Record<string, unknown>): void {
    this.#inner.trackException(error, metadata);
    try {
      const loggerVNext = this.#resolveLoggerVNext();
      loggerVNext?.error(error.message, {
        errorId: error.id,
        domain: error.domain,
        category: error.category,
        details: error.details,
        cause: error.cause?.message,
        ...metadata,
      });
    } catch {
      // Never let loggerVNext errors break the primary logger
    }
  }

  getTransports(): Map<string, LoggerTransport> {
    return this.#inner.getTransports();
  }

  async listLogs(
    transportId: string,
    params?: {
      fromDate?: Date;
      toDate?: Date;
      logLevel?: LogLevel;
      filters?: Record<string, any>;
      page?: number;
      perPage?: number;
    },
  ): Promise<{ logs: BaseLogMessage[]; total: number; page: number; perPage: number; hasMore: boolean }> {
    return this.#inner.listLogs(transportId, params);
  }

  async listLogsByRunId(args: {
    transportId: string;
    runId: string;
    fromDate?: Date;
    toDate?: Date;
    logLevel?: LogLevel;
    filters?: Record<string, any>;
    page?: number;
    perPage?: number;
  }): Promise<{ logs: BaseLogMessage[]; total: number; page: number; perPage: number; hasMore: boolean }> {
    return this.#inner.listLogsByRunId(args);
  }

  /**
   * Resolve the best available LoggerContext:
   * 1. Span-correlated loggerVNext from AsyncLocalStorage (has traceId/spanId)
   * 2. Global loggerVNext from the lazy getter (no correlation, still persisted)
   */
  #resolveLoggerVNext(): LoggerContext | undefined {
    // Check for a span in async context (set by executeWithContext)
    const span = resolveCurrentSpan();
    if (span) {
      const correlated = span.observabilityInstance?.getLoggerContext?.(span);
      if (correlated) return correlated;
    }

    // Fall back to global loggerVNext (no trace correlation)
    return this.#getLoggerVNext?.();
  }

  /**
   * Adapt IMastraLogger's variadic args to LoggerContext's structured data param.
   * Extracts the first plain object as `data`, serializes Error args, and
   * collects any remaining primitives so the dual write preserves all context.
   */
  #forwardToVNext(level: 'debug' | 'info' | 'warn' | 'error', message: string, args: any[]): void {
    try {
      const loggerVNext = this.#resolveLoggerVNext();
      if (!loggerVNext) return;

      const objectData = args.find(
        (arg): arg is Record<string, unknown> =>
          arg !== null && typeof arg === 'object' && !Array.isArray(arg) && !(arg instanceof Error),
      );
      const errorArg = args.find((arg): arg is Error => arg instanceof Error);
      const extraArgs = args.filter(arg => arg !== objectData && arg !== errorArg);

      loggerVNext[level](message, {
        ...(objectData ?? {}),
        ...(errorArg
          ? {
              error: {
                name: errorArg.name,
                message: errorArg.message,
                stack: errorArg.stack,
              },
            }
          : {}),
        ...(extraArgs.length > 0 ? { args: extraArgs } : {}),
      });
    } catch {
      // Never let loggerVNext errors break the primary logger
    }
  }
}
