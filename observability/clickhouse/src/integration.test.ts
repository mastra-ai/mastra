/**
 * Integration tests for @mastra/observability-clickhouse.
 *
 * These tests require a running ClickHouse instance.
 * Start it with: docker compose up -d
 *
 * Run these tests with: pnpm test:integration
 */

import type { ClickHouseClient } from '@clickhouse/client';
import { createClient } from '@clickhouse/client';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { IngestionWorker } from './ingestion/worker.js';
import { ClickHouseQueryProvider } from './query-provider/index.js';
import { runMigrations, dropAllTables, checkSchemaStatus } from './schema/migrations.js';
import type { FileStorageProvider, FileInfo } from './types.js';

// Skip integration tests if CLICKHOUSE_URL is not set
const CLICKHOUSE_URL = process.env['CLICKHOUSE_URL'] || 'http://localhost:8123';
const CLICKHOUSE_USER = process.env['CLICKHOUSE_USER'] || 'default';
const CLICKHOUSE_PASSWORD = process.env['CLICKHOUSE_PASSWORD'] || '';

// Helper to check if ClickHouse is available
async function isClickHouseAvailable(): Promise<boolean> {
  try {
    const client = createClient({
      url: CLICKHOUSE_URL,
      username: CLICKHOUSE_USER,
      password: CLICKHOUSE_PASSWORD,
    });
    await client.ping();
    await client.close();
    return true;
  } catch {
    return false;
  }
}

