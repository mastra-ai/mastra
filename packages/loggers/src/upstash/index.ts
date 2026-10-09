import { LoggerTransport } from '@mastra/core/logger';
import type { BaseLogMessage, LogLevel } from '@mastra/core/logger';

export class UpstashTransport extends LoggerTransport {
  upstashUrl: string;
  upstashToken: string;
  listName: string;
  maxListLength: number;
  batchSize: number;
  flushInterval: number;
  logBuffer: any[];
  private maxBufferSize: number;
  private droppedLogCount = 0;
  private flushPromise: Promise<void> | null = null;
  private flushRequested = false;
  lastFlush: number;
  flushIntervalId: NodeJS.Timeout;

  constructor(opts: {
    listName?: string;
    maxListLength?: number;
    batchSize?: number;
    maxBufferSize?: number;
    upstashUrl: string;
    flushInterval?: number;
    upstashToken: string;
  }) {
    super({ objectMode: true });

    if (!opts.upstashUrl || !opts.upstashToken) {
      throw new Error('Upstash URL and token are required');
    }

    this.upstashUrl = opts.upstashUrl;
    this.upstashToken = opts.upstashToken;
    this.listName = opts.listName || 'application-logs';
    this.maxListLength = opts.maxListLength || 10000;
    this.batchSize = opts.batchSize ?? 100;
    this.flushInterval = opts.flushInterval || 10000;

    if (!Number.isInteger(this.batchSize) || this.batchSize < 1) {
      throw new Error('UpstashTransport batchSize must be a positive integer');
    }

    const maxBufferSize = opts.maxBufferSize ?? 10_000;
    if (!Number.isInteger(maxBufferSize) || maxBufferSize < 1) {
      throw new Error('UpstashTransport maxBufferSize must be a positive integer');
    }
    this.maxBufferSize = Math.max(maxBufferSize, this.batchSize);

    this.logBuffer = [];
    this.lastFlush = Date.now();

    // Start flush interval
    this.flushIntervalId = setInterval(() => this.requestFlush(), this.flushInterval);
  }

