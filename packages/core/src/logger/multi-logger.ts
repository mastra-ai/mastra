import type { MastraError } from '../error';
import type { LogLevel } from './constants';
import type { IMastraLogger } from './logger';
import type { LoggerTransport } from './transport';

export class MultiLogger implements IMastraLogger {
  private loggers: IMastraLogger[];

  constructor(loggers: IMastraLogger[]) {
    this.loggers = loggers;
  }

  debug(message: string, ...args: any[]): void {
    this.loggers.forEach(logger => logger.debug(message, ...args));
  }

  info(message: string, ...args: any[]): void {
    this.loggers.forEach(logger => logger.info(message, ...args));
  }

  warn(message: string, ...args: any[]): void {
    this.loggers.forEach(logger => logger.warn(message, ...args));
  }

  error(message: string, ...args: any[]): void {
    this.loggers.forEach(logger => logger.error(message, ...args));
  }

  trackException(error: MastraError): void {
    this.loggers.forEach(logger => logger.trackException(error));
  }

  getTransports(): Map<string, LoggerTransport> {
    const transports: [string, LoggerTransport][] = [];
    this.loggers.forEach(logger => transports.push(...logger.getTransports().entries()));
    return new Map(transports);
  }

  async getLogs(
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
      const logs = await logger.getLogs(transportId, params);
      if (logs.total > 0) {
        return logs;
      }
    }

    return { logs: [], total: 0, page: params?.page ?? 1, perPage: params?.perPage ?? 100, hasMore: false };
  }

  async getLogsByRunId(args: {
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
      const logs = await logger.getLogsByRunId(args);
      if (logs.total > 0) {
        return logs;
      }
    }

    return { logs: [], total: 0, page: args.page ?? 1, perPage: args.perPage ?? 100, hasMore: false };
  }
}
