import { LoggerTransport } from '@mastra/core/logger';
import type { BaseLogMessage } from '@mastra/core/logger';
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';

export class RedisCloudTransport extends LoggerTransport {
  redisUrl: string;
  listName: string;
  maxListLength: number;
  batchSize: number;
  flushInterval: number;
  logBuffer: any[];
  lastFlush: number;
  flushIntervalId: NodeJS.Timeout;
  ttl: number;
  client: RedisClientType;

  constructor(opts: {
    listName?: string;
    maxListLength?: number;
    batchSize?: number;
    redisUrl: string;
    flushInterval?: number;
    ttl?: number;
  }) {
    super({ objectMode: true });

    if (!opts.redisUrl) {
      throw new Error('Redis URL is required');
    }

    this.redisUrl = opts.redisUrl;
    this.client = createClient({ url: this.redisUrl });
    this.listName = opts.listName || 'application-logs';
    this.maxListLength = opts.maxListLength || 10000;
    this.batchSize = opts.batchSize || 100;
    this.flushInterval = opts.flushInterval || 10000;
    this.ttl = opts.ttl || 2 * 24 * 60 * 60; // 2 days in seconds

    this.logBuffer = [];
    this.lastFlush = Date.now();

    // Start flush interval
    this.flushIntervalId = setInterval(() => {
      this._flush().catch(err => {
        console.error('Error flushing logs to redis:', err);
      });
    }, this.flushInterval);
  }

  async _flush() {
    if (this.logBuffer.length === 0) {
      return;
    }

    const now = Date.now();
    const logs = this.logBuffer.splice(0, this.batchSize);

    process.nextTick(async () => {
      try {
        if (!this.client.isOpen) {
          await this.client.connect().catch(err => {
            console.error('Redis connection error:', err);
          });
        }

        const pipeline = this.client.multi();
        pipeline.lPush(
          this.listName,
          logs.map(log => JSON.stringify(log)),
        );

        if (this.maxListLength > 0) {
          pipeline.lTrim(this.listName, 0, this.maxListLength - 1);
        }

        pipeline.expire(this.listName, this.ttl);
        await pipeline.exec();

        this.lastFlush = now;
      } catch (error) {
        this.logBuffer.unshift(...logs);
        throw error;
      }
    });
  }

  _write(chunk: any, encoding?: string, callback?: (error?: Error | null) => void): boolean {
    if (typeof callback === 'function') {
      this._transform(chunk, encoding || 'utf8', callback);
      return true;
    }

    this._transform(chunk, encoding || 'utf8', (error: Error | null) => {
      if (error) console.error('Transform error in write:', error);
    });
    return true;
  }

  _transform(chunk: string, _enc: string, cb: Function) {
    try {
      const log = typeof chunk === 'string' ? JSON.parse(chunk) : chunk;

      if (!log.time) {
        log.time = Date.now();
      }

      // Add to buffer
      this.logBuffer.push(log);

      // Flush if buffer reaches batch size
      if (this.logBuffer.length >= this.batchSize) {
        this._flush().catch(err => {
          console.error('Error flushing logs to Redis:', err);
        });
      }

      // Pass through the log
      cb(null, chunk);
    } catch (error) {
      cb(error);
    }
  }

  _destroy(err: Error, cb: Function) {
    clearInterval(this.flushIntervalId);

    const finalize = () => {
      // Close Redis connection after flushing
      if (this.client.isOpen) {
        this.client
          .quit()
          .then(() => cb(err))
          .catch(quitErr => {
            console.error('Error closing Redis connection:', quitErr);
            cb(err || quitErr);
          });
      } else {
        cb(err);
      }
    };

    // Final flush if needed
    if (this.logBuffer.length > 0) {
      this._flush()
        .then(finalize)
        .catch(flushErr => {
          console.error('Error in final flush:', flushErr);
          // Still try to close the connection even if flush fails
          finalize();
        });
    } else {
      finalize();
    }
  }

  async getLogs(): Promise<BaseLogMessage[]> {
    try {
      // Get all logs from the list
      const response = await this.client.lRange(this.listName, 0, -1);

      // Parse the logs from JSON strings back to objects
      return response?.map((log: string) => {
        try {
          return JSON.parse(log);
        } catch {
          return '';
        }
      }) as BaseLogMessage[];
    } catch (error) {
      console.error('Error getting logs from Redis:', error);
      return [];
    }
  }

  async getLogsByRunId({ runId }: { runId: string }): Promise<BaseLogMessage[]> {
    try {
      const allLogs = await this.getLogs();
      const logs = (allLogs.filter((log: any) => log.runId === runId) || []) as BaseLogMessage[];
      return logs;
    } catch (error) {
      console.error('Error getting logs by runId from Redis:', error);
      return [] as BaseLogMessage[];
    }
  }
}
