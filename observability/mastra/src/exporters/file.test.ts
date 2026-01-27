/**
 * Tests for FileExporter.
 *
 * Verifies that FileExporter produces JSONL files compatible with
 * the IngestionWorker from @mastra/observability-clickhouse.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileExporter } from './file';
import { TracingEventType } from '@mastra/core/observability';
import type { TracingEvent, AnyExportedSpan } from '@mastra/core/observability';

describe('FileExporter', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `file-exporter-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  function createMockSpan(overrides: Partial<AnyExportedSpan> = {}): AnyExportedSpan {
    return {
      id: 'span_123',
      traceId: 'trace_456',
      parentSpanId: null,
      name: 'test-span',
      type: 'AGENT',
      startTime: new Date('2025-01-25T10:00:00.000Z'),
      endTime: new Date('2025-01-25T10:00:01.500Z'),
      input: { message: 'test input' },
      output: { result: 'test output' },
      errorInfo: undefined,
      attributes: { 'custom.attr': 'value' },
      metadata: { key: 'value' },
      ...overrides,
    } as AnyExportedSpan;
  }

  function createSpanEndedEvent(span: AnyExportedSpan): TracingEvent {
    return {
      type: TracingEventType.SPAN_ENDED,
      exportedSpan: span,
    } as TracingEvent;
  }

  describe('initialization', () => {
    it('should disable when no outputPath provided', () => {
      const exporter = new FileExporter({
        outputPath: '',
      });

      expect(exporter['outputPath']).toBe('');
      // The exporter should be disabled - verify by checking it doesn't throw on export
    });

    it('should disable when no projectId provided', () => {
      const exporter = new FileExporter({
        outputPath: testDir,
        // No projectId
      });

      expect(exporter['projectId']).toBe('');
    });

    it('should initialize correctly with valid config', () => {
      const exporter = new FileExporter({
        outputPath: testDir,
        projectId: 'proj_123',
        deploymentId: 'dep_456',
        maxBatchSize: 50,
        maxBatchWaitMs: 3000,
      });

      expect(exporter['outputPath']).toBe(testDir);
      expect(exporter['projectId']).toBe('proj_123');
      expect(exporter['deploymentId']).toBe('dep_456');
      expect(exporter['maxBatchSize']).toBe(50);
      expect(exporter['maxBatchWaitMs']).toBe(3000);

      exporter.shutdown();
    });
  });

  describe('file path generation', () => {
    it('should generate file path following observability-writer convention', () => {
      const exporter = new FileExporter({
        outputPath: testDir,
        projectId: 'proj_123',
      });

      const filePath = exporter['generateFilePath']();

      // Should match pattern: {basePath}/span/{projectId}/{timestamp}_{uuid}.jsonl
      expect(filePath).toMatch(
        new RegExp(`^${testDir.replace(/\//g, '\\/')}/span/proj_123/\\d{8}T\\d{6}Z_[a-f0-9]+\\.jsonl$`),
      );

      exporter.shutdown();
    });

    it('should format timestamp as ISO 8601 basic format', () => {
      const exporter = new FileExporter({
        outputPath: testDir,
        projectId: 'proj_123',
      });

      const date = new Date('2025-01-25T10:30:45.123Z');
      const formatted = exporter['formatTimestamp'](date);

      expect(formatted).toBe('20250125T103045Z');

      exporter.shutdown();
    });
  });

  describe('span conversion', () => {
    it('should convert span to ObservabilityEvent envelope format', () => {
      const exporter = new FileExporter({
        outputPath: testDir,
        projectId: 'proj_123',
        deploymentId: 'dep_456',
      });

      const span = createMockSpan();
      const event = exporter['convertSpanToEvent'](span);

      // Verify envelope structure
      expect(event.type).toBe('span');
      expect(event.data).toBeDefined();

      // Verify span data
      expect(event.data.spanId).toBe('span_123');
      expect(event.data.traceId).toBe('trace_456');
      expect(event.data.parentSpanId).toBeNull();
      expect(event.data.projectId).toBe('proj_123');
      expect(event.data.deploymentId).toBe('dep_456');
      expect(event.data.name).toBe('test-span');
      expect(event.data.kind).toBe('internal'); // Default for AGENT type
      expect(event.data.status).toBe('ok');
      expect(event.data.startTime).toEqual(new Date('2025-01-25T10:00:00.000Z'));
      expect(event.data.endTime).toEqual(new Date('2025-01-25T10:00:01.500Z'));
      expect(event.data.durationMs).toBe(1500);
      expect(event.data.events).toEqual([]);

      // Verify attributes include mastra-specific fields
      expect(event.data.attributes['mastra.span.type']).toBe('AGENT');
      expect(event.data.attributes['mastra.input']).toEqual({ message: 'test input' });
      expect(event.data.attributes['mastra.output']).toEqual({ result: 'test output' });
      expect(event.data.attributes['custom.attr']).toBe('value');

      exporter.shutdown();
    });

    it('should set status to error when errorInfo is present', () => {
      const exporter = new FileExporter({
        outputPath: testDir,
        projectId: 'proj_123',
      });

      const span = createMockSpan({
        errorInfo: { message: 'Something went wrong' },
      });
      const event = exporter['convertSpanToEvent'](span);

      expect(event.data.status).toBe('error');
      expect(event.data.attributes['mastra.error']).toEqual({ message: 'Something went wrong' });

      exporter.shutdown();
    });

    it('should set status to unset when no endTime', () => {
      const exporter = new FileExporter({
        outputPath: testDir,
        projectId: 'proj_123',
      });

      const span = createMockSpan({
        endTime: undefined,
      });
      const event = exporter['convertSpanToEvent'](span);

      expect(event.data.status).toBe('unset');
      expect(event.data.endTime).toBeNull();
      expect(event.data.durationMs).toBeNull();

      exporter.shutdown();
    });

    it('should map span types to correct kinds', () => {
      const exporter = new FileExporter({
        outputPath: testDir,
        projectId: 'proj_123',
      });

      expect(exporter['mapTypeToKind']('server')).toBe('server');
      expect(exporter['mapTypeToKind']('http_request')).toBe('server');
      expect(exporter['mapTypeToKind']('client')).toBe('client');
      expect(exporter['mapTypeToKind']('http_call')).toBe('client');
      expect(exporter['mapTypeToKind']('producer')).toBe('producer');
      expect(exporter['mapTypeToKind']('consumer')).toBe('consumer');
      expect(exporter['mapTypeToKind']('AGENT')).toBe('internal');
      expect(exporter['mapTypeToKind']('TOOL')).toBe('internal');
      expect(exporter['mapTypeToKind']('WORKFLOW')).toBe('internal');

      exporter.shutdown();
    });
  });

  describe('JSONL file output', () => {
    it('should write spans to JSONL file with correct format', async () => {
      const exporter = new FileExporter({
        outputPath: testDir,
        projectId: 'proj_123',
        deploymentId: 'dep_456',
        maxBatchSize: 1, // Force flush after each span
      });

      const span = createMockSpan();
      const event = createSpanEndedEvent(span);

      await exporter['_exportTracingEvent'](event);
      await exporter.flush();

      // Find the generated file
      const spanDir = join(testDir, 'span', 'proj_123');
      const files = readdirSync(spanDir).filter(f => f.endsWith('.jsonl'));
      expect(files.length).toBe(1);

      // Read and parse the file
      const content = readFileSync(join(spanDir, files[0]!), 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBe(1);

      const parsed = JSON.parse(lines[0]!);

      // Verify the envelope format
      expect(parsed.type).toBe('span');
      expect(parsed.data.spanId).toBe('span_123');
      expect(parsed.data.traceId).toBe('trace_456');
      expect(parsed.data.projectId).toBe('proj_123');
      expect(parsed.data.deploymentId).toBe('dep_456');

      await exporter.shutdown();
    });

    it('should only export SPAN_ENDED events', async () => {
      const exporter = new FileExporter({
        outputPath: testDir,
        projectId: 'proj_123',
        maxBatchSize: 10,
      });

      // Send a span started event (should be ignored)
      await exporter['_exportTracingEvent']({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: createMockSpan(),
      } as TracingEvent);

      // Send a span ended event (should be exported)
      await exporter['_exportTracingEvent'](createSpanEndedEvent(createMockSpan()));

      await exporter.flush();

      // Should only have 1 span in the file
      const spanDir = join(testDir, 'span', 'proj_123');
      const files = readdirSync(spanDir).filter(f => f.endsWith('.jsonl'));
      const content = readFileSync(join(spanDir, files[0]!), 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(1);

      await exporter.shutdown();
    });

    it('should batch multiple spans into single file', async () => {
      const exporter = new FileExporter({
        outputPath: testDir,
        projectId: 'proj_123',
        maxBatchSize: 100,
      });

      // Export 3 spans
      for (let i = 0; i < 3; i++) {
        const span = createMockSpan({ id: `span_${i}` });
        await exporter['_exportTracingEvent'](createSpanEndedEvent(span));
      }

      await exporter.flush();

      // All should be in the same file
      const spanDir = join(testDir, 'span', 'proj_123');
      const files = readdirSync(spanDir).filter(f => f.endsWith('.jsonl'));
      expect(files.length).toBe(1);

      const content = readFileSync(join(spanDir, files[0]!), 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBe(3);

      // Verify each line is valid JSON with correct span IDs
      lines.forEach((line, i) => {
        const parsed = JSON.parse(line);
        expect(parsed.type).toBe('span');
        expect(parsed.data.spanId).toBe(`span_${i}`);
      });

      await exporter.shutdown();
    });

    it('should flush when batch size is reached', async () => {
      const exporter = new FileExporter({
        outputPath: testDir,
        projectId: 'proj_123',
        maxBatchSize: 2,
      });

      // Export 2 spans (should trigger flush)
      await exporter['_exportTracingEvent'](createSpanEndedEvent(createMockSpan({ id: 'span_1' })));
      await exporter['_exportTracingEvent'](createSpanEndedEvent(createMockSpan({ id: 'span_2' })));

      // Buffer should be empty after auto-flush
      expect(exporter['buffer'].length).toBe(0);

      // Verify file was written
      const spanDir = join(testDir, 'span', 'proj_123');
      const files = readdirSync(spanDir).filter(f => f.endsWith('.jsonl'));
      expect(files.length).toBe(1);

      const content = readFileSync(join(spanDir, files[0]!), 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBe(2);

      await exporter.shutdown();
    });

    it('should create directory structure if not exists', async () => {
      const deepPath = join(testDir, 'deep', 'nested', 'path');
      const exporter = new FileExporter({
        outputPath: deepPath,
        projectId: 'proj_123',
        maxBatchSize: 1,
      });

      await exporter['_exportTracingEvent'](createSpanEndedEvent(createMockSpan()));
      await exporter.flush();

      // Verify directory was created
      expect(existsSync(join(deepPath, 'span', 'proj_123'))).toBe(true);

      await exporter.shutdown();
    });
  });

  describe('shutdown', () => {
    it('should flush remaining buffer on shutdown', async () => {
      const exporter = new FileExporter({
        outputPath: testDir,
        projectId: 'proj_123',
        maxBatchSize: 100, // Large batch size so no auto-flush
      });

      // Add some spans to buffer
      await exporter['_exportTracingEvent'](createSpanEndedEvent(createMockSpan({ id: 'span_1' })));
      await exporter['_exportTracingEvent'](createSpanEndedEvent(createMockSpan({ id: 'span_2' })));

      // Buffer should have 2 items
      expect(exporter['buffer'].length).toBe(2);

      // Shutdown should flush
      await exporter.shutdown();

      // Verify file was written with all spans
      const spanDir = join(testDir, 'span', 'proj_123');
      const files = readdirSync(spanDir).filter(f => f.endsWith('.jsonl'));
      const content = readFileSync(join(spanDir, files[0]!), 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(2);
    });

    it('should clear flush timer on shutdown', async () => {
      const exporter = new FileExporter({
        outputPath: testDir,
        projectId: 'proj_123',
      });

      expect(exporter['flushTimer']).not.toBeNull();

      await exporter.shutdown();

      expect(exporter['flushTimer']).toBeNull();
    });
  });
});