  private async executeUpstashCommands(commands: any[][]): Promise<any> {
    const response = await fetch(`${this.upstashUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.upstashToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    });

    if (!response.ok) {
      throw new Error(`Failed to execute Upstash command: ${response.statusText}`);
    }

    return response.json();
  }

  private enforceBufferLimit(): void {
    const overflow = this.logBuffer.length - this.maxBufferSize;
    if (overflow <= 0) {
      return;
    }

    this.logBuffer.splice(0, overflow);
    if (this.droppedLogCount === 0) {
      console.warn(
        `UpstashTransport: buffer exceeded maxBufferSize (${this.maxBufferSize}); dropping oldest logs. Use getDroppedLogCount() to track drops.`,
      );
    }
    this.droppedLogCount += overflow;
  }

  private requestFlush(): void {
    if (this.flushPromise) {
      this.flushRequested = true;
      return;
    }
    this._flush().catch(err => {
      console.error('Error flushing logs to Upstash:', err);
    });
  }

  _flush(): Promise<void> {
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
    flush.then(
      () => {
        if (this.logBuffer.length >= this.batchSize || (this.flushRequested && this.logBuffer.length > 0)) {
          this.requestFlush();
        }
      },
      () => {
        // The caller or requestFlush handles the rejected flush.
      },
    );
    return flush;
  }

  private async flushBatch(): Promise<void> {
    const now = Date.now();
    const logs = this.logBuffer.splice(0, this.batchSize);

    try {
      const commands: any[][] = [['LPUSH', this.listName, ...logs.map(log => JSON.stringify(log))]];

      // Trim the list if it exceeds maxListLength (must be a separate pipeline command)
      if (this.maxListLength > 0) {
        commands.push(['LTRIM', this.listName, 0, this.maxListLength - 1]);
      }

      await this.executeUpstashCommands(commands);
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

  _transform(chunk: string, _enc: string, cb: Function) {
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

  _destroy(err: Error, cb: Function) {
    clearInterval(this.flushIntervalId);

    // Final flush
    if (this.logBuffer.length > 0) {
      this.drainBuffer()
        .then(() => cb(err))
        .catch(flushErr => {
          console.error('Error in final flush:', flushErr);
          cb(err || flushErr);
        });
    } else {
      cb(err);
    }
  }

  private async drainBuffer(): Promise<void> {
    while (this.logBuffer.length > 0) {
      await this._flush();
    }
  }

  public getDroppedLogCount(): number {
    return this.droppedLogCount;
  }

  private parseLogs(logs: unknown): BaseLogMessage[] {
    if (!Array.isArray(logs)) return [];

    return logs.flatMap((log: string) => {
      try {
        const parsedLog = JSON.parse(log);
        return parsedLog !== null && typeof parsedLog === 'object' ? [parsedLog] : [];
      } catch {
        return [{} as BaseLogMessage];
      }
    });
  }

  private matchesLog(
    log: BaseLogMessage,
    {
      fromDate,
      toDate,
      logLevel,
      filters,
      runId,
    }: {
      fromDate?: Date;
      toDate?: Date;
      logLevel?: LogLevel;
      filters?: Record<string, any>;
      runId?: string;
    },
  ): boolean {
    if (runId !== undefined && log.runId !== runId) return false;
    if (logLevel && log.level !== logLevel) return false;
    const logTime = new Date(log.time).getTime();
    if (fromDate && !(logTime >= fromDate.getTime())) return false;
    if (toDate && !(logTime <= toDate.getTime())) return false;

    return !filters || Object.entries(filters).every(([key, value]) => log[key as keyof BaseLogMessage] === value);
  }

  async listLogs(params?: {
    fromDate?: Date;
    toDate?: Date;
    logLevel?: LogLevel;
    filters?: Record<string, any>;
    returnPaginationResults?: boolean; // default true
    page?: number;
    perPage?: number;
  }): Promise<{
    logs: BaseLogMessage[];
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  }> {
    try {
      const {
        fromDate,
        toDate,
        logLevel,
        filters,
        returnPaginationResults: returnPaginationResultsInput,
        page: pageInput,
        perPage: perPageInput,
      } = params || {};

      const page = pageInput === 0 ? 1 : (pageInput ?? 1);
      const perPage = perPageInput || 100;
      const returnPaginationResults = returnPaginationResultsInput ?? true;
      const hasFilters = Boolean(fromDate || toDate || logLevel || (filters && Object.keys(filters).length > 0));

      if (returnPaginationResults && !hasFilters) {
        const start = (page - 1) * perPage;
        const end = start + perPage;
        const response = await this.executeUpstashCommands([
          ['LLEN', this.listName],
          ['LRANGE', this.listName, start, end - 1],
        ]);
        const total = Number(response?.[0]?.result) || 0;
        const logs = this.parseLogs(response?.[1]?.result);

        return {
          logs,
          total,
          page,
          perPage,
          hasMore: end < total,
        };
      }

      const response = await this.executeUpstashCommands([['LRANGE', this.listName, 0, -1]]);
      const filteredLogs = this.parseLogs(response?.[0]?.result).filter(log =>
        this.matchesLog(log, { fromDate, toDate, logLevel, filters }),
      );

      if (!returnPaginationResults) {
        return {
          logs: filteredLogs,
          total: filteredLogs.length,
          page,
          perPage: filteredLogs.length,
          hasMore: false,
        };
      }

      const total = filteredLogs.length;
      const start = (page - 1) * perPage;
      const end = start + perPage;

      return {
        logs: filteredLogs.slice(start, end),
        total,
        page,
        perPage,
        hasMore: end < total,
      };
    } catch (error) {
      console.error('Error getting logs from Upstash:', error);
      return {
        logs: [],
        total: 0,
        page: params?.page ?? 1,
        perPage: params?.perPage ?? 100,
        hasMore: false,
      };
    }
  }

  async listLogsByRunId({
    runId,
    fromDate,
    toDate,
    logLevel,
    filters,
    page: pageInput,
    perPage: perPageInput,
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
    try {
      const page = pageInput === 0 ? 1 : (pageInput ?? 1);
      const perPage = perPageInput || 100;

      const allLogs = await this.listLogs({ fromDate, toDate, logLevel, filters, returnPaginationResults: false });
      const logs = allLogs.logs.filter(log => this.matchesLog(log, { runId }));
      const total = logs.length;
      const start = (page - 1) * perPage;
      const end = start + perPage;

      return {
        logs: logs.slice(start, end),
        total,
        page,
        perPage,
        hasMore: end < total,
      };
    } catch (error) {
      console.error('Error getting logs by runId from Upstash:', error);
      return {
        logs: [],
        total: 0,
        page: pageInput ?? 1,
        perPage: perPageInput ?? 100,
        hasMore: false,
      };
    }
  }
}
