import type { BaseLogMessage } from './types';

export interface BaseLogger {
  debug(message: string, args?: Record<string, any>): void;
  info(message: string, args?: Record<string, any>): void;
  warn(message: string, args?: Record<string, any>): void;
  error(message: string, args?: Record<string, any>): void;

  getLogsByRunId(args: { runId: string; transportId: string }): Promise<BaseLogMessage[]>;
  getLogs(transportId: string): Promise<BaseLogMessage[]>;
}
