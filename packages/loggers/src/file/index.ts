import type { WriteStream } from 'fs';
import { createWriteStream, existsSync, readFileSync } from 'fs';
import { LoggerTransport } from '@mastra/core/logger';
import type { BaseLogMessage, LogLevel } from '@mastra/core/logger';

export class FileTransport extends LoggerTransport {
  path: string;
  fileStream: WriteStream;
  constructor({ path }: { path: string }) {
    super({ objectMode: true });
    this.path = path;

    if (!existsSync(this.path)) {
      console.log(this.path);
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

  async getLogs(params?: {
    fromDate?: Date;
    toDate?: Date;
    logLevel?: LogLevel;
    filters?: Record<string, any>;
  }): Promise<BaseLogMessage[]> {
    try {
      const logs = readFileSync(this.path, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(log => JSON.parse(log));

      let filteredLogs = logs.filter(record => record !== null && typeof record === 'object');

      if (params?.filters) {
        filteredLogs = filteredLogs.filter(log =>
          Object.entries(params.filters || {}).every(([key, value]) => log[key as keyof BaseLogMessage] === value),
        );
      }

      if (params?.logLevel) {
        filteredLogs = filteredLogs.filter(log => log.level === params.logLevel);
      }

      if (params?.fromDate) {
        filteredLogs = filteredLogs.filter(log => new Date(log.time)?.getTime() >= params.fromDate!.getTime());
      }

      if (params?.toDate) {
        filteredLogs = filteredLogs.filter(log => new Date(log.time)?.getTime() <= params.toDate!.getTime());
      }

      return filteredLogs as BaseLogMessage[];
    } catch (error) {
      console.error('Error getting logs from file:', error);
      return [] as BaseLogMessage[];
    }
  }

  async getLogsByRunId({
    runId,
    fromDate,
    toDate,
    logLevel,
    filters,
  }: {
    runId: string;
    fromDate?: Date;
    toDate?: Date;
    logLevel?: LogLevel;
    filters?: Record<string, any>;
  }): Promise<BaseLogMessage[]> {
    try {
      const allLogs = await this.getLogs({ fromDate, toDate, logLevel, filters });
      return (allLogs.filter(log => log?.runId === runId) || []) as BaseLogMessage[];
    } catch (error) {
      console.error('Error getting logs by runId from file:', error);
      return [] as BaseLogMessage[];
    }
  }
}
