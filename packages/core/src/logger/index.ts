import pino from 'pino';
import { Transform } from 'stream';

import { Run } from '../run/types';

// Constants and Types (keeping from original implementation)
export const RegisteredLogger = {
  AGENT: 'AGENT',
  WORKFLOW: 'WORKFLOW',
  LLM: 'LLM',
  TTS: 'TTS',
} as const;

export type RegisteredLogger = (typeof RegisteredLogger)[keyof typeof RegisteredLogger];

export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  NONE: 'silent',
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

// Base Interfaces
export interface BaseLogMessage extends Run {
  message: string;
  destinationPath: string;
  type: RegisteredLogger;
}

export class LoggerTransport extends Transform {
  async getLogsByRunId({ runId }: { runId: string }): Promise<BaseLogMessage[]> {
    console.log(runId);
    return [];
  }
  async getLogs(): Promise<BaseLogMessage[]> {
    return [];
  }
}

type TransportMap = Record<string, LoggerTransport>;

// Base Pino Logger
export class Logger<T extends BaseLogMessage = BaseLogMessage> {
  protected logger: pino.Logger;
  transports: TransportMap;

  constructor(
    options: {
      name?: string;
      level?: LogLevel;
      transports?: TransportMap;
    } = {},
  ) {
    this.transports = options.transports || {};

    // Create Pino logger with multiple streams
    this.logger = pino(
      {
        name: options.name || 'app',
        level: options.level || LogLevel.INFO,
      },
      pino.multistream([
        ...Object.entries(this.transports).map(([_, transport]) => ({
          stream: transport,
        })),
        { stream: pino.destination(1) }, // stdout
      ]),
    );
  }

  protected formatMessage(message: T | string): any {
    if (typeof message === 'string') {
      return message;
    }
    return {
      ...message,
    };
  }

  debug(message: T | string, args: Record<string, any> = {}): void {
    this.logger.debug(args, this.formatMessage(message));
  }

  info(message: T | string, args: Record<string, any> = {}): void {
    this.logger.info(args, this.formatMessage(message));
  }

  warn(message: T | string, args: Record<string, any> = {}): void {
    this.logger.warn(args, this.formatMessage(message));
  }

  error(message: T | string, args: Record<string, any> = {}): void {
    this.logger.error(args, this.formatMessage(message));
  }

  // Stream creation for process output handling
  createStream(): Transform {
    return new Transform({
      transform: (chunk, _encoding, callback) => {
        const line = chunk.toString().trim();
        if (line) {
          this.info(line);
        }
        callback(null, chunk);
      },
    });
  }

  async getLogs(transportId: string) {
    if (!transportId || !this.transports[transportId]) {
      return [];
    }
    return this.transports[transportId].getLogs();
  }

  async getLogsByRunId({ runId, transportId }: { transportId: string; runId: string }) {
    return this.transports[transportId]?.getLogsByRunId({ runId });
  }
}

// Factory function for creating loggers
export function createLogger<T extends BaseLogMessage = BaseLogMessage>(options: {
  name?: string;
  level?: LogLevel;
  transports?: TransportMap;
}) {
  return new Logger<T>(options);
}

// Multi-logger implementation for handling multiple loggers
export class MultiLogger<T extends BaseLogMessage = BaseLogMessage> {
  private loggers: Logger<T>[];

  constructor(loggers: Logger<T>[]) {
    this.loggers = loggers;
  }

  debug(message: T | string, ...args: any[]): void {
    this.loggers.forEach(logger => logger.debug(message, ...args));
  }

  info(message: T | string, ...args: any[]): void {
    this.loggers.forEach(logger => logger.info(message, ...args));
  }

  warn(message: T | string, ...args: any[]): void {
    this.loggers.forEach(logger => logger.warn(message, ...args));
  }

  error(message: T | string, ...args: any[]): void {
    this.loggers.forEach(logger => logger.error(message, ...args));
  }
}

// Utility function to combine multiple loggers
export function combineLoggers<T extends BaseLogMessage = BaseLogMessage>(loggers: Logger<T>[]): MultiLogger<T> {
  return new MultiLogger<T>(loggers);
}

// No-op logger implementation
export const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  cleanup: async () => {},
};
