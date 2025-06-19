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
  lastFlush: number;
  flushIntervalId: NodeJS.Timeout;

  constructor(opts: {
    listName?: string;
    maxListLength?: number;
    batchSize?: number;
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
    this.batchSize = opts.batchSize || 100;
    this.flushInterval = opts.flushInterval || 10000;

    this.logBuffer = [];
    this.lastFlush = Date.now();

    // Start flush interval
    this.flushIntervalId = setInterval(() => {
      this._flush().catch(err => {
        console.error('Error flushing logs to Upstash:', err);
      });
    }, this.flushInterval);
  }

  private async executeUpstashCommand(command: any[]): Promise<any> {
    const response = await fetch(`${this.upstashUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.upstashToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([command]),
    });

    if (!response.ok) {
      throw new Error(`Failed to execute Upstash command: ${response.statusText}`);
    }

    return response.json();
  }

  async _flush() {
    if (this.logBuffer.length === 0) {
      return;
    }

    const now = Date.now();
    const logs = this.logBuffer.splice(0, this.batchSize);

    try {
      // Prepare the Upstash Redis command
      const command = ['LPUSH', this.listName, ...logs.map(log => JSON.stringify(log))];

      // Trim the list if it exceeds maxListLength
      if (this.maxListLength > 0) {
        command.push('LTRIM', this.listName, 0 as any, (this.maxListLength - 1) as any);
      }

      // Send logs to Upstash Redis
      await this.executeUpstashCommand(command);
      this.lastFlush = now;
    } catch (error) {
      // On error, put logs back in the buffer
      this.logBuffer.unshift(...logs);
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

      // Flush if buffer reaches batch size
      if (this.logBuffer.length >= this.batchSize) {
        this._flush().catch(err => {
          console.error('Error flushing logs to Upstash:', err);
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

    // Final flush
    if (this.logBuffer.length > 0) {
      this._flush()
        .then(() => cb(err))
        .catch(flushErr => {
          console.error('Error in final flush:', flushErr);
          cb(err || flushErr);
        });
    } else {
      cb(err);
    }
  }

  async getLogs(params?: {
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
      // Get all logs from the list
      const command = ['LRANGE', this.listName, 0, -1];
      const response = await this.executeUpstashCommand(command);

      const logs =
        (response?.[0]?.result?.map((log: string) => {
          try {
            // Parse the logs from JSON strings back to objects
            return JSON.parse(log);
          } catch {
            return {};
          }
        }) as BaseLogMessage[]) || [];

      let filteredLogs = logs.filter(record => record !== null && typeof record === 'object');

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
      const perPage = perPageInput ?? 100;
      const returnPaginationResults = returnPaginationResultsInput ?? true;

      if (filters) {
        filteredLogs = filteredLogs.filter(log =>
          Object.entries(filters || {}).every(([key, value]) => log[key as keyof BaseLogMessage] === value),
        );
      }

      if (logLevel) {
        filteredLogs = filteredLogs.filter(log => log.level === logLevel);
      }

      if (fromDate) {
        filteredLogs = filteredLogs.filter(log => new Date(log.time)?.getTime() >= fromDate!.getTime());
      }

      if (toDate) {
        filteredLogs = filteredLogs.filter(log => new Date(log.time)?.getTime() <= toDate!.getTime());
      }

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
      const resolvedPerPage = perPage || 100;
      const start = (page - 1) * resolvedPerPage;
      const end = start + resolvedPerPage;
      const paginatedLogs = filteredLogs.slice(start, end);
      const hasMore = end < total;

      return {
        logs: paginatedLogs,
        total,
        page,
        perPage: resolvedPerPage,
        hasMore,
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

  async getLogsByRunId({
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
      const perPage = perPageInput ?? 100;
      const allLogs = await this.getLogs({ fromDate, toDate, logLevel, filters, returnPaginationResults: false });
      const logs = (allLogs?.logs?.filter((log: any) => log.runId === runId) || []) as BaseLogMessage[];
      const total = logs.length;
      const resolvedPerPage = perPage || 100;
      const start = (page - 1) * resolvedPerPage;
      const end = start + resolvedPerPage;
      const paginatedLogs = logs.slice(start, end);
      const hasMore = end < total;

      return {
        logs: paginatedLogs,
        total,
        page,
        perPage: resolvedPerPage,
        hasMore,
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
