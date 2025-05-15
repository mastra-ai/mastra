import type { Topic } from '@google-cloud/pubsub';
import { PubSub } from '@google-cloud/pubsub';
import { LoggerTransport } from '@mastra/core/logger';
// import type { BaseLogMessage } from '@mastra/core/logger';

export class PubSubTransport extends LoggerTransport {
  topicName: string;
  logBuffer: any[];
  lastFlush: number;
  flushIntervalId: NodeJS.Timeout;
  batchSize: number;
  pubsub: PubSub;
  topic: Topic;
  attributes?: Record<string, string>;
  constructor(opts: {
    maxListLength?: number;
    batchSize?: number;
    gcpProjectId: string;
    gcpServiceAccountKey?: string;
    attributes?: Record<string, string>;
    topicName: string;
    flushInterval?: number;
  }) {
    super({ objectMode: true });

    if (!opts.gcpProjectId || !opts.topicName) {
      throw new Error('Project ID and topic name are required');
    }

    this.topicName = opts.topicName;
    this.pubsub = new PubSub({
      projectId: opts.gcpProjectId,
      keyFilename: opts.gcpServiceAccountKey,
    });

    this.topic = this.pubsub.topic(this.topicName, {
      batching: {
        maxMessages: opts.batchSize,
        maxMilliseconds: opts.flushInterval,
      },
    });

    this.batchSize = opts.batchSize || 100;

    this.logBuffer = [];
    this.lastFlush = Date.now();
    this.attributes = opts.attributes;

    this.flushIntervalId = setInterval(() => {
      this._flush().catch(err => {
        console.error('Error flushing logs to redis:', err);
      });
    }, opts.flushInterval);
  }

  async _flush() {
    if (this.logBuffer.length === 0) {
      return;
    }

    const now = Date.now();
    const logs = this.logBuffer.splice(0, this.batchSize);

    process.nextTick(async () => {
      try {
        // if (!this.client.isOpen) {
        //   await this.client.connect().catch(err => {
        //     console.error('Redis connection error:', err);
        //   });
        // }

        this.topic.publishMessage({ json: logs, attributes: this.attributes }, err => {
          if (err) {
            console.error('Error publishing logs to Pub/Sub:', err);
            this.logBuffer.unshift(...logs);
          }

          this.lastFlush = now;
        });

        // topic.publishb({ data: logs.map(log => JSON.stringify(log)) });

        // // const pipeline = this.client.multi();
        // // pipeline.lPush(
        // //   this.listName,
        // //   logs.map(log => JSON.stringify(log)),
        // // );

        // if (this.maxListLength > 0) {
        //   pipeline.lTrim(this.listName, 0, this.maxListLength - 1);
        // }

        // pipeline.expire(this.listName, this.ttl);
        // await pipeline.exec();

        // this.lastFlush = now;
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

    // Final flush if needed
    if (this.logBuffer.length > 0) {
      this._flush()
        .then(() => this.pubsub.close())
        .catch(flushErr => {
          console.error('Error in final flush:', flushErr);
          // Still try to close the connection even if flush fails
          this.pubsub.close().catch(err => {
            console.error('Error closing Pub/Sub connection:', err);
          });
          cb(err || flushErr);
        });
    } else {
      this.pubsub.close().catch(err => {
        console.error('Error closing Pub/Sub connection:', err);
      });
      cb(err);
    }
  }

  // async getLogs(): Promise<BaseLogMessage[]> {
  //   try {
  //     // Get all logs from the list
  //     const response = await this.client.lRange(this.listName, 0, -1);

  //     // Parse the logs from JSON strings back to objects
  //     return response?.map((log: string) => {
  //       try {
  //         return JSON.parse(log);
  //       } catch {
  //         return '';
  //       }
  //     }) as BaseLogMessage[];
  //   } catch (error) {
  //     console.error('Error getting logs from Redis:', error);
  //     return [];
  //   }
  // }

  // async getLogsByRunId({ runId }: { runId: string }): Promise<BaseLogMessage[]> {
  //   try {
  //     const allLogs = await this.getLogs();
  //     const logs = (allLogs.filter((log: any) => log.runId === runId) || []) as BaseLogMessage[];
  //     return logs;
  //   } catch (error) {
  //     console.error('Error getting logs by runId from Redis:', error);
  //     return [] as BaseLogMessage[];
  //   }
  // }
}
