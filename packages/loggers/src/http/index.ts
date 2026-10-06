import { LoggerTransport } from '@mastra/core/logger';
import type { BaseLogMessage, LogLevel } from '@mastra/core/logger';

interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  exponentialBackoff?: boolean;
}

interface HttpTransportOptions {
  url: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  batchSize?: number;
  flushInterval?: number;
  timeout?: number;
  retryOptions?: RetryOptions;
  maxBufferSize?: number;
}

export class HttpTransport extends LoggerTransport {
  private url: string;
  private method: string;
  private headers: Record<string, string>;
  private batchSize: number;
  private flushInterval: number;
  private timeout: number;
  private retryOptions: Required<RetryOptions>;
  private logBuffer: BaseLogMessage[];
  private maxBufferSize: number;
  private droppedLogCount = 0;
  private flushPromise: Promise<void> | null = null;
  private flushRequested = false;
  private lastFlush: number;
  private flushIntervalId: NodeJS.Timeout;

  constructor(options: HttpTransportOptions) {
    super({ objectMode: true });

    if (!options.url) {
      throw new Error('HTTP URL is required');
    }

    this.url = options.url;
    this.method = options.method || 'POST';
    this.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    this.batchSize = options.batchSize ?? 100;
    this.flushInterval = options.flushInterval || 10000;
    this.timeout = options.timeout || 30000;
    this.retryOptions = {
      maxRetries: options.retryOptions?.maxRetries ?? 3,
      retryDelay: options.retryOptions?.retryDelay ?? 1000,
      exponentialBackoff: options.retryOptions?.exponentialBackoff ?? true,
    };

    if (!Number.isInteger(this.batchSize) || this.batchSize < 1) {
      throw new Error('HttpTransport batchSize must be a positive integer');
    }

    const maxBufferSize = options.maxBufferSize ?? 10_000;
    if (!Number.isInteger(maxBufferSize) || maxBufferSize < 1) {
      throw new Error('HttpTransport maxBufferSize must be a positive integer');
    }
    this.maxBufferSize = Math.max(maxBufferSize, this.batchSize);
    this.logBuffer = [];
    this.lastFlush = Date.now();

    // Start flush interval
    this.flushIntervalId = setInterval(() => this.requestFlush(), this.flushInterval);
  }

  private async makeHttpRequest(data: any, retryCount = 0): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const body = JSON.stringify({ logs: data });

      const response = await fetch(this.url, {
        method: this.method,
        headers: this.headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (retryCount < this.retryOptions.maxRetries) {
        const delay = this.retryOptions.exponentialBackoff
          ? this.retryOptions.retryDelay * Math.pow(2, retryCount)
          : this.retryOptions.retryDelay;

        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeHttpRequest(data, retryCount + 1);
      }

      throw error;
    }
  }

  private enforceBufferLimit(): void {
    const overflow = this.logBuffer.length - this.maxBufferSize;
    if (overflow <= 0) {
      return;
    }

    this.logBuffer.splice(0, overflow);
    if (this.droppedLogCount === 0) {
      console.warn(
        `HttpTransport: buffer exceeded maxBufferSize (${this.maxBufferSize}); dropping oldest logs. Use getDroppedLogCount() to track drops.`,
      );
    }
    this.droppedLogCount += overflow;
  }

  // Internal fire-and-forget flush. While a request is in flight this only records the request, so writes
  // during a slow or retrying request don't each attach another handler to the pending promise.
  private requestFlush(): void {
    if (this.flushPromise) {
      this.flushRequested = true;
      return;
    }
    this._flush().catch(err => {
      console.error('Error flushing logs to HTTP endpoint:', err);
    });
  }

