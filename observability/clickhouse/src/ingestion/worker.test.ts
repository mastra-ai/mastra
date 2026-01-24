import type { ClickHouseClient } from '@clickhouse/client';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import type { FileStorageProvider, FileInfo, ObservabilityEvent } from '../types.js';

import { IngestionWorker } from './worker.js';

// Mock file storage
function createMockFileStorage(): FileStorageProvider & {
  files: Map<string, Buffer>;
  setFile: (path: string, content: string) => void;
} {
  const files = new Map<string, Buffer>();

  return {
    type: 'mock' as const,
    files,
    setFile: (path: string, content: string) => {
      files.set(path, Buffer.from(content, 'utf-8'));
    },

    async write(path: string, content: Buffer | string): Promise<void> {
      const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
      files.set(path, buffer);
    },

    async read(path: string): Promise<Buffer> {
      const content = files.get(path);
      if (!content) {
        throw new Error(`File not found: ${path}`);
      }
      return content;
    },

    async list(prefix: string): Promise<FileInfo[]> {
      const result: FileInfo[] = [];
      for (const [path, content] of files) {
        if (path.startsWith(prefix) && !path.includes('/processed/')) {
          result.push({
            path,
            size: content.length,
            lastModified: new Date(),
          });
        }
      }
      return result;
    },

    async delete(path: string): Promise<void> {
      files.delete(path);
    },

    async move(from: string, to: string): Promise<void> {
      const content = files.get(from);
      if (content) {
        files.set(to, content);
        files.delete(from);
      }
    },

    async exists(path: string): Promise<boolean> {
      return files.has(path);
    },
  };
}

// Mock ClickHouse client
function createMockClickHouseClient() {
  const insertedRows: Record<string, unknown>[] = [];
  const commands: string[] = [];

  return {
    insertedRows,
    commands,
    async insert(options: { table: string; values: Record<string, unknown>[]; format: string }) {
      insertedRows.push(...options.values);
    },
    async query(_options: { query: string }) {
      // Return empty result for schema checks
      return {
        async json() {
          return [];
        },
      };
    },
    async command(options: { query: string }) {
      commands.push(options.query);
    },
    async close() {},
  };
}

