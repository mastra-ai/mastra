import { LoggerTransport } from '@mastra/core/logger';
import type { BaseLogMessage, LogLevel } from '@mastra/core/logger';

const SCAN_CHUNK_SIZE = 1000;

type LogCriteria = {
  fromDate?: Date;
  toDate?: Date;
  logLevel?: LogLevel;
  filters?: Record<string, any>;
  runId?: string;
};

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

  async _flush() {
    if (this.logBuffer.length === 0) {
      return;
    }

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

  private matchesLog(log: BaseLogMessage, { fromDate, toDate, logLevel, filters, runId }: LogCriteria): boolean {
    if (runId !== undefined && log.runId !== runId) return false;
    if (logLevel && log.level !== logLevel) return false;
    const logTime = new Date(log.time).getTime();
    if (fromDate && !(logTime >= fromDate.getTime())) return false;
    if (toDate && !(logTime <= toDate.getTime())) return false;

    return !filters || Object.entries(filters).every(([key, value]) => log[key as keyof BaseLogMessage] === value);
  }

  /**
   * Reads the list in bounded LRANGE windows, counting every match but keeping
   * only those inside `window` (or all matches when `window` is null).
   */
  private async scanLogs(
    criteria: LogCriteria,
    window: { start: number; end: number } | null,
  ): Promise<{ logs: BaseLogMessage[]; total: number }> {
    const logs: BaseLogMessage[] = [];
    let total = 0;

    for (let offset = 0; ; offset += SCAN_CHUNK_SIZE) {
      const response = await this.executeUpstashCommands([
        ['LRANGE', this.listName, offset, offset + SCAN_CHUNK_SIZE - 1],
      ]);
      const chunk = response?.[0]?.result;

      for (const log of this.parseLogs(chunk)) {
        if (!this.matchesLog(log, criteria)) continue;
        if (!window || (total >= window.start && total < window.end)) logs.push(log);
        total++;
      }

      if (!Array.isArray(chunk) || chunk.length < SCAN_CHUNK_SIZE) break;
    }

    return { logs, total };
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

      const criteria = { fromDate, toDate, logLevel, filters };

      if (!returnPaginationResults) {
        const { logs, total } = await this.scanLogs(criteria, null);
        return {
          logs,
          total,
          page,
          perPage: logs.length,
          hasMore: false,
        };
      }

      const start = (page - 1) * perPage;
      const end = start + perPage;
      const { logs, total } = await this.scanLogs(criteria, { start, end });

      return {
        logs,
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

      const start = (page - 1) * perPage;
      const end = start + perPage;
      const { logs, total } = await this.scanLogs({ fromDate, toDate, logLevel, filters, runId }, { start, end });

      return {
        logs,
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
