import { Redis } from '@upstash/redis';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

export const LogProvider = {
  CONSOLE: 'CONSOLE',
  FILE: 'FILE',
  UPSTASH: 'UPSTASH',
} as const;

export type LogConfig =
  | {
      provider: typeof LogProvider.CONSOLE;
      level?: LogLevel;
    }
  | {
      provider: typeof LogProvider.UPSTASH;
      level?: LogLevel;
      config: { url: string; token: string };
    }
  | {
      provider: typeof LogProvider.FILE;
      level?: LogLevel;
    };

export type LogProvider = (typeof LogProvider)[keyof typeof LogProvider];

export enum LogLevel {
  DEBUG,
  INFO,
  WARN,
  ERROR,
}

interface BaseLogMessage {
  message: string;
  destinationPath: string;
}

export interface Logger<T extends BaseLogMessage = BaseLogMessage> {
  debug(message: T | string, ...args: any[]): void;
  info(message: T | string, ...args: any[]): void;
  warn(message: T | string, ...args: any[]): void;
  error(message: T | string, ...args: any[]): void;
}

interface ConsoleLoggerOptions {
  level?: LogLevel;
}

interface FileLoggerOptions {
  dirPath: string;
  level?: LogLevel;
}

interface UpstashRedisLoggerOptions {
  redisClient: Redis;
  key: string;
  level?: LogLevel;
}

interface LoggerRegistry<T extends BaseLogMessage = BaseLogMessage> {
  [LogProvider.CONSOLE]: {
    logger: ConsoleLogger<T>;
    options: ConsoleLoggerOptions;
  };
  [LogProvider.FILE]: { logger: FileLogger<T>; options: FileLoggerOptions };
  [LogProvider.UPSTASH]: {
    logger: UpstashRedisLogger<T>;
    options: UpstashRedisLoggerOptions;
  };
}

// Abstract base class for loggers
abstract class BaseLogger<T extends BaseLogMessage = BaseLogMessage>
  implements Logger<T>
{
  protected level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  abstract log(level: LogLevel, message: T | string, ...args: any[]): void;

  debug(message: T | string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      this.log(LogLevel.DEBUG, message, ...args);
    }
  }

  info(message: T | string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      this.log(LogLevel.INFO, message, ...args);
    }
  }

  warn(message: T | string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      this.log(LogLevel.WARN, message, ...args);
    }
  }

  error(message: T | string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      this.log(LogLevel.ERROR, message, ...args);
    }
  }

  protected formatMessage(message: T | string): string {
    if (typeof message === 'string') {
      return message;
    }
    return JSON.stringify(message);
  }
}

/**
 * Logs to the console
 */
class ConsoleLogger<
  T extends BaseLogMessage = BaseLogMessage
> extends BaseLogger<T> {
  constructor({ level }: { level?: LogLevel }) {
    super(level ?? LogLevel.INFO);
  }

  log(level: LogLevel, message: T | string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] [${level}] ${this.formatMessage(message)}`,
      ...args
    );
  }
}

/**
 * Logs to a file
 */
class FileLogger<
  T extends BaseLogMessage = BaseLogMessage
> extends BaseLogger<T> {
  #dirPath: string;

  constructor({ dirPath, level }: { dirPath: string; level?: LogLevel }) {
    super(level ?? LogLevel.INFO);
    if (!dirPath) {
      throw new Error('File path is required');
    }
    this.#dirPath = dirPath;
  }

  log(level: LogLevel, message: T): void {
    const fullPath = path.join(
      this.#dirPath,
      `${message.destinationPath}.json`
    );
    console.log(`Logging to file: ${fullPath}`);

    if (!existsSync(this.#dirPath)) {
      mkdirSync(this.#dirPath, { recursive: true });
      return writeFileSync(
        fullPath,
        JSON.stringify([{ ...message, level, createdAt: new Date() }], null, 2)
      );
    }

    if (!existsSync(fullPath)) {
      return writeFileSync(
        fullPath,
        JSON.stringify([{ ...message, createdAt: new Date() }], null, 2)
      );
    }

    const logs = JSON.parse(readFileSync(fullPath, 'utf-8'));
    logs.push({ ...message, createdAt: new Date() });

    return writeFileSync(fullPath, JSON.stringify(logs, null, 2));
  }
}

/**
 * Logs to Upstash Redis
 */
class UpstashRedisLogger<
  T extends BaseLogMessage = BaseLogMessage
> extends BaseLogger<T> {
  #redisClient: Redis;
  #key: string;

  constructor({
    redisClient,
    level,
    key,
  }: {
    redisClient: Redis;
    level?: LogLevel;
    key: string;
  }) {
    super(level ?? LogLevel.INFO);
    if (!redisClient) {
      throw new Error('redisClient is required');
    }
    if (!key) {
      throw new Error('Redis storage key is required');
    }
    this.#redisClient = redisClient;
    this.#key = key;
  }

  log(level: LogLevel, message: T): void {
    const fullKey = path.join(this.#key, `${message.destinationPath}`);
    this.#redisClient.lpush(
      fullKey,
      JSON.stringify({ ...message, level, createdAt: new Date() })
    );
  }

  getLogs(key: string) {
    return this.#redisClient.lrange(key, 0, -1);
  }
}

export function createLogger<
  T extends BaseLogMessage = BaseLogMessage,
  K extends keyof LoggerRegistry<T> = keyof LoggerRegistry<T>
>({
  type,
  options,
}: {
  type: K;
  options?: LoggerRegistry[K]['options'];
}): LoggerRegistry<T>[K]['logger'] {
  switch (type) {
    case 'CONSOLE':
      return new ConsoleLogger<T>({ level: options?.level });
    case 'FILE':
      return new FileLogger<T>({
        dirPath: (options as FileLoggerOptions).dirPath,
        level: (options as FileLoggerOptions).level,
      });
    case 'UPSTASH':
      return new UpstashRedisLogger<T>({
        redisClient: (options as UpstashRedisLoggerOptions).redisClient,
        key: (options as UpstashRedisLoggerOptions).key,
        level: (options as UpstashRedisLoggerOptions).level,
      });
    default:
      throw new Error(`Unsupported logger type: ${type}`);
  }
}
