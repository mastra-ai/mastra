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

export interface ConsoleLoggerOptions {
  name?: string;
  level?: LogLevel;
  component?: RegisteredLogger;
  components?: RegisteredLogger[];
}

export class ConsoleLogger extends MastraLogger {
  protected component?: RegisteredLogger;
  protected components?: RegisteredLogger[];

  constructor(options: ConsoleLoggerOptions = {}) {
    super(options);
    this.component = options.component;
    this.components = options.components;
  }

  child(component: RegisteredLogger): ConsoleLogger {
    return new ConsoleLogger({
      name: this.name,
      level: this.level,
      component,
      components: this.components,
    });
  }

  private shouldLog(): boolean {
    if (!this.components || this.components.length === 0) return true;
    if (!this.component) return true;
    return this.components.includes(this.component);
  }

  private prefix(): string {
    return this.component ? `[${this.component}] ` : '';
  }

  debug(message: string, ...args: any[]): void {
    if (this.level === LogLevel.DEBUG && this.shouldLog()) {
      console.info(`${this.prefix()}${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if ((this.level === LogLevel.INFO || this.level === LogLevel.DEBUG) && this.shouldLog()) {
      console.info(`${this.prefix()}${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (
      (this.level === LogLevel.WARN || this.level === LogLevel.INFO || this.level === LogLevel.DEBUG) &&
      this.shouldLog()
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
      this.shouldLog()
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
