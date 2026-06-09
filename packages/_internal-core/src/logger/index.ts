import { Transform } from 'node:stream';

export const RegisteredLogger = {
  AGENT: 'AGENT',
  OBSERVABILITY: 'OBSERVABILITY',
  AUTH: 'AUTH',
  BROWSER: 'BROWSER',
  NETWORK: 'NETWORK',
  WORKFLOW: 'WORKFLOW',
  LLM: 'LLM',
  TTS: 'TTS',
  VOICE: 'VOICE',
  VECTOR: 'VECTOR',
  BUNDLER: 'BUNDLER',
  DEPLOYER: 'DEPLOYER',
  MEMORY: 'MEMORY',
  STORAGE: 'STORAGE',
  EMBEDDINGS: 'EMBEDDINGS',
  MCP_SERVER: 'MCP_SERVER',
  SERVER_CACHE: 'SERVER_CACHE',
  SERVER: 'SERVER',
  WORKSPACE: 'WORKSPACE',
  CHANNEL: 'CHANNEL',
} as const;

export type RegisteredLogger = (typeof RegisteredLogger)[keyof typeof RegisteredLogger];

export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  NONE: 'silent',
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

export interface BaseLogMessage {
  runId?: string;
  msg: string;
  level: LogLevel;
  time: Date;
  pid: number;
  hostname: string;
  name: string;
}

export abstract class LoggerTransport extends Transform {
  constructor(opts: any = {}) {
    super({ ...opts, objectMode: true });
  }

  async listLogsByRunId(_args: {
    runId: string;
    fromDate?: Date;
    toDate?: Date;
    logLevel?: LogLevel;
    filters?: Record<string, any>;
    page?: number;
    perPage?: number;
  }): Promise<{
    logs: BaseLogMessage[];
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  }> {
    return { logs: [], total: 0, page: _args?.page ?? 1, perPage: _args?.perPage ?? 100, hasMore: false };
  }

  async listLogs(_args?: {
    fromDate?: Date;
    toDate?: Date;
    logLevel?: LogLevel;
    filters?: Record<string, any>;
    returnPaginationResults?: boolean;
    page?: number;
    perPage?: number;
  }): Promise<{
    logs: BaseLogMessage[];
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  }> {
    return { logs: [], total: 0, page: _args?.page ?? 1, perPage: _args?.perPage ?? 100, hasMore: false };
  }
}

export const createCustomTransport = (
  stream: Transform,
  listLogs?: LoggerTransport['listLogs'],
  listLogsByRunId?: LoggerTransport['listLogsByRunId'],
) => {
  let transport = stream as LoggerTransport;
  if (listLogs) {
    transport.listLogs = listLogs;
  }
  if (listLogsByRunId) {
    transport.listLogsByRunId = listLogsByRunId;
  }
  return transport as LoggerTransport;
};

export interface IMastraLogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  trackException(error: Error, metadata?: Record<string, unknown>): void;

  getTransports(): Map<string, LoggerTransport>;
  listLogs(
    _transportId: string,
    _params?: {
      fromDate?: Date;
      toDate?: Date;
      logLevel?: LogLevel;
      filters?: Record<string, any>;
      page?: number;
      perPage?: number;
    },
  ): Promise<{ logs: BaseLogMessage[]; total: number; page: number; perPage: number; hasMore: boolean }>;
  listLogsByRunId(_args: {
    transportId: string;
    runId: string;
    fromDate?: Date;
    toDate?: Date;
    logLevel?: LogLevel;
    filters?: Record<string, any>;
    page?: number;
    perPage?: number;
  }): Promise<{ logs: BaseLogMessage[]; total: number; page: number; perPage: number; hasMore: boolean }>;
}

export abstract class MastraLogger implements IMastraLogger {
  protected name: string;
  protected level: LogLevel;
  protected transports: Map<string, LoggerTransport>;

  constructor(
    options: {
      name?: string;
      level?: LogLevel;
      transports?: Record<string, LoggerTransport>;
    } = {},
  ) {
    this.name = options.name || 'Mastra';
    this.level = options.level || LogLevel.ERROR;
    this.transports = new Map(Object.entries(options.transports || {}));
  }

  abstract debug(message: string, ...args: any[]): void;
  abstract info(message: string, ...args: any[]): void;
  abstract warn(message: string, ...args: any[]): void;
  abstract error(message: string, ...args: any[]): void;

  getTransports() {
    return this.transports;
  }

  trackException(_error: Error, _metadata?: Record<string, unknown>) {}

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
  ) {
    if (!transportId || !this.transports.has(transportId)) {
      return { logs: [], total: 0, page: params?.page ?? 1, perPage: params?.perPage ?? 100, hasMore: false };
    }

    return (
      this.transports.get(transportId)!.listLogs?.(params) ?? {
        logs: [],
        total: 0,
        page: params?.page ?? 1,
        perPage: params?.perPage ?? 100,
        hasMore: false,
      }
    );
  }

  async listLogsByRunId({
    transportId,
    runId,
    fromDate,
    toDate,
    logLevel,
    filters,
    page,
    perPage,
  }: {
    transportId: string;
    runId: string;
    fromDate?: Date;
    toDate?: Date;
    logLevel?: LogLevel;
    filters?: Record<string, any>;
    page?: number;
    perPage?: number;
  }) {
    if (!transportId || !this.transports.has(transportId) || !runId) {
      return { logs: [], total: 0, page: page ?? 1, perPage: perPage ?? 100, hasMore: false };
    }

    return (
      this.transports
        .get(transportId)!
        .listLogsByRunId?.({ runId, fromDate, toDate, logLevel, filters, page, perPage }) ?? {
        logs: [],
        total: 0,
        page: page ?? 1,
        perPage: perPage ?? 100,
        hasMore: false,
      }
    );
  }
}

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
      console.warn(`${this.prefix()}${message}`, ...args);
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
