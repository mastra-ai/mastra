import { Transform } from 'stream';
import pino from 'pino';
import pretty from 'pino-pretty';
import type { BaseLogger } from './base-logger';
import type { TransportMap } from './transport';
import { LogLevel } from './types';

// Base Pino Logger
export class Logger implements BaseLogger {
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
        formatters: {
          level: label => {
            return {
              level: label,
            };
          },
        },
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
    return this.transports[transportId]?.getLogsByRunId({ runId }) ?? [];
  }
}

// Factory function for creating loggers
export function createLogger(options: { name?: string; level?: LogLevel; transports?: TransportMap }) {
  return new Logger(options);
}
