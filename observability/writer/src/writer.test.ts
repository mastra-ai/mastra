import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { parseJsonl } from './serializer.js';
import type { FileStorageProvider, Trace, Span, Log, Metric, Score } from './types.js';
import { ObservabilityWriter } from './writer.js';

// Mock file storage provider
function createMockFileStorage(): FileStorageProvider & {
  files: Map<string, Buffer>;
  getFiles(): Map<string, Buffer>;
} {
  const files = new Map<string, Buffer>();

  return {
    type: 'mock' as const,
    files,
    getFiles: () => files,

    async write(path: string, content: Buffer | string): Promise<void> {
      const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
      files.set(path, buffer);
    },

    async read(path: string): Promise<Buffer> {
      const content = files.get(path);
      if (!content) {
        throw new Error(`File not found: ${path}`);
      }
      return content;
    },

    async list(prefix: string): Promise<Array<{ path: string; size: number; lastModified: Date }>> {
      const result: Array<{ path: string; size: number; lastModified: Date }> = [];
      for (const [path, content] of files) {
        if (path.startsWith(prefix)) {
          result.push({ path, size: content.length, lastModified: new Date() });
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

describe('ObservabilityWriter', () => {
  let fileStorage: ReturnType<typeof createMockFileStorage>;
  let writer: ObservabilityWriter;

  beforeEach(() => {
    fileStorage = createMockFileStorage();
    writer = new ObservabilityWriter({
      fileStorage,
      projectId: 'test_project',
      deploymentId: 'test_deployment',
      batchSize: 5,
      flushIntervalMs: 0, // Disable automatic flush for testing
      debug: false,
    });
  });

  afterEach(async () => {
    await writer.shutdown();
  });

  describe('constructor', () => {
    it('should create writer with valid config', () => {
      expect(writer).toBeInstanceOf(ObservabilityWriter);
      expect(writer.getProjectId()).toBe('test_project');
      expect(writer.getDeploymentId()).toBe('test_deployment');
    });

    it('should throw on missing fileStorage', () => {
      expect(
        () =>
          new ObservabilityWriter({
            fileStorage: null as unknown as FileStorageProvider,
            projectId: 'test',
            deploymentId: 'deploy',
          }),
      ).toThrow('fileStorage is required');
    });

    it('should throw on missing projectId', () => {
      expect(
        () =>
          new ObservabilityWriter({
            fileStorage,
            projectId: '',
            deploymentId: 'deploy',
          }),
      ).toThrow('projectId is required');
    });

    it('should throw on missing deploymentId', () => {
      expect(
        () =>
          new ObservabilityWriter({
            fileStorage,
            projectId: 'test',
            deploymentId: '',
          }),
      ).toThrow('deploymentId is required');
    });

    it('should throw on invalid batchSize', () => {
      expect(
        () =>
          new ObservabilityWriter({
            fileStorage,
            projectId: 'test',
            deploymentId: 'deploy',
            batchSize: 0,
          }),
      ).toThrow('batchSize must be greater than 0');
    });
  });

  describe('recordTrace', () => {
    it('should record a trace event', async () => {
      const trace: Trace = {
        traceId: 'trace_1',
        projectId: 'test_project',
        deploymentId: 'test_deployment',
        name: 'test-trace',
        startTime: new Date('2025-01-23T12:00:00.000Z'),
        endTime: new Date('2025-01-23T12:00:01.000Z'),
        durationMs: 1000,
        status: 'ok',
        metadata: {},
      };

      writer.recordTrace(trace);
      await writer.flush();

      const files = fileStorage.getFiles();
      expect(files.size).toBe(1);

      const [path, content] = [...files.entries()][0]!;
      expect(path).toContain('/trace/');

      const events = parseJsonl(content.toString('utf8'));
      expect(events[0]).toMatchObject({
        type: 'trace',
        data: {
          traceId: 'trace_1',
          name: 'test-trace',
        },
      });
    });
  });

  describe('recordSpan', () => {
    it('should record a span event', async () => {
      const span: Span = {
        spanId: 'span_1',
        traceId: 'trace_1',
        parentSpanId: null,
        projectId: 'test_project',
        deploymentId: 'test_deployment',
        name: 'llm-call',
        kind: 'internal',
        startTime: new Date('2025-01-23T12:00:00.000Z'),
        endTime: new Date('2025-01-23T12:00:00.500Z'),
        durationMs: 500,
        status: 'ok',
        attributes: {},
        events: [],
      };

      writer.recordSpan(span);
      await writer.flush();

      const files = fileStorage.getFiles();
      const [path] = [...files.keys()];
      expect(path).toContain('/span/');
    });
  });

  describe('recordLog', () => {
    it('should record a log event', async () => {
      const log: Log = {
        id: 'log_1',
        projectId: 'test_project',
        deploymentId: 'test_deployment',
        traceId: null,
        spanId: null,
        level: 'info',
        message: 'Test log message',
        timestamp: new Date('2025-01-23T12:00:00.000Z'),
        attributes: {},
      };

      writer.recordLog(log);
      await writer.flush();

      const files = fileStorage.getFiles();
      const [path] = [...files.keys()];
      expect(path).toContain('/log/');
    });
  });

  describe('recordMetric', () => {
    it('should record a metric event', async () => {
      const metric: Metric = {
        id: 'metric_1',
        projectId: 'test_project',
        deploymentId: 'test_deployment',
        name: 'token_count',
        type: 'counter',
        value: 150,
        unit: 'tokens',
        timestamp: new Date('2025-01-23T12:00:00.000Z'),
        labels: {},
      };

      writer.recordMetric(metric);
      await writer.flush();

      const files = fileStorage.getFiles();
      const [path] = [...files.keys()];
      expect(path).toContain('/metric/');
    });
  });

  describe('recordScore', () => {
    it('should record a score event', async () => {
      const score: Score = {
        id: 'score_1',
        projectId: 'test_project',
        deploymentId: 'test_deployment',
        traceId: 'trace_1',
        name: 'relevance',
        value: 0.95,
        normalizedValue: 0.95,
        comment: null,
        timestamp: new Date('2025-01-23T12:00:00.000Z'),
        metadata: {},
      };

      writer.recordScore(score);
      await writer.flush();

      const files = fileStorage.getFiles();
      const [path] = [...files.keys()];
      expect(path).toContain('/score/');
    });
  });

  describe('recordEvents', () => {
    it('should record multiple events at once', async () => {
      const events = [
        {
          type: 'trace' as const,
          data: {
            traceId: 't1',
            projectId: 'p1',
            deploymentId: 'd1',
            name: 'trace1',
            startTime: new Date(),
            endTime: null,
            durationMs: null,
            status: 'ok' as const,
            metadata: {},
          },
        },
        {
          type: 'span' as const,
          data: {
            spanId: 's1',
            traceId: 't1',
            parentSpanId: null,
            projectId: 'p1',
            deploymentId: 'd1',
            name: 'span1',
            kind: 'internal' as const,
            startTime: new Date(),
            endTime: null,
            durationMs: null,
            status: 'ok' as const,
            attributes: {},
            events: [],
          },
        },
        {
          type: 'log' as const,
          data: {
            id: 'l1',
            projectId: 'p1',
            deploymentId: 'd1',
            traceId: null,
            spanId: null,
            level: 'info' as const,
            message: 'test',
            timestamp: new Date(),
            attributes: {},
          },
        },
      ];

      writer.recordEvents(events);
      await writer.flush();

      const files = fileStorage.getFiles();
      // Should have 3 files (one per event type)
      expect(files.size).toBe(3);
    });
  });

  describe('batch flushing', () => {
    it('should auto-flush when batch size is reached', async () => {
      // Batch size is 5
      for (let i = 0; i < 5; i++) {
        writer.recordTrace({
          traceId: `trace_${i}`,
          projectId: 'test_project',
          deploymentId: 'test_deployment',
          name: 'test',
          startTime: new Date(),
          endTime: null,
          durationMs: null,
          status: 'ok',
          metadata: {},
        });
      }

      // Wait for async flush
      await new Promise(resolve => setTimeout(resolve, 100));

      const files = fileStorage.getFiles();
      expect(files.size).toBe(1);

      const [, content] = [...files.entries()][0]!;
      const events = parseJsonl(content.toString('utf8'));
      expect(events.length).toBe(5);
    });
  });

  describe('getStats', () => {
    it('should return current statistics', async () => {
      writer.recordTrace({
        traceId: 'trace_1',
        projectId: 'test_project',
        deploymentId: 'test_deployment',
        name: 'test',
        startTime: new Date(),
        endTime: null,
        durationMs: null,
        status: 'ok',
        metadata: {},
      });

      const statsBefore = writer.getStats();
      expect(statsBefore.totalEventsBuffered).toBe(1);
      expect(statsBefore.totalEventsWritten).toBe(0);

      await writer.flush();

      const statsAfter = writer.getStats();
      expect(statsAfter.totalEventsBuffered).toBe(0);
      expect(statsAfter.totalEventsWritten).toBe(1);
      expect(statsAfter.totalFilesWritten).toBe(1);
      expect(statsAfter.lastFlushAt).toBeInstanceOf(Date);
    });
  });

  describe('shutdown', () => {
    it('should flush remaining events on shutdown', async () => {
      writer.recordTrace({
        traceId: 'trace_1',
        projectId: 'test_project',
        deploymentId: 'test_deployment',
        name: 'test',
        startTime: new Date(),
        endTime: null,
        durationMs: null,
        status: 'ok',
        metadata: {},
      });

      expect(fileStorage.getFiles().size).toBe(0);

      await writer.shutdown();

      expect(fileStorage.getFiles().size).toBe(1);
      expect(writer.isShutdown()).toBe(true);
    });

    it('should reject new events after shutdown', async () => {
      await writer.shutdown();

      expect(() =>
        writer.recordTrace({
          traceId: 'trace_1',
          projectId: 'test_project',
          deploymentId: 'test_deployment',
          name: 'test',
          startTime: new Date(),
          endTime: null,
          durationMs: null,
          status: 'ok',
          metadata: {},
        }),
      ).toThrow('Cannot add events after shutdown');
    });
  });
});
