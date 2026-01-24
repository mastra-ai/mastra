import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  createTraceData,
  createSpanData,
  createLogData,
  createMetricData,
  createScoreData,
  createTraceWithSpans,
  createBulkTraces,
  createBulkLogs,
} from '../../fixtures/observability-factories.js';
import { LocalFileStorage } from '../../setup/mock-file-storage.js';
import { MockObservabilityWriter } from '../../setup/mock-observability-writer.js';

describe('Observability Data Flow Integration Tests', () => {
  let fileStorage: LocalFileStorage;
  let writer: MockObservabilityWriter;
  let baseDir: string;
  const testProjectId = 'test-obs-project';
  const testDeploymentId = 'test-obs-deployment';

  beforeAll(async () => {
    // Create a unique test directory
    baseDir = `/tmp/mastra-obs-test-${Date.now()}`;
    await fs.mkdir(baseDir, { recursive: true });

    fileStorage = new LocalFileStorage({ baseDir });
    writer = new MockObservabilityWriter({
      fileStorage,
      batchSize: 10, // Small batch size for testing
      flushIntervalMs: 0, // Disable auto-flush for deterministic tests
    });
  });

  afterAll(async () => {
    await writer.shutdown();
    // Cleanup test directory
    await fs.rm(baseDir, { recursive: true, force: true }).catch(() => {});
  });

  beforeEach(async () => {
    // Clear the test directory between tests
    try {
      const entries = await fs.readdir(baseDir);
      for (const entry of entries) {
        await fs.rm(path.join(baseDir, entry), { recursive: true, force: true });
      }
    } catch {
      // Directory might not exist yet
    }
  });

  describe('Event Writing', () => {
    it('should write trace events', async () => {
      const trace = createTraceData({
        projectId: testProjectId,
        deploymentId: testDeploymentId,
      });

      writer.recordTrace(trace);
      await writer.flush();

      // Verify file was written
      const files = await fileStorage.list(`trace/${testProjectId}`);
      expect(files.length).toBeGreaterThan(0);
    });

    it('should write span events', async () => {
      const traceId = 'test-trace-id';
      const span = createSpanData({
        traceId,
        projectId: testProjectId,
        deploymentId: testDeploymentId,
      });

      writer.recordSpan(span);
      await writer.flush();

      const files = await fileStorage.list(`span/${testProjectId}`);
      expect(files.length).toBeGreaterThan(0);
    });

    it('should write log events', async () => {
      const log = createLogData({
        projectId: testProjectId,
        deploymentId: testDeploymentId,
        level: 'info',
      });

      writer.recordLog(log);
      await writer.flush();

      const files = await fileStorage.list(`log/${testProjectId}`);
      expect(files.length).toBeGreaterThan(0);
    });

    it('should write metric events', async () => {
      const metric = createMetricData({
        projectId: testProjectId,
        deploymentId: testDeploymentId,
        name: 'request_duration_ms',
        type: 'histogram',
        value: 150,
      });

      writer.recordMetric(metric);
      await writer.flush();

      const files = await fileStorage.list(`metric/${testProjectId}`);
      expect(files.length).toBeGreaterThan(0);
    });

    it('should write score events', async () => {
      const score = createScoreData({
        projectId: testProjectId,
        deploymentId: testDeploymentId,
        name: 'accuracy',
        value: 0.95,
      });

      writer.recordScore(score);
      await writer.flush();

      const files = await fileStorage.list(`score/${testProjectId}`);
      expect(files.length).toBeGreaterThan(0);
    });

    it('should write trace with spans', async () => {
      const { trace, spans } = createTraceWithSpans({
        projectId: testProjectId,
        deploymentId: testDeploymentId,
        name: 'test-operation',
      });

      writer.recordTrace(trace);
      for (const span of spans) {
        writer.recordSpan(span);
      }
      await writer.flush();

      const traceFiles = await fileStorage.list(`trace/${testProjectId}`);
      const spanFiles = await fileStorage.list(`span/${testProjectId}`);

      expect(traceFiles.length).toBeGreaterThan(0);
      expect(spanFiles.length).toBeGreaterThan(0);
    });

    it('should handle multiple event types in sequence', async () => {
      const trace = createTraceData({ projectId: testProjectId, deploymentId: testDeploymentId });
      const span = createSpanData({ traceId: trace.traceId, projectId: testProjectId, deploymentId: testDeploymentId });
      const log = createLogData({ projectId: testProjectId, deploymentId: testDeploymentId });
      const metric = createMetricData({ projectId: testProjectId, deploymentId: testDeploymentId });
      const score = createScoreData({ projectId: testProjectId, deploymentId: testDeploymentId });

      writer.recordTrace(trace);
      writer.recordSpan(span);
      writer.recordLog(log);
      writer.recordMetric(metric);
      writer.recordScore(score);
      await writer.flush();

      const traceFiles = await fileStorage.list(`trace/${testProjectId}`);
      const spanFiles = await fileStorage.list(`span/${testProjectId}`);
      const logFiles = await fileStorage.list(`log/${testProjectId}`);
      const metricFiles = await fileStorage.list(`metric/${testProjectId}`);
      const scoreFiles = await fileStorage.list(`score/${testProjectId}`);

      expect(traceFiles.length).toBeGreaterThan(0);
      expect(spanFiles.length).toBeGreaterThan(0);
      expect(logFiles.length).toBeGreaterThan(0);
      expect(metricFiles.length).toBeGreaterThan(0);
      expect(scoreFiles.length).toBeGreaterThan(0);
    });
  });

  describe('Batching', () => {
    it('should batch multiple events', async () => {
      const events = [];
      for (let i = 0; i < 15; i++) {
        events.push(
          createSpanData({
            traceId: `batch-trace-${i}`,
            projectId: testProjectId,
            deploymentId: testDeploymentId,
          }),
        );
      }

      events.forEach(e => writer.recordSpan(e));
      await writer.flush();

      // Verify batching worked
      const files = await fileStorage.list(`span/${testProjectId}`);
      expect(files.length).toBeGreaterThan(0);
    });

    it('should buffer events until flush', async () => {
      const trace = createTraceData({
        projectId: testProjectId,
        deploymentId: testDeploymentId,
      });

      writer.recordTrace(trace);

      // Before flush, buffer should have events
      expect(writer.hasPendingEvents()).toBe(true);

      await writer.flush();

      // After flush, buffer should be empty
      const sizes = writer.getBufferSizes();
      expect(sizes.trace).toBe(0);
    });

    it('should create multiple files for bulk writes', async () => {
      // Write events for multiple projects
      const project1Events = createBulkTraces(5, {
        projectId: 'project-1',
        deploymentId: testDeploymentId,
      });

      const project2Events = createBulkTraces(5, {
        projectId: 'project-2',
        deploymentId: testDeploymentId,
      });

      project1Events.forEach(e => writer.recordTrace(e));
      project2Events.forEach(e => writer.recordTrace(e));
      await writer.flush();

      const project1Files = await fileStorage.list('trace/project-1');
      const project2Files = await fileStorage.list('trace/project-2');

      expect(project1Files.length).toBeGreaterThan(0);
      expect(project2Files.length).toBeGreaterThan(0);
    });
  });

  describe('JSONL File Format', () => {
    it('should write valid JSONL format', async () => {
      const span = createSpanData({
        traceId: 'jsonl-test',
        projectId: testProjectId,
        deploymentId: testDeploymentId,
      });

      writer.recordSpan(span);
      await writer.flush();

      // Find the most recent file
      const files = await fileStorage.list(`span/${testProjectId}`);
      const latestFile = files.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())[0];

      // Read and parse
      const content = await fileStorage.read(latestFile.path);
      const contentString = content.toString('utf-8');

      // Each line should be valid JSON
      const lines = contentString.trim().split('\n');
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    });

    it('should preserve all event properties in JSONL', async () => {
      const log = createLogData({
        projectId: testProjectId,
        deploymentId: testDeploymentId,
        level: 'error',
        message: 'Test error message',
      });

      writer.recordLog(log);
      await writer.flush();

      const files = await fileStorage.list(`log/${testProjectId}`);
      const latestFile = files[files.length - 1];

      const content = await fileStorage.read(latestFile.path);
      const lines = content.toString('utf-8').trim().split('\n');
      const parsed = JSON.parse(lines[lines.length - 1]);

      expect(parsed.id).toBe(log.id);
      expect(parsed.projectId).toBe(testProjectId);
      expect(parsed.deploymentId).toBe(testDeploymentId);
      expect(parsed.level).toBe('error');
      expect(parsed.message).toBe('Test error message');
    });

    it('should handle special characters in messages', async () => {
      const log = createLogData({
        projectId: testProjectId,
        deploymentId: testDeploymentId,
        level: 'info',
        message: 'Message with "quotes" and \\ backslash and \n newline',
      });

      writer.recordLog(log);
      await writer.flush();

      const files = await fileStorage.list(`log/${testProjectId}`);
      const latestFile = files[files.length - 1];

      const content = await fileStorage.read(latestFile.path);
      const lines = content.toString('utf-8').trim().split('\n');
      const parsed = JSON.parse(lines[lines.length - 1]);

      expect(parsed.message).toContain('"quotes"');
    });
  });

  describe('File Storage Operations', () => {
    it('should list pending files', async () => {
      const span = createSpanData({
        traceId: 'list-test',
        projectId: testProjectId,
        deploymentId: testDeploymentId,
      });

      writer.recordSpan(span);
      await writer.flush();

      const files = await fileStorage.list('span');
      expect(files.length).toBeGreaterThan(0);
    });

    it('should move processed files', async () => {
      const span = createSpanData({
        traceId: 'move-test',
        projectId: testProjectId,
        deploymentId: testDeploymentId,
      });

      writer.recordSpan(span);
      await writer.flush();

      const files = await fileStorage.list(`span/${testProjectId}`);
      if (files.length > 0) {
        const file = files[0];
        const processedPath = file.path.replace(
          `span/${testProjectId}`,
          `span/${testProjectId}/processed`,
        );

        await fileStorage.move(file.path, processedPath);

        expect(await fileStorage.exists(processedPath)).toBe(true);
        expect(await fileStorage.exists(file.path)).toBe(false);
      }
    });

    it('should delete files', async () => {
      const span = createSpanData({
        traceId: 'delete-test',
        projectId: testProjectId,
        deploymentId: testDeploymentId,
      });

      writer.recordSpan(span);
      await writer.flush();

      const files = await fileStorage.list(`span/${testProjectId}`);
      if (files.length > 0) {
        const file = files[0];
        await fileStorage.delete(file.path);

        expect(await fileStorage.exists(file.path)).toBe(false);
      }
    });

    it('should check file existence correctly', async () => {
      const testPath = `test-exists-${Date.now()}.txt`;
      await fileStorage.write(testPath, 'test content');

      expect(await fileStorage.exists(testPath)).toBe(true);
      expect(await fileStorage.exists('non-existent-file.txt')).toBe(false);
    });
  });

  describe('Ingestion Worker Simulation', () => {
    it('should process files and mark as processed', async () => {
      // Write some events
      for (let i = 0; i < 5; i++) {
        writer.recordSpan(
          createSpanData({
            traceId: `ingestion-test-${i}`,
            projectId: testProjectId,
            deploymentId: testDeploymentId,
          }),
        );
      }
      await writer.flush();

      // Simulate ingestion: list, read, process, move
      const pendingFiles = await fileStorage.list(`span/${testProjectId}`);
      const pendingCount = pendingFiles.filter(f => !f.path.includes('processed')).length;

      for (const file of pendingFiles) {
        if (file.path.includes('processed')) continue;

        // Read content
        const content = await fileStorage.read(file.path);
        expect(content.length).toBeGreaterThan(0);

        // Parse and validate JSONL content
        const lines = content.toString('utf-8').trim().split('\n');
        for (const line of lines) {
          const parsed = JSON.parse(line);
          expect(parsed.projectId).toBe(testProjectId);
          expect(parsed.deploymentId).toBe(testDeploymentId);
        }

        // Move to processed
        const processedPath = file.path.replace(
          `span/${testProjectId}/`,
          `span/${testProjectId}/processed/`,
        );
        await fileStorage.move(file.path, processedPath);
      }

      // Verify all moved
      const remainingFiles = await fileStorage.list(`span/${testProjectId}`);
      const remainingPending = remainingFiles.filter(f => !f.path.includes('processed')).length;
      expect(remainingPending).toBeLessThan(pendingCount);
    });

    it('should handle concurrent reads and writes', async () => {
      // Start multiple write operations
      const writePromises = [];
      for (let i = 0; i < 10; i++) {
        writePromises.push(
          (async () => {
            writer.recordLog(
              createLogData({
                projectId: testProjectId,
                deploymentId: testDeploymentId,
                level: 'info',
                message: `Concurrent log ${i}`,
              }),
            );
          })(),
        );
      }

      await Promise.all(writePromises);
      await writer.flush();

      // Read all files
      const files = await fileStorage.list(`log/${testProjectId}`);
      expect(files.length).toBeGreaterThan(0);
    });
  });

  describe('Event Types', () => {
    it('should record events via recordEvents method', async () => {
      const trace = createTraceData({ projectId: testProjectId, deploymentId: testDeploymentId });
      const span = createSpanData({ traceId: trace.traceId, projectId: testProjectId, deploymentId: testDeploymentId });
      const log = createLogData({ projectId: testProjectId, deploymentId: testDeploymentId });

      writer.recordEvents([
        { type: 'trace', data: trace },
        { type: 'span', data: span },
        { type: 'log', data: log },
      ]);

      await writer.flush();

      const traceFiles = await fileStorage.list(`trace/${testProjectId}`);
      const spanFiles = await fileStorage.list(`span/${testProjectId}`);
      const logFiles = await fileStorage.list(`log/${testProjectId}`);

      expect(traceFiles.length).toBeGreaterThan(0);
      expect(spanFiles.length).toBeGreaterThan(0);
      expect(logFiles.length).toBeGreaterThan(0);
    });

    it('should write all log levels correctly', async () => {
      const logs = createBulkLogs(4, {
        projectId: testProjectId,
        deploymentId: testDeploymentId,
      });

      logs.forEach(log => writer.recordLog(log));
      await writer.flush();

      const files = await fileStorage.list(`log/${testProjectId}`);
      const latestFile = files[files.length - 1];
      const content = await fileStorage.read(latestFile.path);
      const lines = content.toString('utf-8').trim().split('\n');

      const levels = new Set(lines.map(line => JSON.parse(line).level));
      expect(levels.has('debug')).toBe(true);
      expect(levels.has('info')).toBe(true);
      expect(levels.has('warn')).toBe(true);
      expect(levels.has('error')).toBe(true);
    });

    it('should write all metric types correctly', async () => {
      const counterMetric = createMetricData({
        projectId: testProjectId,
        deploymentId: testDeploymentId,
        name: 'request_count',
        type: 'counter',
        value: 100,
      });

      const gaugeMetric = createMetricData({
        projectId: testProjectId,
        deploymentId: testDeploymentId,
        name: 'memory_usage',
        type: 'gauge',
        value: 512,
      });

      const histogramMetric = createMetricData({
        projectId: testProjectId,
        deploymentId: testDeploymentId,
        name: 'request_duration',
        type: 'histogram',
        value: 150,
      });

      writer.recordMetric(counterMetric);
      writer.recordMetric(gaugeMetric);
      writer.recordMetric(histogramMetric);
      await writer.flush();

      const files = await fileStorage.list(`metric/${testProjectId}`);
      const latestFile = files[files.length - 1];
      const content = await fileStorage.read(latestFile.path);
      const lines = content.toString('utf-8').trim().split('\n');

      const types = new Set(lines.map(line => JSON.parse(line).type));
      expect(types.has('counter')).toBe(true);
      expect(types.has('gauge')).toBe(true);
      expect(types.has('histogram')).toBe(true);
    });
  });

  describe('Writer Lifecycle', () => {
    it('should flush all buffers on shutdown', async () => {
      // Create a new writer for this test
      const testWriter = new MockObservabilityWriter({
        fileStorage,
        batchSize: 100, // High batch size to ensure events stay in buffer
        flushIntervalMs: 0,
      });

      testWriter.recordTrace(createTraceData({ projectId: 'shutdown-test', deploymentId: testDeploymentId }));
      testWriter.recordSpan(createSpanData({ traceId: 'test', projectId: 'shutdown-test', deploymentId: testDeploymentId }));

      expect(testWriter.hasPendingEvents()).toBe(true);

      await testWriter.shutdown();

      // Events should be flushed
      const traceFiles = await fileStorage.list('trace/shutdown-test');
      const spanFiles = await fileStorage.list('span/shutdown-test');

      expect(traceFiles.length).toBeGreaterThan(0);
      expect(spanFiles.length).toBeGreaterThan(0);
    });

    it('should not accept new events after shutdown', async () => {
      // Create a new writer for this test
      const testWriter = new MockObservabilityWriter({
        fileStorage,
        batchSize: 10,
        flushIntervalMs: 0,
      });

      await testWriter.shutdown();

      // Recording events after shutdown should be a no-op
      testWriter.recordTrace(createTraceData({ projectId: 'after-shutdown', deploymentId: testDeploymentId }));

      expect(testWriter.hasPendingEvents()).toBe(false);
    });
  });

  describe('Data Integrity', () => {
    it('should preserve Date objects as ISO strings', async () => {
      const trace = createTraceData({
        projectId: testProjectId,
        deploymentId: testDeploymentId,
      });

      writer.recordTrace(trace);
      await writer.flush();

      const files = await fileStorage.list(`trace/${testProjectId}`);
      const latestFile = files[files.length - 1];
      const content = await fileStorage.read(latestFile.path);
      const parsed = JSON.parse(content.toString('utf-8').trim().split('\n').pop()!);

      // Dates should be serialized as strings
      expect(typeof parsed.startTime).toBe('string');
      // Should be valid ISO date strings
      expect(new Date(parsed.startTime).getTime()).not.toBeNaN();
    });

    it('should handle empty metadata objects', async () => {
      const trace = createTraceData({
        projectId: testProjectId,
        deploymentId: testDeploymentId,
      });
      trace.metadata = {};

      writer.recordTrace(trace);
      await writer.flush();

      const files = await fileStorage.list(`trace/${testProjectId}`);
      const latestFile = files[files.length - 1];
      const content = await fileStorage.read(latestFile.path);
      const parsed = JSON.parse(content.toString('utf-8').trim().split('\n').pop()!);

      expect(parsed.metadata).toEqual({});
    });

    it('should handle complex nested attributes', async () => {
      const span = createSpanData({
        traceId: 'nested-test',
        projectId: testProjectId,
        deploymentId: testDeploymentId,
      });
      span.attributes = {
        simple: 'value',
        number: 123,
        nested: {
          level1: {
            level2: 'deep value',
          },
        },
        array: [1, 2, 3],
      };

      writer.recordSpan(span);
      await writer.flush();

      const files = await fileStorage.list(`span/${testProjectId}`);
      const latestFile = files[files.length - 1];
      const content = await fileStorage.read(latestFile.path);
      const parsed = JSON.parse(content.toString('utf-8').trim().split('\n').pop()!);

      expect(parsed.attributes.simple).toBe('value');
      expect(parsed.attributes.number).toBe(123);
      expect(parsed.attributes.nested.level1.level2).toBe('deep value');
      expect(parsed.attributes.array).toEqual([1, 2, 3]);
    });
  });
});
