import { Redis } from '@upstash/redis';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

// Constants and Types
export const RegisteredLogger = {
  AGENT: 'AGENT',
  WORKFLOW: 'WORKFLOW',
} as const;

export type RegisteredLogger =
  (typeof RegisteredLogger)[keyof typeof RegisteredLogger];

export const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

// Base Interfaces
export interface BaseLogMessage {
  message: string;
  destinationPath: string;
  type: RegisteredLogger;
}

export interface Logger<T extends BaseLogMessage = BaseLogMessage> {
  debug(message: T | string, ...args: any[]): void | Promise<void>;
  info(message: T | string, ...args: any[]): void | Promise<void>;
  warn(message: T | string, ...args: any[]): void | Promise<void>;
  error(message: T | string, ...args: any[]): void | Promise<void>;
  cleanup?(): Promise<void>;
}

// Configuration Types
export type LoggerConfig =
  | { type: 'CONSOLE'; level?: LogLevel }
  | { type: 'FILE'; level?: LogLevel; dirPath?: string }
  | {
      type: 'UPSTASH';
      level?: LogLevel;
      url: string;
      token: string;
      key?: string;
    };

// Abstract Base Logger
export abstract class BaseLogger<T extends BaseLogMessage = BaseLogMessage>
  implements Logger<T>
{
  protected level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  abstract log(
    level: LogLevel,
    message: T | string,
    ...args: any[]
  ): void | Promise<void>;

  debug(message: T | string, ...args: any[]): void | Promise<void> {
    if (this.level <= LogLevel.DEBUG) {
      return this.log(LogLevel.DEBUG, message, ...args);
    }
  }

  info(message: T | string, ...args: any[]): void | Promise<void> {
    if (this.level <= LogLevel.INFO) {
      return this.log(LogLevel.INFO, message, ...args);
    }
  }

  warn(message: T | string, ...args: any[]): void | Promise<void> {
    if (this.level <= LogLevel.WARN) {
      return this.log(LogLevel.WARN, message, ...args);
    }
  }

  error(message: T | string, ...args: any[]): void | Promise<void> {
    if (this.level <= LogLevel.ERROR) {
      return this.log(LogLevel.ERROR, message, ...args);
    }
  }

  protected formatMessage(message: T | string): string {
    if (typeof message === 'string') {
      return message;
    }
    return JSON.stringify(message);
  }

  protected formatLogEntry(level: LogLevel, message: T | string): any {
    return {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message: this.formatMessage(message),
    };
  }
}

// Console Logger Implementation
class ConsoleLogger<
  T extends BaseLogMessage = BaseLogMessage
> extends BaseLogger<T> {
  constructor(level?: LogLevel) {
    super(level ?? LogLevel.INFO);
  }

  log(level: LogLevel, message: T | string, ...args: any[]): void {
    const logEntry = this.formatLogEntry(level, message);
    console.log(
      `[${logEntry.timestamp}] [${logEntry.level}] ${logEntry.message}`,
      ...args
    );
  }
}

// File Logger Implementation
class FileLogger<
  T extends BaseLogMessage = BaseLogMessage
> extends BaseLogger<T> {
  #dirPath: string;

  constructor(dirPath: string = 'logs', level?: LogLevel) {
    super(level ?? LogLevel.INFO);
    this.#dirPath = dirPath;
  }

  log(level: LogLevel, message: T): void {
    if (typeof message === 'string') {
      throw new Error('FileLogger requires a BaseLogMessage object');
    }

    const fullPath = path.join(
      this.#dirPath,
      `${message.destinationPath}.json`
    );

    this.ensureDirectoryExists();
    this.writeLogToFile(fullPath, level, message);
  }

  private ensureDirectoryExists(): void {
    if (!existsSync(this.#dirPath)) {
      mkdirSync(this.#dirPath, { recursive: true });
    }
  }

  private writeLogToFile(fullPath: string, level: LogLevel, message: T): void {
    const logEntry = {
      ...message,
      level: LogLevel[level],
      createdAt: new Date(),
    };

    let logs = [];
    if (existsSync(fullPath)) {
      logs = JSON.parse(readFileSync(fullPath, 'utf-8'));
    }

    logs.push(logEntry);
    writeFileSync(fullPath, JSON.stringify(logs, null, 2));
  }
}

// Upstash Redis Logger Implementation
class UpstashRedisLogger<
  T extends BaseLogMessage = BaseLogMessage
> extends BaseLogger<T> {
  #redis: Redis;
  #key: string;

  constructor(redis: Redis, key: string = 'logs', level?: LogLevel) {
    super(level ?? LogLevel.INFO);
    this.#redis = redis;
    this.#key = key;
  }

  async log(level: LogLevel, message: T): Promise<void> {
    if (typeof message === 'string') {
      throw new Error('UpstashRedisLogger requires a BaseLogMessage object');
    }

    const logEntry = {
      ...message,
      level: LogLevel[level],
      createdAt: new Date(),
    };

    await this.#redis.lpush(this.#key, JSON.stringify(logEntry));
  }

  async getLogs(): Promise<string[]> {
    return this.#redis.lrange(this.#key, 0, -1);
  }

  async cleanup(): Promise<void> {
    // Cleanup Redis connection if needed
  }
}

// Multi Logger Implementation
export class MultiLogger<T extends BaseLogMessage = BaseLogMessage>
  implements Logger<T>
{
  private loggers: Logger<T>[];

  constructor(loggers: Logger<T>[]) {
    this.loggers = loggers;
  }

  async debug(message: T | string, ...args: any[]): Promise<void> {
    await Promise.all(
      this.loggers.map((logger) => logger.debug(message, ...args))
    );
  }

  async info(message: T | string, ...args: any[]): Promise<void> {
    await Promise.all(
      this.loggers.map((logger) => logger.info(message, ...args))
    );
  }

  async warn(message: T | string, ...args: any[]): Promise<void> {
    await Promise.all(
      this.loggers.map((logger) => logger.warn(message, ...args))
    );
  }

  async error(message: T | string, ...args: any[]): Promise<void> {
    await Promise.all(
      this.loggers.map((logger) => logger.error(message, ...args))
    );
  }

  async cleanup(): Promise<void> {
    await Promise.all(
      this.loggers.map(async (logger) => {
        if (logger.cleanup) {
          await logger.cleanup();
        }
      })
    );
  }
}

// Factory function for built-in loggers
// In createLogger function
export function createLogger<T extends BaseLogMessage = BaseLogMessage>(
  config: LoggerConfig
): Logger<T> {
  switch (config.type) {
    case 'CONSOLE':
      return new ConsoleLogger<T>(config.level);

    case 'FILE':
      return new FileLogger<T>(config.dirPath, config.level);

    case 'UPSTASH':
      const redis = new Redis({
        url: config.url,
        token: config.token,
      });
      return new UpstashRedisLogger<T>(redis, config.key, config.level);

    default:
      throw new Error(`Unsupported logger type`);
  }
}

export function createMultiLogger<T extends BaseLogMessage = BaseLogMessage>(
  loggers: Logger<T>[]
): Logger<T> {
  return new MultiLogger<T>(loggers);
}
