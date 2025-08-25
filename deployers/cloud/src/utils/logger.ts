import type { TransformCallback } from 'stream';
import type { BaseLogMessage, LogLevel } from '@mastra/core/logger';
import { LoggerTransport } from '@mastra/core/logger';
import { PinoLogger } from '@mastra/loggers';
import { createClient } from 'redis';
import { BUILD_ID, LOG_REDIS_URL, PROJECT_ID, TEAM_ID } from './constants.js';

const redisClient = createClient({
  url: LOG_REDIS_URL,
});

class RedisTransport extends LoggerTransport {
  _transform(chunk: any, _encoding: string, callback: TransformCallback): void {
    chunk = chunk.toString();
    const logKey = `builder:logs:${TEAM_ID}:${PROJECT_ID}:${BUILD_ID}`;
    const ttl = 2 * 24 * 60 * 60; // 2 days in seconds
    const logData = typeof chunk === 'string' ? chunk : JSON.stringify(chunk);

    // Don't block the event loop - process logs asynchronously
    process.nextTick(async () => {
      try {
        // Connect to Redis if not already connected
        if (!redisClient.isOpen) {
          await redisClient.connect().catch(err => {
            console.error('Redis connection error:', err);
          });
        }

        // Use pipeline to batch Redis operations
        const pipeline = redisClient.multi();
        pipeline.rPush(logKey, logData);
        pipeline.expire(logKey, ttl);
        await pipeline.exec();
      } catch (err) {
        console.error('Redis logging error:', err);
      }
    });

    // Immediately pass through the chunk without waiting
    callback(null, chunk);
  }

  _write(chunk: any, encoding?: string, callback?: (error?: Error | null) => void): boolean {
    if (typeof callback === 'function') {
      this._transform(chunk, encoding || 'utf8', callback);
      return true;
    }

    this._transform(chunk, encoding || 'utf8', (error: Error | null | undefined) => {
      if (error) console.error('Transform error in write:', error);
    });
    return true;
  }

  async _flush(): Promise<void> {
    // // Ensure the pipeline is closed and flushed
    // redisClient.quit().catch(err => {
    //   console.error('Redis connection error:', err);
    // });
    // callback();
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  async _destroy(err: Error, cb: Function) {
    await closeLogger();
    cb(err);
  }

  getLogs(_args: {
    fromDate?: Date;
    toDate?: Date;
    logLevel?: LogLevel;
    filters?: Record<string, any>;
    returnPaginationResults?: boolean;
    page?: number;
    perPage?: number;
  }): Promise<{ logs: BaseLogMessage[]; total: number; page: number; perPage: number; hasMore: boolean }> {
    return Promise.resolve({
      logs: [],
      total: 0,
      page: _args?.page ?? 1,
      perPage: _args?.perPage ?? 100,
      hasMore: false,
    });
  }

  getLogsByRunId(_args?: {
    fromDate?: Date;
    toDate?: Date;
    logLevel?: LogLevel;
    filters?: Record<string, any>;
    returnPaginationResults?: boolean;
    page?: number;
    perPage?: number;
  }): Promise<{
    logs: BaseLogMessage[];
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  }> {
    return Promise.resolve({
      logs: [],
      total: 0,
      page: _args?.page ?? 1,
      perPage: _args?.perPage ?? 100,
      hasMore: false,
    });
  }
}

export const transport = new RedisTransport();

export const closeLogger = async () => {
  if (redisClient.isOpen) {
    setTimeout(async () => {
      await redisClient.quit();
    }, 10);
  }
};

export const logger = new PinoLogger({
  level: 'info',
  transports: {
    redis: transport,
  },
});
