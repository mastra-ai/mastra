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

  async getLogsByRunId(_args: {
    runId: string;
    fromDate?: Date;
    toDate?: Date;
    logLevel?: LogLevel;
    filters?: Record<string, any>;
  }): Promise<BaseLogMessage[]> {
    return [];
  }
  async getLogs(_args?: {
    fromDate?: Date;
    toDate?: Date;
    logLevel?: LogLevel;
    filters?: Record<string, any>;
  }): Promise<BaseLogMessage[]> {
    return [];
  }
}
