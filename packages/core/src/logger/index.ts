import pino from 'pino';
import pretty from 'pino-pretty';
import { Transform } from 'stream';

import type { Run } from '../run/types';

// Constants and Types (keeping from original implementation)
export const RegisteredLogger = {
  AGENT: 'AGENT',
  WORKFLOW: 'WORKFLOW',
  LLM: 'LLM',
  TTS: 'TTS',
  VOICE: 'VOICE',
  VECTOR: 'VECTOR',
  BUNDLER: 'BUNDLER',
  DEPLOYER: 'DEPLOYER',
  MEMORY: 'MEMORY',
  STORAGE: 'STORAGE',
  EMBEDDINGS: 'EMBEDDINGS',
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

export type TransportMap = Record<string, LoggerTransport>;

// Base Pino Logger
export class Logger {
  protected logger: pino.Logger;
  transports: TransportMap;

  constructor(
    options: {
      name?: string;
      level?: LogLevel;
      transports?: TransportMap;
      overrideDefaultTransports?: boolean;
    } = {},
  ) {
    this.transports = options.transports || {};

    // Create Pino logger with multiple streams
    const transportsAry = Object.entries(this.transports);
    this.logger = pino(
      {
        name: options.name || 'app',
        level: options.level || LogLevel.INFO,
      },
      options.overrideDefaultTransports
        ? options?.transports?.default
        : transportsAry.length === 0
          ? pretty({
              colorize: true,
              levelFirst: true,
              ignore: 'pid,hostname',
              colorizeObjects: true,
              translateTime: 'SYS:standard',
              singleLine: false,
            })
          : pino.multistream([
              ...transportsAry.map(([_, transport]) => ({
                stream: transport,
                level: options.level || LogLevel.INFO,
              })),
              {
                stream: pretty({
                  colorize: true,
                  levelFirst: true,
                  ignore: 'pid,hostname',
                  colorizeObjects: true,
                  translateTime: 'SYS:standard',
                  singleLine: false,
                }),
                level: options.level || LogLevel.INFO,
              },
            ]),
    );
  }

  debug(message: string, args: Record<string, any> = {}): void {
    this.logger.debug(args, message);
  }

  info(message: string, args: Record<string, any> = {}): void {
    this.logger.info(args, message);
  }

  warn(message: string, args: Record<string, any> = {}): void {
    this.logger.warn(args, message);
  }

  error(message: string, args: Record<string, any> = {}): void {
    this.logger.error(args, message);
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
export function createLogger(options: { name?: string; level?: LogLevel; transports?: TransportMap }) {
  return new Logger(options);
}

// Multi-logger implementation for handling multiple loggers
export class MultiLogger {
  private loggers: Logger[];

  constructor(loggers: Logger[]) {
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
export function combineLoggers(loggers: Logger[]): MultiLogger {
  return new MultiLogger(loggers);
}

// No-op logger implementation
export const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  cleanup: async () => {},
};
