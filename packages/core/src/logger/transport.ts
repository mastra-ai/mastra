import { Transform } from 'stream';
import type { LogLevel } from './constants';

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
