import type { LoggerAdapterContext } from '@internal/core/logger';
import { isAdaptableLogger, buildLogRecordData, exportTrackedException } from '@internal/core/logger';
import type { MastraError } from '../error';
import type { LogLevel } from './constants';
import type { IMastraLogger } from './logger';
import type { LoggerTransport } from './transport';

export class MultiLogger implements IMastraLogger {
  private loggers: IMastraLogger[];
  #adapterContext?: LoggerAdapterContext;

  constructor(loggers: IMastraLogger[]) {
    this.loggers = loggers;
  }

  /**
   * Adapter hook (see `AdaptableLogger`): fans trace correlation out to every
   * adaptable wrapped logger (with export disabled on them) and performs the
   * observability export exactly once at this level, so a record logged
   * through N loggers is stored once, not N times.
   */
  __attachObservability(ctx: LoggerAdapterContext): void {
    this.#adapterContext = ctx;
    const childCtx: LoggerAdapterContext = { ...ctx, options: { ...ctx.options, export: false } };
    for (const logger of this.loggers) {
      if (isAdaptableLogger(logger)) logger.__attachObservability(childCtx);
    }
  }

  #export(level: 'debug' | 'info' | 'warn' | 'error', message: string, args: any[]): void {
    const ctx = this.#adapterContext;
    if (!ctx?.options.export) return;
    try {
      // Trace identity travels on ExportedLog.traceId/spanId (the sink is
      // span-correlated); data stays reserved for the user payload.
      ctx.getLogSink()?.[level](message, buildLogRecordData(args));
    } catch {
      // Never let observability export break the primary loggers
    }
  }

  debug(message: string, ...args: any[]): void {
    this.loggers.forEach(logger => logger.debug(message, ...args));
    this.#export('debug', message, args);
  }

  info(message: string, ...args: any[]): void {
    this.loggers.forEach(logger => logger.info(message, ...args));
    this.#export('info', message, args);
  }

  warn(message: string, ...args: any[]): void {
    this.loggers.forEach(logger => logger.warn(message, ...args));
    this.#export('warn', message, args);
  }

  error(message: string, ...args: any[]): void {
    this.loggers.forEach(logger => logger.error(message, ...args));
    this.#export('error', message, args);
  }

  trackException(error: MastraError, metadata?: Record<string, unknown>): void {
    this.loggers.forEach(logger => logger.trackException(error, metadata));
    exportTrackedException(this.#adapterContext, error, metadata);
  }

  getTransports(): Map<string, LoggerTransport> {
    const transports: [string, LoggerTransport][] = [];
    this.loggers.forEach(logger => transports.push(...logger.getTransports().entries()));
    return new Map(transports);
  }

  async listLogs(
    transportId: string,
    params?: {
      fromDate?: Date;
      toDate?: Date;
      logLevel?: LogLevel;
      filters?: Record<string, any>;
      returnPaginationResults?: boolean;
      page?: number;
      perPage?: number;
    },
  ) {
    for (const logger of this.loggers) {
      const logs = await logger.listLogs(transportId, params);
      if (logs.total > 0) {
        return logs;
      }
    }

    return { logs: [], total: 0, page: params?.page ?? 1, perPage: params?.perPage ?? 100, hasMore: false };
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
  }) {
    for (const logger of this.loggers) {
      const logs = await logger.listLogsByRunId(args);
      if (logs.total > 0) {
        return logs;
      }
    }

    return { logs: [], total: 0, page: args.page ?? 1, perPage: args.perPage ?? 100, hasMore: false };
  }
}
