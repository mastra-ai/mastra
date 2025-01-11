import { Redis } from '@upstash/redis';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

import { Run } from '../run/types';

// Constants and Types
export const RegisteredLogger = {
  AGENT: 'AGENT',
  WORKFLOW: 'WORKFLOW',
  LLM: 'LLM',
  TTS: 'TTS',
} as const;

export type RegisteredLogger = (typeof RegisteredLogger)[keyof typeof RegisteredLogger];

export const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  NONE: 'NONE',
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

// Base Interfaces
export interface BaseLogMessage extends Run {
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

type ConsoleLoggerConfig = { type: 'CONSOLE'; level?: LogLevel };
type FileLoggerConfig = { type: 'FILE'; level?: LogLevel; dirPath?: string };
type UpstashLoggerConfig = {
  type: 'UPSTASH';
  level?: LogLevel;
  url: string;
  token: string;
  key?: string;
};

type LoggerConfig = ConsoleLoggerConfig | FileLoggerConfig | UpstashLoggerConfig;

type LoggerTypeMap = {
  CONSOLE: ConsoleLogger<BaseLogMessage>;
  FILE: FileLogger<BaseLogMessage>;
  UPSTASH: UpstashRedisLogger<BaseLogMessage>;
};

// Abstract Base Logger
export abstract class BaseLogger<T extends BaseLogMessage = BaseLogMessage> implements Logger<T> {
  protected level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  abstract log(level: LogLevel, message: T | string, ...args: any[]): void | Promise<void>;

  debug(message: T | string, ...args: any[]): void | Promise<void> {
    if (this.level === LogLevel.DEBUG) {
      return this.log(LogLevel.DEBUG, message, ...args);
    }
  }

  info(message: T | string, ...args: any[]): void | Promise<void> {
    if ([LogLevel.INFO, LogLevel.DEBUG, LogLevel.ERROR].includes(this.level as any) && this.level !== LogLevel.NONE) {
      return this.log(LogLevel.INFO, message, ...args);
    }
  }

  warn(message: T | string, ...args: any[]): void | Promise<void> {
    if ([LogLevel.WARN, LogLevel.ERROR, LogLevel.DEBUG].includes(this.level as any) && this.level !== LogLevel.NONE) {
      return this.log(LogLevel.WARN, message, ...args);
    }
  }

