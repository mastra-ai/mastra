import type { BaseLogger } from './base-logger';

export class MultiLogger {
  private loggers: BaseLogger[];

  constructor(loggers: BaseLogger[]) {
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
}

// Utility function to combine multiple loggers
export function combineLoggers(loggers: BaseLogger[]): MultiLogger {
  return new MultiLogger(loggers);
}
