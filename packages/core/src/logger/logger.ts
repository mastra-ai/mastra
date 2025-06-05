import { LogLevel } from './constants';
import type { LoggerTransport } from './transport';

export interface IMastraLogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;

  getTransports(): Map<string, LoggerTransport>;
  getLogs(
    _transportId: string,
    _params?: { fromDate?: Date; toDate?: Date; logLevel?: LogLevel; filters?: Record<string, any> },
  ): Promise<any[]>;
  getLogsByRunId(_args: {
    transportId: string;
    runId: string;
    fromDate?: Date;
    toDate?: Date;
    logLevel?: LogLevel;
    filters?: Record<string, any>;
  }): Promise<any[]>;
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

  async getLogs(
    transportId: string,
    params?: { fromDate?: Date; toDate?: Date; logLevel?: LogLevel; filters?: Record<string, any> },
  ) {
    if (!transportId || !this.transports.has(transportId)) {
      return [];
    }

    return this.transports.get(transportId)!.getLogs(params) ?? [];
  }

  async getLogsByRunId({
    transportId,
    runId,
    fromDate,
    toDate,
    logLevel,
    filters,
  }: {
    transportId: string;
    runId: string;
    fromDate?: Date;
    toDate?: Date;
    logLevel?: LogLevel;
    filters?: Record<string, any>;
  }) {
    if (!transportId || !this.transports.has(transportId) || !runId) {
      return [];
    }

    return this.transports.get(transportId)!.getLogsByRunId({ runId, fromDate, toDate, logLevel, filters }) ?? [];
  }
}
