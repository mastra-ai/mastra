import type { WriteStream } from 'fs';
import { createWriteStream, existsSync, readFileSync } from 'fs';
import { LoggerTransport } from '@mastra/core/logger';
import type { BaseLogMessage } from '@mastra/core/logger';

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

  async getLogs(): Promise<BaseLogMessage[]> {
    return readFileSync(this.path, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(log => JSON.parse(log));
  }

  async getLogsByRunId({ runId }: { runId: string }): Promise<BaseLogMessage[]> {
    try {
      const allLogs = await this.getLogs();
      return (allLogs.filter(log => log?.runId === runId) || []) as BaseLogMessage[];
    } catch (error) {
      console.error('Error getting logs by runId from Upstash:', error);
      return [] as BaseLogMessage[];
    }
  }
}
