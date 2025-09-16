import type { ExportResult } from '@opentelemetry/core';
import { ExportResultCode } from '@opentelemetry/core';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { describe, it, beforeEach, expect } from 'vitest';
import { ConsoleLogger } from '../logger/default-logger';
import type { MastraStorage } from '../storage/base';
import { TABLE_TRACES } from '../storage/constants';
import { OTLPTraceExporter } from './storage-exporter';

// Shared resource and scope to ensure the serializer groups spans into a single resourceSpans entry
const SHARED_RESOURCE = { attributes: { 'service.name': 'test-service' } } as any;
const SHARED_SCOPE = { name: 'test-lib', version: '1.0.0' } as any;

// Test helper for creating spans
const createTestSpan = (traceId: string, spanId: string): ReadableSpan =>
  ({
    spanContext: () => ({
      traceId,
      spanId,
      traceFlags: 1,
      isRemote: false,
    }),
    name: `test-span-${spanId}`,
    kind: 0,
    startTime: [1, 1],
    endTime: [2, 2],
    ended: true,
    status: { code: 0 },
    attributes: {},
    links: [],
    events: [],
    resource: SHARED_RESOURCE,
    instrumentationScope: SHARED_SCOPE,
    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0,
  }) as unknown as ReadableSpan;

// Default in-memory storage implementation
class InMemoryStorage {
  private records: Record<string, any[]> = {};

  async batchInsert({ tableName, records }: { tableName: string; records: any[] }): Promise<void> {
    if (!this.records[tableName]) {
      this.records[tableName] = [];
    }
    this.records[tableName].push(...records);
    return Promise.resolve();
  }

  async find({ tableName }: { tableName: string }): Promise<any[]> {
    return Promise.resolve(this.records[tableName] || []);
  }
}

describe('OTLPTraceExporter', () => {
  let exporter: OTLPTraceExporter;
  let storage: InMemoryStorage;
  let exportResults: ExportResult[];

  beforeEach(() => {
    storage = new InMemoryStorage();
    exportResults = [];
    exporter = new OTLPTraceExporter({
      storage: storage as unknown as MastraStorage,
      logger: new ConsoleLogger(),
    });
  });

  it('should complete single export operation with success', async () => {
    // Arrange: Create test span data
    const testSpan = createTestSpan('trace-1', 'span-1');

    // Act: Export span and wait for callback to ensure completion
    await new Promise<void>(resolve => {
      exporter.export([testSpan], result => {
        exportResults.push(result);
        resolve();
      });
    });

    // Assert: Verify export success
    expect(exportResults).toHaveLength(1);
    expect(exportResults[0].code).toBe(ExportResultCode.SUCCESS);
  });

  it('should process concurrent exports in sequence', async () => {
    // Arrange: Create two test spans with distinct IDs
    const span1 = createTestSpan('trace-1', 'span-1');
    const span2 = createTestSpan('trace-2', 'span-2');
    const exportOrder: string[] = [];
    const callbackOrder: string[] = [];

    // Act: Export spans and track order; then ensure all flushes complete
    const p1 = new Promise<void>(resolve => {
      exporter.export([span1], result => {
        exportResults.push(result);
        callbackOrder.push('trace-1');
        resolve();
      });
    });
    exportOrder.push('trace-1');

    const p2 = new Promise<void>(resolve => {
      exporter.export([span2], result => {
        exportResults.push(result);
        callbackOrder.push('trace-2');
        resolve();
      });
    });
    exportOrder.push('trace-2');

    await exporter.forceFlush();
    await Promise.all([p1, p2]);

    // Assert: Verify export order and success
    expect(exportResults).toHaveLength(2);
    expect(exportResults.every(r => r.code === ExportResultCode.SUCCESS)).toBe(true);
    expect(callbackOrder).toEqual(exportOrder);
  });

  it('should store all spans from multiple exports', async () => {
    // Arrange: Create test spans with known IDs
    const spans1 = [createTestSpan('trace-1', 'span-1'), createTestSpan('trace-2', 'span-2')];
    const spans2 = [createTestSpan('trace-3', 'span-3'), createTestSpan('trace-4', 'span-4')];

    // Act: Enqueue both exports concurrently
    const p1 = new Promise<void>(resolve => {
      exporter.export(spans1, result => {
        exportResults.push(result);
        resolve();
      });
    });
    const p2 = new Promise<void>(resolve => {
      exporter.export(spans2, result => {
        exportResults.push(result);
        resolve();
      });
    });

    // Ensure any queued batches are processed sequentially
    await exporter.forceFlush();
    await Promise.all([p1, p2]);

    // Assert: Verify storage state
    const storedSpans = await storage.find({ tableName: TABLE_TRACES });
    expect(exportResults).toHaveLength(2);
    expect(exportResults.every(r => r.code === ExportResultCode.SUCCESS)).toBe(true);
    expect(storedSpans).toHaveLength(4);

    // Verify each span's traceId and spanId match input
    const allInputSpans = [...spans1, ...spans2];
    for (const inputSpan of allInputSpans) {
      const spanContext = inputSpan.spanContext();
      const storedSpan = storedSpans.find((s: any) => s.traceId === spanContext.traceId && s.id === spanContext.spanId);
      expect(storedSpan).toBeTruthy();
      expect(storedSpan?.name).toBe(`test-span-${spanContext.spanId}`);
      expect(storedSpan?.scope).toBe('test-lib');
    }
  });
});
