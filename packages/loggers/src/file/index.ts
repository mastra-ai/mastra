import type { WriteStream } from 'node:fs';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { LoggerTransport } from '@mastra/core/logger';
import type { BaseLogMessage, LogLevel } from '@mastra/core/logger';

export class FileTransport extends LoggerTransport {
  path: string;
  fileStream: WriteStream;
  constructor({ path }: { path: string }) {
    super({ objectMode: true });
    this.path = path;

    if (!existsSync(this.path)) {
      console.info(this.path);
      throw new Error('File path does not exist');
    }

    this.fileStream = createWriteStream(this.path, { flags: 'a' });
  }

  _transform(chunk: any, _encoding: string, callback: (error: Error | null, chunk: any) => void) {
    try {
      this.fileStream.write(chunk);
    } catch (error) {
      console.error('Error parsing log entry:', error);
    }
    callback(null, chunk);
  }

  _flush(callback: Function) {
    // End the file stream when transform stream ends
    this.fileStream.end(() => {
      callback();
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

  // Clean up resources
  _destroy(error: Error, callback: Function) {
    if (this.fileStream) {
      this.fileStream.destroy(error);
    }
    callback(error);
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
      return await this.#queryLogs(params || {});
    } catch (error) {
      console.error('Error getting logs from file:', error);
      return { logs: [], total: 0, page: 0, perPage: 0, hasMore: false };
    }
  }

  async listLogsByRunId({
    runId,
    fromDate,
    toDate,
    logLevel,
    filters,
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
    try {
      return await this.#queryLogs({ runId, fromDate, toDate, logLevel, filters, page, perPage });
    } catch (error) {
      console.error('Error getting logs by runId from file:', error);
      return { logs: [], total: 0, page: 0, perPage: 0, hasMore: false };
    }
  }

  /**
   * Streams the log file line by line, counting every matching record but
   * retaining only the requested page (or all matches when pagination is off).
   */
  async #queryLogs({
    runId,
    fromDate,
    toDate,
    logLevel,
    filters,
    returnPaginationResults = true,
    page: pageInput,
    perPage: perPageInput,
  }: {
    runId?: string;
    fromDate?: Date;
    toDate?: Date;
    logLevel?: LogLevel;
    filters?: Record<string, any>;
    returnPaginationResults?: boolean;
    page?: number;
    perPage?: number;
  }) {
    const page = pageInput === 0 ? 1 : (pageInput ?? 1);
    const perPage = (perPageInput ?? 100) || 100;
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const filterEntries = Object.entries(filters ?? {});

    const logs: BaseLogMessage[] = [];
    let total = 0;

    const lines = createInterface({ input: createReadStream(this.path, 'utf8'), crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line.trim()) continue;

      let log: any;
      try {
        log = JSON.parse(line);
      } catch {
        continue;
      }

      if (log === null || typeof log !== 'object') continue;
      if (runId !== undefined && log.runId !== runId) continue;
      if (!filterEntries.every(([key, value]) => log[key] === value)) continue;
      if (logLevel && log.level !== logLevel) continue;
      if (fromDate && !(new Date(log.time).getTime() >= fromDate.getTime())) continue;
      if (toDate && !(new Date(log.time).getTime() <= toDate.getTime())) continue;

      if (!returnPaginationResults || (total >= start && total < end)) {
        logs.push(log);
      }
      total++;
    }

    if (!returnPaginationResults) {
      return { logs, total, page, perPage: total, hasMore: false };
    }

    return { logs, total, page, perPage, hasMore: end < total };
  }
}
