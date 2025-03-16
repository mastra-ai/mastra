import { Transform } from 'stream';
import type { BaseLogMessage } from './types';

export abstract class LoggerTransport extends Transform {
  constructor(opts: any = {}) {
    super({ ...opts, objectMode: true });
  }

  abstract getLogsByRunId(args: { runId: string }): Promise<BaseLogMessage[]>;
  abstract getLogs(): Promise<BaseLogMessage[]>;
}

export type TransportMap = Record<string, LoggerTransport>;
