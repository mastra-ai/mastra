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

      const resolvedPerPage = perPage || 100;
      const start = (page - 1) * resolvedPerPage;
      const end = start + resolvedPerPage;
      const paginatedLogs: BaseLogMessage[] = [];
      let total = 0;

      const lines = createInterface({
        input: createReadStream(this.path, { encoding: 'utf8' }),
        crlfDelay: Infinity,
      });

      for await (const line of lines) {
        if (!line) continue;

        let log: BaseLogMessage;
        try {
          log = JSON.parse(line);
        } catch {
          continue;
        }

        if (log === null || typeof log !== 'object') continue;
        if (filters && !Object.entries(filters).every(([key, value]) => log[key as keyof BaseLogMessage] === value)) {
          continue;
        }
        if (logLevel && log.level !== logLevel) continue;
        if (fromDate && new Date(log.time).getTime() < fromDate.getTime()) continue;
        if (toDate && new Date(log.time).getTime() > toDate.getTime()) continue;

        if (!returnPaginationResults || (total >= start && total < end)) {
          paginatedLogs.push(log);
        }
        total++;
      }

      if (!returnPaginationResults) {
        return {
          logs: paginatedLogs,
          total,
          page,
          perPage: total,
          hasMore: false,
        };
      }

      const hasMore = end < total;

      return {
        logs: paginatedLogs,
        total,
        page,
        perPage: resolvedPerPage,
        hasMore,
      };
    } catch (error) {
      console.error('Error getting logs from file:', error);
      return {
        logs: [],
        total: 0,
        page: 0,
        perPage: 0,
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
      const perPage = perPageInput ?? 100;
      const allLogs = await this.listLogs({ fromDate, toDate, logLevel, filters });
      const logs = (allLogs?.logs?.filter(log => log?.runId === runId) || []) as BaseLogMessage[];
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
      console.error('Error getting logs by runId from file:', error);
      return {
        logs: [],
        total: 0,
        page: 0,
        perPage: 0,
        hasMore: false,
      };
    }
  }
}
