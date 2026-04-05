import { LogLevel } from './constants';
import type { RegisteredLogger } from './constants';
import { MastraLogger } from './logger';
import type { LoggerTransport } from './transport';

export const createLogger = (options: {
  name?: string;
  level?: LogLevel;
  transports?: Record<string, LoggerTransport>;
}) => {
  const logger = new ConsoleLogger(options);

  logger.warn('createLogger is deprecated. Please use "new ConsoleLogger()" from "@mastra/core/logger" instead.');

  return logger;
};

export type LogFilterContext = {
  component?: RegisteredLogger;
  level: LogLevel;
  message: string;
  args: unknown[];
};

export type LogFilter = (ctx: LogFilterContext) => boolean;

export interface ConsoleLoggerOptions {
  name?: string;
  level?: LogLevel;
  component?: RegisteredLogger;
  filter?: LogFilter;
}

export class ConsoleLogger extends MastraLogger {
  protected component?: RegisteredLogger;
  protected filter?: LogFilter;

  constructor(options: ConsoleLoggerOptions = {}) {
    super(options);
    this.component = options.component;
    this.filter = options.filter;
  }

  child(componentOrBindings: RegisteredLogger | Record<string, unknown>): ConsoleLogger {
    const component =
      typeof componentOrBindings === 'string'
        ? componentOrBindings
        : ((componentOrBindings?.component as RegisteredLogger) ?? this.component);
    return new ConsoleLogger({
      name: this.name,
      level: this.level,
      component,
      filter: this.filter,
    });
  }

  private shouldLog(level: LogLevel, message: string, args: unknown[]): boolean {
    if (!this.filter) return true;
    try {
      return this.filter({ component: this.component, level, message, args });
    } catch (e) {
      // Filter threw - log the error and allow the message through to avoid breaking logging
      console.error(`[Logger] Filter error for component=${this.component} level=${level}:`, e);
      return true;
    }
  }

  private prefix(): string {
    return this.component ? `[${this.component}] ` : '';
  }

  debug(message: string, ...args: any[]): void {
    if (this.level === LogLevel.DEBUG && this.shouldLog(LogLevel.DEBUG, message, args)) {
      console.info(`${this.prefix()}${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (
      (this.level === LogLevel.INFO || this.level === LogLevel.DEBUG) &&
      this.shouldLog(LogLevel.INFO, message, args)
    ) {
      console.info(`${this.prefix()}${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (
      (this.level === LogLevel.WARN || this.level === LogLevel.INFO || this.level === LogLevel.DEBUG) &&
      this.shouldLog(LogLevel.WARN, message, args)
    ) {
      console.info(`${this.prefix()}${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (
      (this.level === LogLevel.ERROR ||
        this.level === LogLevel.WARN ||
        this.level === LogLevel.INFO ||
        this.level === LogLevel.DEBUG) &&
      this.shouldLog(LogLevel.ERROR, message, args)
    ) {
      console.error(`${this.prefix()}${message}`, ...args);
    }
  }

  async listLogs(
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

  async listLogsByRunId(_args: {
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
