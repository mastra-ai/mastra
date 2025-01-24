import { LoggerTransport, BaseLogMessage } from '@mastra/core';
import { createWriteStream, existsSync, WriteStream } from 'fs';

export class FileLogger extends LoggerTransport {
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

  _transform(chunk: any, encoding: string, callback: (error: Error | null, chunk: any) => void) {
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

  // Clean up resources
  _destroy(error: Error, callback: Function) {
    if (this.fileStream) {
      this.fileStream.destroy(error);
    }
    callback(error);
  }

  async getLogs(): Promise<BaseLogMessage[]> {
    return [];
  }

  async getLogsByRunId(runId: string): Promise<BaseLogMessage[]> {
    return [];
  }
}
