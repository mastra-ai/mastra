import { describe, expect, it } from 'vitest';
import {
  batchCreateLogsArgsSchema,
  createLogRecordSchema,
  listLogsArgsSchema,
  listLogsResponseSchema,
  logLevelSchema,
  logRecordInputSchema,
  logRecordSchema,
  logsFilterSchema,
} from './logs';

describe('Log Schemas', () => {
  const now = new Date();

  describe('logLevelSchema', () => {
    it('accepts valid log levels', () => {
      for (const level of ['debug', 'info', 'warn', 'error', 'fatal'] as const) {
        expect(logLevelSchema.parse(level)).toBe(level);
      }
    });

    it('rejects invalid log levels', () => {
      expect(() => logLevelSchema.parse('trace')).toThrow();
      expect(() => logLevelSchema.parse('')).toThrow();
    });
  });

  describe('logRecordSchema', () => {
    it('accepts a complete log record', () => {
      const record = logRecordSchema.parse({
        id: 'log-1',
        timestamp: now,
        level: 'info',
        message: 'Hello world',
        data: { key: 'value' },
        traceId: 'trace-1',
        spanId: 'span-1',
        tags: ['tag1'],
        metadata: { env: 'production' },
        createdAt: now,
        updatedAt: now,
      });
      expect(record.id).toBe('log-1');
      expect(record.level).toBe('info');
      expect(record.message).toBe('Hello world');
    });

    it('accepts a minimal log record', () => {
      const record = logRecordSchema.parse({
        id: 'log-2',
        timestamp: now,
        level: 'error',
        message: 'Something failed',
        createdAt: now,
        updatedAt: null,
      });
      expect(record.traceId).toBeUndefined();
      expect(record.data).toBeUndefined();
    });

    it('rejects missing required fields', () => {
      expect(() => logRecordSchema.parse({ id: 'log-3' })).toThrow();
      expect(() => logRecordSchema.parse({ id: 'log-3', timestamp: now, level: 'info' })).toThrow();
    });
  });

  describe('logRecordInputSchema', () => {
    it('accepts valid user input', () => {
      const input = logRecordInputSchema.parse({
        level: 'warn',
        message: 'Low memory',
        data: { available: 100 },
        tags: ['memory'],
      });
      expect(input.level).toBe('warn');
    });

    it('accepts minimal user input', () => {
      const input = logRecordInputSchema.parse({
        level: 'info',
        message: 'Started',
      });
      expect(input.data).toBeUndefined();
      expect(input.tags).toBeUndefined();
    });
  });

  describe('createLogRecordSchema', () => {
    it('omits db timestamps', () => {
      const record = createLogRecordSchema.parse({
        id: 'log-1',
        timestamp: now,
        level: 'info',
        message: 'Test',
      });
      expect(record).not.toHaveProperty('createdAt');
      expect(record).not.toHaveProperty('updatedAt');
    });
  });

  describe('batchCreateLogsArgsSchema', () => {
    it('accepts an array of log records', () => {
      const args = batchCreateLogsArgsSchema.parse({
        logs: [
          { id: 'log-1', timestamp: now, level: 'info', message: 'First' },
          { id: 'log-2', timestamp: now, level: 'error', message: 'Second' },
        ],
      });
      expect(args.logs).toHaveLength(2);
    });

    it('accepts empty array', () => {
      const args = batchCreateLogsArgsSchema.parse({ logs: [] });
      expect(args.logs).toHaveLength(0);
    });
  });

  describe('logsFilterSchema', () => {
    it('accepts all filter options', () => {
      const filter = logsFilterSchema.parse({
        timestamp: { start: now, end: now },
        level: ['info', 'error'],
        traceId: 'trace-1',
        spanId: 'span-1',
        search: 'error',
        tags: ['production'],
        dataKeys: ['userId'],
      });
      expect(filter.level).toEqual(['info', 'error']);
      expect(filter.search).toBe('error');
    });

    it('accepts single level as string', () => {
      const filter = logsFilterSchema.parse({ level: 'error' });
      expect(filter.level).toBe('error');
    });

    it('accepts empty filter', () => {
      const filter = logsFilterSchema.parse({});
      expect(filter).toEqual({});
    });
  });

  describe('listLogsArgsSchema', () => {
    it('applies defaults', () => {
      const args = listLogsArgsSchema.parse({});
      expect(args.pagination).toEqual({ page: 0, perPage: 10 });
      expect(args.orderBy).toEqual({ field: 'timestamp', direction: 'DESC' });
    });

    it('accepts custom pagination and ordering', () => {
      const args = listLogsArgsSchema.parse({
        pagination: { page: 2, perPage: 50 },
        orderBy: { field: 'timestamp', direction: 'ASC' },
      });
      expect(args.pagination.page).toBe(2);
      expect(args.orderBy.direction).toBe('ASC');
    });
  });

  describe('listLogsResponseSchema', () => {
    it('validates a response', () => {
      const response = listLogsResponseSchema.parse({
        pagination: { total: 100, page: 0, perPage: 10, hasMore: true },
        logs: [
          {
            id: 'log-1',
            timestamp: now,
            level: 'info',
            message: 'Test',
            createdAt: now,
            updatedAt: null,
          },
        ],
      });
      expect(response.logs).toHaveLength(1);
      expect(response.pagination.hasMore).toBe(true);
    });
  });
});
