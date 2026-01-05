import type { MastraError } from '../error';
import { LogLevel } from './constants';
import type { AgentLogEvent, LogContext } from './events';
import type { BaseLogMessage, LoggerTransport } from './transport';

/**
 * Options for logging with correlation context
 */
export interface LogOptions {
  /** Correlation context for this log */
  context?: LogContext;
  /** Additional structured data */
  data?: Record<string, unknown>;
}

export interface IMastraLogger {
  // ---- Traditional logging methods ----
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  trackException(error: MastraError): void;

  // ---- Structured event logging ----
  /**
   * Log a structured event with full correlation context.
   * This is the preferred method for logging in agentic applications.
   */
  logEvent?(event: AgentLogEvent): void;

  /**
   * Log with correlation context attached.
   * Falls back to standard logging if context is not supported.
   */
  withContext?(context: LogContext): IMastraLogger;

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
  protected currentContext?: LogContext;

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

  trackException(_error: MastraError) {}

  /**
   * Log a structured event.
   * Default implementation converts to traditional log format.
   * Override in subclasses for full structured logging support.
   */
  logEvent(event: AgentLogEvent): void {
    const contextStr = this.formatContext(event.context);
    const dataStr = event.data ? ` ${JSON.stringify(event.data)}` : '';
    const message = `[${event.event}]${contextStr} ${event.message}${dataStr}`;

    switch (event.level) {
      case LogLevel.DEBUG:
        this.debug(message);
        break;
      case LogLevel.INFO:
        this.info(message);
        break;
      case LogLevel.WARN:
        this.warn(message);
        break;
      case LogLevel.ERROR:
        this.error(message);
        break;
    }
  }

  /**
   * Create a new logger instance with correlation context attached.
   * All logs from the returned logger will include this context.
   */
  withContext(context: LogContext): IMastraLogger {
    const contextualLogger = Object.create(this) as MastraLogger;
    contextualLogger.currentContext = { ...this.currentContext, ...context };
    return contextualLogger;
  }

  /**
   * Format context for traditional log output
   */
  protected formatContext(context: LogContext): string {
    const parts: string[] = [];
    if (context.traceId) parts.push(`trace=${context.traceId.slice(0, 8)}`);
    if (context.agentId) parts.push(`agent=${context.agentId}`);
    if (context.workflowId) parts.push(`workflow=${context.workflowId}`);
    if (context.runId) parts.push(`run=${context.runId.slice(0, 8)}`);
    if (context.threadId) parts.push(`thread=${context.threadId.slice(0, 8)}`);
    return parts.length > 0 ? ` [${parts.join(' ')}]` : '';
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
  ) {
    if (!transportId || !this.transports.has(transportId)) {
      return { logs: [], total: 0, page: params?.page ?? 1, perPage: params?.perPage ?? 100, hasMore: false };
    }

    return (
      this.transports.get(transportId)!.listLogs(params) ?? {
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
        .listLogsByRunId({ runId, fromDate, toDate, logLevel, filters, page, perPage }) ?? {
        logs: [],
        total: 0,
        page: page ?? 1,
        perPage: perPage ?? 100,
        hasMore: false,
      }
    );
  }
}