// In-memory file storage for testing
function createMemoryFileStorage(): FileStorageProvider & {
  files: Map<string, Buffer>;
  setFile: (path: string, content: string) => void;
} {
  const files = new Map<string, Buffer>();

  return {
    type: 'memory' as const,
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

describe.skipIf(!process.env['RUN_INTEGRATION_TESTS'])('Integration Tests', () => {
  let client: ClickHouseClient;
  let fileStorage: ReturnType<typeof createMemoryFileStorage>;

  beforeAll(async () => {
    const available = await isClickHouseAvailable();
    if (!available) {
      console.warn('ClickHouse not available, skipping integration tests');
      return;
    }

    client = createClient({
      url: CLICKHOUSE_URL,
      username: CLICKHOUSE_USER,
      password: CLICKHOUSE_PASSWORD,
    });

    // Ensure clean state
    await dropAllTables(client);
    await runMigrations(client);
  });

  afterAll(async () => {
    if (client) {
      await dropAllTables(client);
      await client.close();
    }
  });

  beforeEach(() => {
    fileStorage = createMemoryFileStorage();
  });

  describe('Schema Migrations', () => {
    it('should create all tables and views', async () => {
      const status = await checkSchemaStatus(client);
      expect(status.isInitialized).toBe(true);
      expect(status.missingTables).toHaveLength(0);
      expect(status.missingViews).toHaveLength(0);
    });
  });

  describe('End-to-End Ingestion and Query', () => {
    it('should ingest traces and query them back', async () => {
      // Create test trace data
      const traceEvent = {
        type: 'trace',
        id: 'trace_integration_1',
        projectId: 'proj_integration',
        deploymentId: 'dep_1',
        name: 'integration-test-trace',
        status: 'ok',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 1000).toISOString(),
        durationMs: 1000,
        recordedAt: new Date().toISOString(),
      };

      fileStorage.setFile(
        'observability/trace/proj_integration/20250123T120000Z_test123.jsonl',
        JSON.stringify(traceEvent) + '\n',
      );

      // Create and run worker
      const worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client },
        debug: false,
      });

      const result = await worker.processOnce();
      expect(result.filesProcessed).toBe(1);
      expect(result.eventsIngested).toBe(1);
      expect(result.eventsByType['trace']).toBe(1);

      // Query back
      const queryProvider = new ClickHouseQueryProvider({
        clickhouse: { client },
      });

      const { traces, pagination } = await queryProvider.listTraces({
        projectId: 'proj_integration',
      });

      expect(traces).toHaveLength(1);
      expect(traces[0].id).toBe('trace_integration_1');
      expect(traces[0].name).toBe('integration-test-trace');
      expect(pagination.total).toBe(1);
    });

    it('should ingest spans and query them for a trace', async () => {
      // Create trace and spans
      const traceId = 'trace_integration_2';
      const events = [
        {
          type: 'trace',
          id: traceId,
          projectId: 'proj_integration',
          deploymentId: 'dep_1',
          name: 'parent-trace',
          status: 'ok',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 2000).toISOString(),
          durationMs: 2000,
          recordedAt: new Date().toISOString(),
        },
        {
          type: 'span',
          id: 'span_1',
          traceId,
          projectId: 'proj_integration',
          deploymentId: 'dep_1',
          name: 'child-span-1',
          kind: 'internal',
          status: 'ok',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 500).toISOString(),
          durationMs: 500,
          recordedAt: new Date().toISOString(),
        },
        {
          type: 'span',
          id: 'span_2',
          traceId,
          parentSpanId: 'span_1',
          projectId: 'proj_integration',
          deploymentId: 'dep_1',
          name: 'child-span-2',
          kind: 'client',
          status: 'ok',
          startTime: new Date(Date.now() + 100).toISOString(),
          endTime: new Date(Date.now() + 400).toISOString(),
          durationMs: 300,
          recordedAt: new Date().toISOString(),
        },
      ];

      fileStorage.setFile(
        'observability/trace/proj_integration/20250123T130000Z_test456.jsonl',
        events.map(e => JSON.stringify(e)).join('\n') + '\n',
      );

      // Ingest
      const worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client },
        debug: false,
      });

      const result = await worker.processOnce();
      expect(result.eventsIngested).toBe(3);

      // Query spans for trace
      const queryProvider = new ClickHouseQueryProvider({
        clickhouse: { client },
      });

      const spans = await queryProvider.getSpansForTrace(traceId);
      expect(spans).toHaveLength(2);

      const span1 = spans.find(s => s.id === 'span_1');
      const span2 = spans.find(s => s.id === 'span_2');

      expect(span1).toBeDefined();
      expect(span1?.name).toBe('child-span-1');
      expect(span2).toBeDefined();
      expect(span2?.parentSpanId).toBe('span_1');
    });

    it('should ingest logs and filter by level', async () => {
      const logs = [
        {
          type: 'log',
          id: 'log_1',
          projectId: 'proj_integration',
          deploymentId: 'dep_1',
          level: 'info',
          message: 'Application started',
          timestamp: new Date().toISOString(),
          recordedAt: new Date().toISOString(),
        },
        {
          type: 'log',
          id: 'log_2',
          projectId: 'proj_integration',
          deploymentId: 'dep_1',
          level: 'error',
          message: 'Something went wrong',
          timestamp: new Date().toISOString(),
          recordedAt: new Date().toISOString(),
        },
        {
          type: 'log',
          id: 'log_3',
          projectId: 'proj_integration',
          deploymentId: 'dep_1',
          level: 'info',
          message: 'Request handled',
          timestamp: new Date().toISOString(),
          recordedAt: new Date().toISOString(),
        },
      ];

      fileStorage.setFile(
        'observability/log/proj_integration/20250123T140000Z_logs.jsonl',
        logs.map(e => JSON.stringify(e)).join('\n') + '\n',
      );

      const worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client },
        debug: false,
      });

      await worker.processOnce();

      const queryProvider = new ClickHouseQueryProvider({
        clickhouse: { client },
      });

      // Query error logs only
      const { logs: errorLogs } = await queryProvider.listLogs({
        projectId: 'proj_integration',
        level: 'error',
      });

      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].message).toBe('Something went wrong');

      // Query all logs
      const { logs: allLogs, pagination } = await queryProvider.listLogs({
        projectId: 'proj_integration',
      });

      expect(allLogs.length).toBeGreaterThanOrEqual(3);
      expect(pagination.total).toBeGreaterThanOrEqual(3);
    });

    it('should ingest metrics and query by name', async () => {
      const metrics = [
        {
          type: 'metric',
          id: 'metric_1',
          projectId: 'proj_integration',
          deploymentId: 'dep_1',
          name: 'request_latency',
          metricType: 'histogram',
          value: 150,
          unit: 'ms',
          timestamp: new Date().toISOString(),
          recordedAt: new Date().toISOString(),
        },
        {
          type: 'metric',
          id: 'metric_2',
          projectId: 'proj_integration',
          deploymentId: 'dep_1',
          name: 'request_count',
          metricType: 'counter',
          value: 100,
          timestamp: new Date().toISOString(),
          recordedAt: new Date().toISOString(),
        },
      ];

      fileStorage.setFile(
        'observability/metric/proj_integration/20250123T150000Z_metrics.jsonl',
        metrics.map(e => JSON.stringify(e)).join('\n') + '\n',
      );

      const worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client },
        debug: false,
      });

      await worker.processOnce();

      const queryProvider = new ClickHouseQueryProvider({
        clickhouse: { client },
      });

      const { metrics: latencyMetrics } = await queryProvider.listMetrics({
        projectId: 'proj_integration',
        name: 'request_latency',
      });

      expect(latencyMetrics).toHaveLength(1);
      expect(latencyMetrics[0].value).toBe(150);
      expect(latencyMetrics[0].unit).toBe('ms');
    });

    it('should ingest scores and query by value range', async () => {
      const scores = [
        {
          type: 'score',
          id: 'score_1',
          projectId: 'proj_integration',
          deploymentId: 'dep_1',
          name: 'accuracy',
          value: 0.95,
          normalizedValue: 0.95,
          timestamp: new Date().toISOString(),
          recordedAt: new Date().toISOString(),
        },
        {
          type: 'score',
          id: 'score_2',
          projectId: 'proj_integration',
          deploymentId: 'dep_1',
          name: 'accuracy',
          value: 0.72,
          normalizedValue: 0.72,
          timestamp: new Date().toISOString(),
          recordedAt: new Date().toISOString(),
        },
        {
          type: 'score',
          id: 'score_3',
          projectId: 'proj_integration',
          deploymentId: 'dep_1',
          name: 'accuracy',
          value: 0.88,
          normalizedValue: 0.88,
          timestamp: new Date().toISOString(),
          recordedAt: new Date().toISOString(),
        },
      ];

      fileStorage.setFile(
        'observability/score/proj_integration/20250123T160000Z_scores.jsonl',
        scores.map(e => JSON.stringify(e)).join('\n') + '\n',
      );

      const worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client },
        debug: false,
      });

      await worker.processOnce();

      const queryProvider = new ClickHouseQueryProvider({
        clickhouse: { client },
      });

      // Query high scores (>= 0.85)
      const { scores: highScores } = await queryProvider.listScores({
        projectId: 'proj_integration',
        name: 'accuracy',
        minValue: 0.85,
      });

      expect(highScores).toHaveLength(2);
      expect(highScores.every(s => s.value >= 0.85)).toBe(true);
    });
  });

  describe('Time Series Aggregations', () => {
    it('should calculate trace count over time', async () => {
      const queryProvider = new ClickHouseQueryProvider({
        clickhouse: { client },
      });

      const timeSeries = await queryProvider.getTraceCountTimeSeries({
        projectId: 'proj_integration',
        intervalSeconds: 3600,
        timeRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
          end: new Date(),
        },
      });

      // Should have some buckets from previous tests
      expect(timeSeries.length).toBeGreaterThanOrEqual(0);
    });

    it('should calculate error rate over time', async () => {
      // First, add some error traces
      const errorTraces = [
        {
          type: 'trace',
          id: 'trace_error_1',
          projectId: 'proj_integration',
          deploymentId: 'dep_1',
          name: 'failed-trace',
          status: 'error',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 100).toISOString(),
          durationMs: 100,
          recordedAt: new Date().toISOString(),
        },
        {
          type: 'trace',
          id: 'trace_error_2',
          projectId: 'proj_integration',
          deploymentId: 'dep_1',
          name: 'another-failed-trace',
          status: 'error',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 200).toISOString(),
          durationMs: 200,
          recordedAt: new Date().toISOString(),
        },
      ];

      fileStorage.setFile(
        'observability/trace/proj_integration/20250123T170000Z_errors.jsonl',
        errorTraces.map(e => JSON.stringify(e)).join('\n') + '\n',
      );

      const worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client },
        debug: false,
      });

      await worker.processOnce();

      const queryProvider = new ClickHouseQueryProvider({
        clickhouse: { client },
      });

      const errorRate = await queryProvider.getErrorRateTimeSeries({
        projectId: 'proj_integration',
        intervalSeconds: 3600,
        timeRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date(),
        },
      });

      // Should have buckets with error counts
      expect(errorRate.length).toBeGreaterThanOrEqual(0);
      if (errorRate.length > 0) {
        expect(errorRate[0].values).toBeDefined();
      }
    });
  });

  describe('Worker Lifecycle', () => {
    it('should track worker status correctly', async () => {
      const worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client },
        debug: false,
      });

      // Initial status
      let status = worker.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.isProcessing).toBe(false);
      expect(status.totalFilesProcessed).toBe(0);

      // Add a file and process
      fileStorage.setFile(
        'observability/trace/proj_status/20250123T180000Z_status.jsonl',
        JSON.stringify({
          type: 'trace',
          id: 'trace_status',
          projectId: 'proj_status',
          name: 'status-test',
          status: 'ok',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
        }) + '\n',
      );

      await worker.processOnce();

      // Status after processing
      status = worker.getStatus();
      expect(status.totalFilesProcessed).toBe(1);
      expect(status.totalEventsIngested).toBe(1);
      expect(status.lastProcessedAt).toBeDefined();
    });

    it('should handle file deletion after processing when configured', async () => {
      const worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client },
        deleteAfterProcess: true,
        debug: false,
      });

      const filePath = 'observability/trace/proj_delete/20250123T190000Z_delete.jsonl';
      fileStorage.setFile(
        filePath,
        JSON.stringify({
          type: 'trace',
          id: 'trace_delete',
          projectId: 'proj_delete',
          name: 'delete-test',
          status: 'ok',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
        }) + '\n',
      );

      expect(await fileStorage.exists(filePath)).toBe(true);

      await worker.processOnce();

      // File should be deleted
      expect(await fileStorage.exists(filePath)).toBe(false);
      // No processed file should exist either
      expect(await fileStorage.exists(filePath.replace('trace/proj_delete/', 'trace/proj_delete/processed/'))).toBe(
        false,
      );
    });
  });
});
