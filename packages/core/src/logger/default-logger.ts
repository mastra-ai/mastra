import { LogLevel } from './constants';
import { MastraLogger } from './logger';
import type { LoggerTransport } from './transport';

export const createLogger = (options: {
  name?: string;
  level?: LogLevel;
  transports?: Record<string, LoggerTransport>;
}) => {
  const logger = new ConsoleLogger(options);

  logger.warn(`createLogger is deprecated. Please use "new ConsoleLogger()" from "@mastra/core/logger" instead.`);

  return logger;
};

export class ConsoleLogger extends MastraLogger {
  constructor(
    options: {
      name?: string;
      level?: LogLevel;
    } = {},
  ) {
    super(options);
  }

  debug(message: string, ...args: any[]): void {
    if (this.level === LogLevel.DEBUG) {
      console.info(message, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level === LogLevel.INFO || this.level === LogLevel.DEBUG) {
      console.info(message, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level === LogLevel.WARN || this.level === LogLevel.INFO || this.level === LogLevel.DEBUG) {
      console.warn(message, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (
      this.level === LogLevel.ERROR ||
      this.level === LogLevel.WARN ||
      this.level === LogLevel.INFO ||
      this.level === LogLevel.DEBUG
    ) {
      console.error(message, ...args);
    }
  }

  async getLogs(
    _transportId: string,
    _params?: {
      fromDate?: Date;
      toDate?: Date;
      logLevel?: LogLevel;
      filters?: Record<string, any>;
      page?: number;
      perPage?: number;
    },
  ) {
    return { logs: [], total: 0, page: _params?.page ?? 1, perPage: _params?.perPage ?? 100, hasMore: false };
  }

  async getLogsByRunId(_args: {
    transportId: string;
    runId: string;
    fromDate?: Date;
    toDate?: Date;
    logLevel?: LogLevel;
    filters?: Record<string, any>;
    page?: number;
    perPage?: number;
  }) {
    return { logs: [], total: 0, page: _args.page ?? 1, perPage: _args.perPage ?? 100, hasMore: false };
  }
}
