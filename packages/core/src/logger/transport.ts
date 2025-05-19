import { Transform } from 'stream';

export interface BaseLogMessage {
  runId?: string;
  msg: string;
  level: number;
  time: Date;
  pid: number;
  hostname: string;
  name: string;
}

export type TransportMap = Record<string, LoggerTransport>;

export class LoggerTransport extends Transform {
  constructor(opts: any = {}) {
    super({ ...opts, objectMode: true });
  }

  async getLogsByRunId(_args: { runId: string }): Promise<BaseLogMessage[]> {
    return [];
  }
  async getLogs(): Promise<BaseLogMessage[]> {
    return [];
  }
}