describe('IngestionWorker', () => {
  let fileStorage: ReturnType<typeof createMockFileStorage>;
  let clickhouseClient: ReturnType<typeof createMockClickHouseClient>;
  let worker: IngestionWorker;

  beforeEach(() => {
    fileStorage = createMockFileStorage();
    clickhouseClient = createMockClickHouseClient();
  });

  afterEach(async () => {
    if (worker) {
      await worker.stop();
    }
  });

  describe('constructor', () => {
    it('should create worker with valid config using client', () => {
      worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client: clickhouseClient as unknown as ClickHouseClient },
        debug: false,
      });

      expect(worker).toBeInstanceOf(IngestionWorker);
    });

    it('should apply default config values', () => {
      worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client: clickhouseClient as unknown as ClickHouseClient },
      });

      const status = worker.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.isProcessing).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return initial status', () => {
      worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client: clickhouseClient as unknown as ClickHouseClient },
        debug: false,
      });

      const status = worker.getStatus();

      expect(status.isRunning).toBe(false);
      expect(status.isProcessing).toBe(false);
      expect(status.totalFilesProcessed).toBe(0);
      expect(status.totalEventsIngested).toBe(0);
      expect(status.startedAt).toBeNull();
      expect(status.lastProcessedAt).toBeNull();
      expect(status.currentErrors).toHaveLength(0);
      expect(status.totalEventsByType).toEqual({});
    });
  });

  describe('processOnce', () => {
    it('should return empty result when no files', async () => {
      worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client: clickhouseClient as unknown as ClickHouseClient },
        debug: false,
      });

      const result = await worker.processOnce();

      expect(result.filesProcessed).toBe(0);
      expect(result.eventsIngested).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.eventsByType).toEqual({});
    });

    it('should process JSONL files and insert events', async () => {
      // Add a test file with a trace event
      const traceEvent: ObservabilityEvent = {
        type: 'trace',
        data: {
          traceId: 'trace_1',
          projectId: 'proj_1',
          deploymentId: 'dep_1',
          name: 'test-trace',
          status: 'ok',
          startTime: new Date('2025-01-23T12:00:00.000Z'),
          endTime: new Date('2025-01-23T12:00:01.000Z'),
          durationMs: 1000,
          metadata: {},
        },
      };
      fileStorage.setFile(
        'observability/trace/proj_1/20250123T120000Z_abc123def456.jsonl',
        JSON.stringify(traceEvent) + '\n',
      );

      worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client: clickhouseClient as unknown as ClickHouseClient },
        debug: false,
      });

      const result = await worker.processOnce();

      expect(result.filesProcessed).toBe(1);
      expect(result.eventsIngested).toBe(1);
      expect(result.eventsByType.trace).toBe(1);
      expect(clickhouseClient.insertedRows).toHaveLength(1);
    });

    it('should move processed files to processed directory', async () => {
      const filePath = 'observability/trace/proj_1/20250123T120000Z_abc123def456.jsonl';
      const traceEvent: ObservabilityEvent = {
        type: 'trace',
        data: {
          traceId: 't1',
          projectId: 'p1',
          name: 'test',
          status: 'ok',
          startTime: new Date(),
          endTime: null,
          durationMs: null,
          metadata: {},
        },
      };
      fileStorage.setFile(filePath, JSON.stringify(traceEvent) + '\n');

      worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client: clickhouseClient as unknown as ClickHouseClient },
        deleteAfterProcess: false,
        debug: false,
      });

      await worker.processOnce();

      // Original file should be gone
      expect(await fileStorage.exists(filePath)).toBe(false);
      // Processed file should exist
      expect(await fileStorage.exists('observability/trace/proj_1/processed/20250123T120000Z_abc123def456.jsonl')).toBe(
        true,
      );
    });

    it('should delete files after processing when deleteAfterProcess is true', async () => {
      const filePath = 'observability/trace/proj_1/20250123T120000Z_abc123def456.jsonl';
      const traceEvent: ObservabilityEvent = {
        type: 'trace',
        data: {
          traceId: 't1',
          projectId: 'p1',
          name: 'test',
          status: 'ok',
          startTime: new Date(),
          endTime: null,
          durationMs: null,
          metadata: {},
        },
      };
      fileStorage.setFile(filePath, JSON.stringify(traceEvent) + '\n');

      worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client: clickhouseClient as unknown as ClickHouseClient },
        deleteAfterProcess: true,
        debug: false,
      });

      await worker.processOnce();

      // Original file should be deleted
      expect(await fileStorage.exists(filePath)).toBe(false);
      // Processed file should NOT exist
      expect(await fileStorage.exists('observability/trace/proj_1/processed/20250123T120000Z_abc123def456.jsonl')).toBe(
        false,
      );
    });

    it('should process multiple event types in a single file', async () => {
      const events: ObservabilityEvent[] = [
        {
          type: 'trace',
          data: {
            traceId: 't1',
            projectId: 'p1',
            name: 'test',
            status: 'ok',
            startTime: new Date(),
            endTime: null,
            durationMs: null,
            metadata: {},
          },
        },
        {
          type: 'span',
          data: {
            spanId: 's1',
            traceId: 't1',
            projectId: 'p1',
            name: 'span-test',
            kind: 'internal',
            status: 'ok',
            startTime: new Date(),
            endTime: null,
            durationMs: null,
            attributes: {},
            events: [],
          },
        },
      ];

      fileStorage.setFile(
        'observability/trace/proj_1/20250123T120000Z_abc123def456.jsonl',
        events.map(e => JSON.stringify(e)).join('\n') + '\n',
      );

      worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client: clickhouseClient as unknown as ClickHouseClient },
        debug: false,
      });

      const result = await worker.processOnce();

      expect(result.filesProcessed).toBe(1);
      expect(result.eventsIngested).toBe(2);
      expect(result.eventsByType.trace).toBe(1);
      expect(result.eventsByType.span).toBe(1);
    });

    it('should update statistics after processing', async () => {
      const traceEvent: ObservabilityEvent = {
        type: 'trace',
        data: {
          traceId: 't1',
          projectId: 'p1',
          name: 'test',
          status: 'ok',
          startTime: new Date(),
          endTime: null,
          durationMs: null,
          metadata: {},
        },
      };
      fileStorage.setFile(
        'observability/trace/proj_1/20250123T120000Z_abc123def456.jsonl',
        JSON.stringify(traceEvent) + '\n',
      );

      worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client: clickhouseClient as unknown as ClickHouseClient },
        debug: false,
      });

      await worker.processOnce();

      const status = worker.getStatus();
      expect(status.totalFilesProcessed).toBe(1);
      expect(status.totalEventsIngested).toBe(1);
      expect(status.totalEventsByType.trace).toBe(1);
      expect(status.lastProcessedAt).not.toBeNull();
    });

    it('should accumulate statistics across multiple processOnce calls', async () => {
      worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client: clickhouseClient as unknown as ClickHouseClient },
        debug: false,
      });

      // First batch
      const traceEvent1: ObservabilityEvent = {
        type: 'trace',
        data: {
          traceId: 't1',
          projectId: 'p1',
          name: 'test1',
          status: 'ok',
          startTime: new Date(),
          endTime: null,
          durationMs: null,
          metadata: {},
        },
      };
      fileStorage.setFile(
        'observability/trace/proj_1/20250123T120000Z_abc123def456.jsonl',
        JSON.stringify(traceEvent1) + '\n',
      );
      await worker.processOnce();

      // Second batch
      const traceEvent2: ObservabilityEvent = {
        type: 'trace',
        data: {
          traceId: 't2',
          projectId: 'p1',
          name: 'test2',
          status: 'ok',
          startTime: new Date(),
          endTime: null,
          durationMs: null,
          metadata: {},
        },
      };
      fileStorage.setFile(
        'observability/trace/proj_1/20250123T120100Z_xyz789ghi012.jsonl',
        JSON.stringify(traceEvent2) + '\n',
      );
      await worker.processOnce();

      const status = worker.getStatus();
      expect(status.totalFilesProcessed).toBe(2);
      expect(status.totalEventsIngested).toBe(2);
      expect(status.totalEventsByType.trace).toBe(2);
    });
  });

  describe('start and stop', () => {
    it('should start and stop the worker', async () => {
      worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client: clickhouseClient as unknown as ClickHouseClient },
        pollIntervalMs: 100,
        debug: false,
      });

      await worker.start();
      let status = worker.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.startedAt).not.toBeNull();

      await worker.stop();
      status = worker.getStatus();
      expect(status.isRunning).toBe(false);
    });

    it('should not start if already running', async () => {
      worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client: clickhouseClient as unknown as ClickHouseClient },
        pollIntervalMs: 100,
        debug: false,
      });

      await worker.start();
      const startedAt = worker.getStatus().startedAt;

      // Try to start again
      await worker.start();

      // Started at should be the same (not restarted)
      expect(worker.getStatus().startedAt).toBe(startedAt);

      await worker.stop();
    });

    it('should not fail if stopped when not running', async () => {
      worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client: clickhouseClient as unknown as ClickHouseClient },
        debug: false,
      });

      // Should not throw
      await worker.stop();
      expect(worker.getStatus().isRunning).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should record errors for files that fail to process', async () => {
      // Create a mock that throws on insert
      const failingClient = {
        ...clickhouseClient,
        async insert() {
          throw new Error('ClickHouse connection failed');
        },
      };

      const traceEvent: ObservabilityEvent = {
        type: 'trace',
        data: {
          traceId: 't1',
          projectId: 'p1',
          name: 'test',
          status: 'ok',
          startTime: new Date(),
          endTime: null,
          durationMs: null,
          metadata: {},
        },
      };
      fileStorage.setFile(
        'observability/trace/proj_1/20250123T120000Z_abc123def456.jsonl',
        JSON.stringify(traceEvent) + '\n',
      );

      worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client: failingClient as unknown as ClickHouseClient },
        retryAttempts: 1,
        retryDelayMs: 10,
        debug: false,
      });

      const result = await worker.processOnce();

      expect(result.filesProcessed).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toBe('ClickHouse connection failed');
      expect(result.errors[0]?.filePath).toContain('20250123T120000Z_abc123def456.jsonl');
    });

    it('should retry failed operations', async () => {
      let attempts = 0;
      const retriableClient = {
        ...clickhouseClient,
        async insert(options: { table: string; values: Record<string, unknown>[] }) {
          attempts++;
          if (attempts < 3) {
            throw new Error('Transient error');
          }
          clickhouseClient.insertedRows.push(...options.values);
        },
      };

      const traceEvent: ObservabilityEvent = {
        type: 'trace',
        data: {
          traceId: 't1',
          projectId: 'p1',
          name: 'test',
          status: 'ok',
          startTime: new Date(),
          endTime: null,
          durationMs: null,
          metadata: {},
        },
      };
      fileStorage.setFile(
        'observability/trace/proj_1/20250123T120000Z_abc123def456.jsonl',
        JSON.stringify(traceEvent) + '\n',
      );

      worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client: retriableClient as unknown as ClickHouseClient },
        retryAttempts: 3,
        retryDelayMs: 10,
        debug: false,
      });

      const result = await worker.processOnce();

      expect(attempts).toBe(3);
      expect(result.filesProcessed).toBe(1);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('batch processing', () => {
    it('should respect batchSize limit', async () => {
      // Add 5 files
      for (let i = 0; i < 5; i++) {
        const traceEvent: ObservabilityEvent = {
          type: 'trace',
          data: {
            traceId: `t${i}`,
            projectId: 'p1',
            name: `test${i}`,
            status: 'ok',
            startTime: new Date(),
            endTime: null,
            durationMs: null,
            metadata: {},
          },
        };
        fileStorage.setFile(
          `observability/trace/proj_1/20250123T12000${i}Z_abc${i}def456xyz.jsonl`,
          JSON.stringify(traceEvent) + '\n',
        );
      }

      worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client: clickhouseClient as unknown as ClickHouseClient },
        batchSize: 2,
        debug: false,
      });

      // First batch should process 2 files
      const result1 = await worker.processOnce();
      expect(result1.filesProcessed).toBe(2);

      // Second batch should process 2 more
      const result2 = await worker.processOnce();
      expect(result2.filesProcessed).toBe(2);

      // Third batch should process the remaining 1
      const result3 = await worker.processOnce();
      expect(result3.filesProcessed).toBe(1);
    });
  });
});