  _flush(): Promise<void> {
    // Only one request in flight at a time, so an outage doesn't fan out into overlapping retry chains.
    if (this.flushPromise) {
      this.flushRequested = true;
      return this.flushPromise;
    }
    if (this.logBuffer.length === 0) {
      return Promise.resolve();
    }

    this.flushRequested = false;
    const flush = this.flushBatch().finally(() => {
      this.flushPromise = null;
    });
    this.flushPromise = flush;
    // Flushes requested while this request was in flight only got this promise back, so send their logs now,
    // and keep draining full batches. On failure, wait for the next interval instead of retrying straight away.
    flush.then(
      () => {
        if (this.logBuffer.length >= this.batchSize || (this.flushRequested && this.logBuffer.length > 0)) {
          this.requestFlush();
        }
      },
      () => {},
    );
    return flush;
  }

  private async flushBatch(): Promise<void> {
    const now = Date.now();
    const logs = this.logBuffer.splice(0, this.batchSize);

    try {
      await this.makeHttpRequest(logs);
      this.lastFlush = now;
    } catch (error) {
      // On error, put logs back in the buffer
      this.logBuffer.unshift(...logs);
      this.enforceBufferLimit();
      throw error;
    }
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

  _transform(chunk: string, _enc: string, cb: Function): void {
    try {
      // Parse the log line if it's a string
      const log = typeof chunk === 'string' ? JSON.parse(chunk) : chunk;

      // Add timestamp if not present
      if (!log.time) {
        log.time = Date.now();
      }

      // Add to buffer
      this.logBuffer.push(log);
      this.enforceBufferLimit();

      // Flush if buffer reaches batch size
      if (this.logBuffer.length >= this.batchSize) {
        this.requestFlush();
      }

      // Pass through the log
      cb(null, chunk);
    } catch (error) {
      cb(error);
    }
  }

  _destroy(err: Error, cb: Function): void {
    clearInterval(this.flushIntervalId);

    // Final drain. Wait out any in-flight request (ignoring its failure, since its logs are back in the buffer),
    // then keep sending until the buffer is empty. A failed request ends the drain instead of retrying forever.
    if (this.logBuffer.length > 0 || this.flushPromise) {
      const drain = async () => {
        await this.flushPromise?.catch(() => {});
        while (this.flushPromise || this.logBuffer.length > 0) {
          await (this.flushPromise ?? this._flush());
        }
      };

      drain()
        .then(() => cb(err))
        .catch(flushErr => {
          console.error('Error in final flush:', flushErr);
          cb(err || flushErr);
        });
    } else {
      cb(err);
    }
  }

  async listLogs(params?: {
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
    // HttpTransport is write-only by default
    // Subclasses can override this method to implement log retrieval
    console.warn(
      'HttpTransport.listLogs: This transport is write-only. Override this method to implement log retrieval.',
    );

    return {
      logs: [],
      total: 0,
      page: params?.page ?? 1,
      perPage: params?.perPage ?? 100,
      hasMore: false,
    };
  }

  async listLogsByRunId({
    runId: _runId,
    fromDate: _fromDate,
    toDate: _toDate,
    logLevel: _logLevel,
    filters: _filters,
    page,
    perPage,
  }: {
    runId: string;
    fromDate?: Date;
    toDate?: Date;
    logLevel?: LogLevel;
    filters?: Record<string, any>;
    page?: number;
    perPage?: number;
  }): Promise<{
    logs: BaseLogMessage[];
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  }> {
    // HttpTransport is write-only by default
    // Subclasses can override this method to implement log retrieval
    console.warn(
      'HttpTransport.listLogsByRunId: This transport is write-only. Override this method to implement log retrieval.',
    );

    return {
      logs: [],
      total: 0,
      page: page ?? 1,
      perPage: perPage ?? 100,
      hasMore: false,
    };
  }

  // Utility methods
  public getBufferedLogs(): BaseLogMessage[] {
    return [...this.logBuffer];
  }

  public clearBuffer(): void {
    this.logBuffer = [];
  }

  public getDroppedLogCount(): number {
    return this.droppedLogCount;
  }

  public getLastFlushTime(): number {
    return this.lastFlush;
  }
}
