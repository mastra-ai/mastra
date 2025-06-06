import type { MastraError } from '../error';
import { LogLevel } from './constants';
import type { BaseLogMessage, LoggerTransport } from './transport';

export interface IMastraLogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  trackException(error: MastraError): void;

  getTransports(): Map<string, LoggerTransport>;
  getLogs(
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
  getLogsByRunId(_args: {
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

  trackException(_error: MastraError) {}

  async getLogs(
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
      this.transports.get(transportId)!.getLogs(params) ?? {
        logs: [],
        total: 0,
        page: params?.page ?? 1,
        perPage: params?.perPage ?? 100,
        hasMore: false,
      }
    );
  }

  async getLogsByRunId({
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
        .getLogsByRunId({ runId, fromDate, toDate, logLevel, filters, page, perPage }) ?? {
        logs: [],
        total: 0,
        page: page ?? 1,
        perPage: perPage ?? 100,
        hasMore: false,
      }
    );
  }
}
