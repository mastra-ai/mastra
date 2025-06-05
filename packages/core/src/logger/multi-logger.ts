import type { LogLevel } from './constants';
import type { IMastraLogger } from './logger';
import type { LoggerTransport } from './transport';

export class MultiLogger implements IMastraLogger {
  private loggers: IMastraLogger[];

  constructor(loggers: IMastraLogger[]) {
    this.loggers = loggers;
  }

  debug(message: string, ...args: any[]): void {
    this.loggers.forEach(logger => logger.debug(message, ...args));
  }

  info(message: string, ...args: any[]): void {
    this.loggers.forEach(logger => logger.info(message, ...args));
  }

  warn(message: string, ...args: any[]): void {
    this.loggers.forEach(logger => logger.warn(message, ...args));
  }

  error(message: string, ...args: any[]): void {
    this.loggers.forEach(logger => logger.error(message, ...args));
  }

  getTransports(): Map<string, LoggerTransport> {
    const transports: [string, LoggerTransport][] = [];
    this.loggers.forEach(logger => transports.push(...logger.getTransports().entries()));
    return new Map(transports);
  }

  async getLogs(
    transportId: string,
    params?: { fromDate?: Date; toDate?: Date; logLevel?: LogLevel; filters?: Record<string, any> },
  ) {
    for (const logger of this.loggers) {
      const logs = await logger.getLogs(transportId, params);
      if (logs.length > 0) {
        return logs;
      }
    }

    return [];
  }

  async getLogsByRunId(args: {
    transportId: string;
    runId: string;
    fromDate?: Date;
    toDate?: Date;
    logLevel?: LogLevel;
    filters?: Record<string, any>;
  }) {
    for (const logger of this.loggers) {
      const logs = await logger.getLogsByRunId(args);
      if (logs.length > 0) {
        return logs;
      }
    }

    return [];
  }
}
