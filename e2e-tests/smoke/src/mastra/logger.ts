import { LoggerTransport } from '@mastra/core/logger';
import type { BaseLogMessage, LogLevel } from '@mastra/core/logger';
import { PinoLogger } from '@mastra/loggers';

/**
 * In-memory transport for smoke tests. Buffers log records so the
 * /logs and /logs/transports endpoints return real data.
 */
class MemoryTransport extends LoggerTransport {
  private buffer: BaseLogMessage[] = [];
  private readonly capacity = 1000;

  _transform(chunk: any, _encoding: string, callback: (error: Error | null, chunk: any) => void) {
    try {
      const record =
        typeof chunk === 'string'
          ? JSON.parse(chunk)
          : Buffer.isBuffer(chunk)
            ? JSON.parse(chunk.toString('utf8'))
            : chunk;
      const normalized: BaseLogMessage = {
        runId: record.runId,
        msg: record.msg ?? '',
        level: record.level,
        time: record.time ? new Date(record.time) : new Date(),
        pid: record.pid ?? process.pid,
        hostname: record.hostname ?? '',
        name: record.name ?? 'smoke',
      };
      this.buffer.push(normalized);
      if (this.buffer.length > this.capacity) {
        this.buffer.splice(0, this.buffer.length - this.capacity);
      }
    } catch {
      // ignore malformed chunks
    }
    callback(null, chunk);
  }

  override async listLogs(args?: {
    fromDate?: Date;
    toDate?: Date;
    logLevel?: LogLevel;
    filters?: Record<string, any>;
    page?: number;
    perPage?: number;
  }) {
    const page = args?.page ?? 1;
    const perPage = args?.perPage ?? 100;
    const start = (page - 1) * perPage;
    const total = this.buffer.length;
    const logs = this.buffer.slice(start, start + perPage);
    return { logs, total, page, perPage, hasMore: start + logs.length < total };
  }

  override async listLogsByRunId(args: {
    runId: string;
    fromDate?: Date;
    toDate?: Date;
    logLevel?: LogLevel;
    filters?: Record<string, any>;
    page?: number;
    perPage?: number;
  }) {
    const page = args?.page ?? 1;
    const perPage = args?.perPage ?? 100;
    const matches = this.buffer.filter(log => log.runId === args.runId);
    const start = (page - 1) * perPage;
    const total = matches.length;
    const logs = matches.slice(start, start + perPage);
    return { logs, total, page, perPage, hasMore: start + logs.length < total };
  }
}

export const memoryTransport = new MemoryTransport();

export const smokeLogger = new PinoLogger({
  name: 'smoke',
  level: 'info',
  transports: {
    memory: memoryTransport,
  },
});

// Emit a startup log so /logs returns at least one record immediately after boot.
smokeLogger.info('smoke fixture logger initialized', { source: 'fixture' });