  error(message: T | string, ...args: any[]): void | Promise<void> {
    if (
      [LogLevel.ERROR, LogLevel.INFO, LogLevel.WARN, LogLevel.DEBUG].includes(this.level as any) &&
      this.level !== LogLevel.NONE
    ) {
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

  async getLogsByRunId(runId: string): Promise<T[]> {
    console.warn(`getLogsByRunId ${runId} not implemented for ${this.constructor.name}`);
    return [];
  }

  async getLogs(): Promise<string[]> {
    console.warn(`getLogs not implemented for ${this.constructor.name}`);
    return [];
  }
}

// Console Logger Implementation
export class ConsoleLogger<T extends BaseLogMessage = BaseLogMessage> extends BaseLogger<T> {
  private logs: { timestamp: string; level: string; message: string; runId?: string }[] = [];
  // private originalConsoleLog: typeof console.log;

  constructor(level?: LogLevel) {
    super(level ?? LogLevel.INFO);
    // Store original console.log and bind it
    // this.originalConsoleLog = console.log.bind(console);
  }

  log(level: LogLevel, message: T | string, ...args: any[]): void {
    let runId: string | undefined;
    if (typeof message !== 'string') {
      runId = message.runId;
    }

    const logEntry = this.formatLogEntry(level, message);
    const logMessage = `[${logEntry.timestamp}] [${logEntry.level}] ${logEntry.message}`;

    // Store the log message
    this.logs.push({ ...logEntry, runId });

    console.log(logMessage, ...args);
  }

  async getLogs(): Promise<string[]> {
    return this.logs?.map(log => `[${log.timestamp}] [${log.level}] ${log.message}`) || [];
  }

  async getLogsByRunId(runId: string): Promise<T[]> {
    return (this.logs?.filter(log => log.runId === runId) as unknown as T[]) || [];
  }
}

// File Logger Implementation
export class FileLogger<T extends BaseLogMessage = BaseLogMessage> extends BaseLogger<T> {
  #dirPath: string;

  constructor(dirPath: string = 'logs', level?: LogLevel) {
    super(level ?? LogLevel.INFO);
    this.#dirPath = dirPath;
  }

  log(level: LogLevel, message: T): void {
    if (typeof message === 'string') {
      throw new Error('FileLogger requires a BaseLogMessage object');
    }

    const fullPath = path.join(this.#dirPath, `${message.destinationPath}.json`);

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
export class UpstashRedisLogger<T extends BaseLogMessage = BaseLogMessage> extends BaseLogger<T> {
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
      runId: message.runId,
    };

    const runKey = `${this.#key}:run:${message.runId}`;

    if (message.runId) {
      await Promise.all([
        this.#redis.lpush(this.#key, JSON.stringify(logEntry)),
        this.#redis.lpush(runKey, JSON.stringify(logEntry)),
      ]);
    } else {
      await this.#redis.lpush(this.#key, JSON.stringify(logEntry));
    }
  }

  async getLogs(): Promise<string[]> {
    return this.#redis.lrange(this.#key, 0, -1);
  }

  async deleteLogsByKey(key: string): Promise<void> {
    await this.#redis.del(key);
  }

  async getLogsByRunId(runId: string): Promise<T[]> {
    if (!runId) {
      throw new Error('runId is required');
    }

    try {
      const runKey = `${this.#key}:run:${runId}`;
      const logs = await this.#redis.lrange(runKey, 0, -1);

      return logs.reduce((acc: T[], logStr: string) => {
        try {
          const log = typeof logStr === 'string' ? JSON.parse(logStr) : logStr;
          if (log && typeof log === 'object' && log.runId === runId) {
            acc.push(log as T);
          }
        } catch (parseError) {
          if (typeof logStr === 'string') {
            console.error(`Failed to parse log entry: ${logStr}`, parseError);
          }
        }
        return acc;
      }, []);
    } catch (error) {
      console.error(`Failed to fetch logs for runId ${runId}:`, error);
      return [];
    }
  }

  async cleanup(): Promise<void> {
    // Cleanup Redis connection if needed
  }
}

// Multi Logger Implementation
export class MultiLogger<T extends BaseLogMessage = BaseLogMessage> implements Logger<T> {
  private loggers: Logger<T>[];

  constructor(loggers: Logger<T>[]) {
    this.loggers = loggers;
  }

  async debug(message: T | string, ...args: any[]): Promise<void> {
    await Promise.all(this.loggers.map(logger => logger.debug(message, ...args)));
  }

  async info(message: T | string, ...args: any[]): Promise<void> {
    await Promise.all(this.loggers.map(logger => logger.info(message, ...args)));
  }

  async warn(message: T | string, ...args: any[]): Promise<void> {
    await Promise.all(this.loggers.map(logger => logger.warn(message, ...args)));
  }

  async error(message: T | string, ...args: any[]): Promise<void> {
    await Promise.all(this.loggers.map(logger => logger.error(message, ...args)));
  }

  async cleanup(): Promise<void> {
    await Promise.all(
      this.loggers.map(async logger => {
        if (logger.cleanup) {
          await logger.cleanup();
        }
      }),
    );
  }
}

// Factory function for built-in loggers
// In createLogger function
export const createLogger = <Type extends LoggerConfig['type'], T extends BaseLogMessage = BaseLogMessage>(
  config: Extract<LoggerConfig, { type: Type }>,
): LoggerTypeMap[Type] => {
  switch (config.type) {
    case 'CONSOLE':
      return new ConsoleLogger<T>(config.level) as unknown as LoggerTypeMap[Type];
    case 'FILE': {
      const fileConfig = config as FileLoggerConfig;
      return new FileLogger<T>(fileConfig.dirPath, fileConfig.level) as unknown as LoggerTypeMap[Type];
    }
    case 'UPSTASH': {
      const upstashConfig = config as UpstashLoggerConfig;
      const redis = new Redis({
        url: upstashConfig.url,
        token: upstashConfig.token,
      });
      return new UpstashRedisLogger<T>(redis, upstashConfig.key, upstashConfig.level) as unknown as LoggerTypeMap[Type];
    }
    default: {
      const exhaustiveCheck: never = config.type;
      throw new Error(`Unsupported logger type: ${exhaustiveCheck}`);
    }
  }
};

export function combineLoggers<T extends BaseLogMessage = BaseLogMessage>(loggers: Logger<T>[]): Logger<T> {
  return new MultiLogger<T>(loggers);
}

export const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  cleanup: () => {},
};
