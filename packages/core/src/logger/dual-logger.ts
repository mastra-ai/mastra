import type { MastraError } from '../error';
import type { LoggerContext } from '../observability/types/logging';
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

  trackException(error: MastraError): void {
    this.#inner.trackException(error);
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
   * Adapt IMastraLogger's variadic args to LoggerContext's structured data param.
   * The first object arg becomes `data`. If no object arg, forward with no data.
   */
  #forwardToVNext(level: 'debug' | 'info' | 'warn' | 'error', message: string, args: any[]): void {
    if (!this.#getLoggerVNext) return;

    try {
      const loggerVNext = this.#getLoggerVNext();
      if (!loggerVNext) return;

      const data = args.find(
        (arg): arg is Record<string, unknown> =>
          arg !== null && typeof arg === 'object' && !Array.isArray(arg) && !(arg instanceof Error),
      );
      loggerVNext[level](message, data);
    } catch {
      // Never let loggerVNext errors break the primary logger
    }
  }
}
