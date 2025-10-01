import type { ExportResult } from '@opentelemetry/core';
import { ExportResultCode } from '@opentelemetry/core';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import type { IMastraLogger } from '../logger';
import type { MastraStorage } from '../storage/base';
import { OTLPTraceExporter } from './storage-exporter';

describe('OTLPTraceExporter', () => {
  let exporter: OTLPTraceExporter;
  let storageInstance: { batchInsert: ReturnType<typeof vi.fn> } & Partial<MastraStorage>;
  let loggerInstance: {
    debug: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    trackException: ReturnType<typeof vi.fn>;
  } & Partial<IMastraLogger>;
  let callbackResults: Array<{ timestamp: number; result: ExportResult }>;

  beforeEach(() => {
    storageInstance = {
      batchInsert: vi.fn(),
    } as unknown as { batchInsert: ReturnType<typeof vi.fn> } & MastraStorage;

    loggerInstance = {
      debug: vi.fn(),
      error: vi.fn(),
      trackException: vi.fn(),
    } as unknown as {
      debug: ReturnType<typeof vi.fn>;
      error: ReturnType<typeof vi.fn>;
      trackException: ReturnType<typeof vi.fn>;
    } & IMastraLogger;

    exporter = new OTLPTraceExporter({
      storage: storageInstance as unknown as MastraStorage,
      logger: loggerInstance as unknown as IMastraLogger,
    });

    callbackResults = [];
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // Helper to create a minimal valid ReadableSpan for the real serializer
  const createReadableSpan = (name: string, idx = 1): ReadableSpan => {
    const toHex = (n: number, len: number) => n.toString(16).padStart(len, '0');
    const spanId = toHex(idx, 16);
    const traceId = toHex(idx, 32);
    return {
      name,
      kind: 0, // INTERNAL
      spanContext: () => ({ traceId, spanId, traceFlags: 1 }),
      parentSpanId: '',
      startTime: [0, 1] as unknown as any,
      endTime: [0, 2] as unknown as any,
      status: { code: 0 },
      attributes: {},
      events: [],
      links: [],
      resource: { attributes: {} } as any,
      // Provide both to be compatible across transformer versions
      instrumentationScope: { name: 'default' } as any,
      instrumentationLibrary: { name: 'default' } as any,
      ended: true,
      duration: [0, 1] as unknown as any,
      droppedAttributesCount: 0,
      droppedEventsCount: 0,
      droppedLinksCount: 0,
    } as unknown as ReadableSpan;
  };

  // Helper functions
  const trackExport = (spans: ReadableSpan[]) => {
    exporter.export(spans, result => {
      callbackResults.push({ timestamp: Date.now(), result });
    });
  };

  const expectAllSuccess = (expectedCount: number) => {
    expect(callbackResults).toHaveLength(expectedCount);
    for (const { result } of callbackResults) {
      expect(result.code).toBe(ExportResultCode.SUCCESS);
    }
  };

  it('should wait for active flush to complete before processing new items', async () => {
    // Arrange: Setup deferred storage operation and test data
    let resolveFirstOperation: () => void = () => {};
    const firstOperationPromise = new Promise<void>(resolve => {
      resolveFirstOperation = resolve;
    });

    storageInstance.batchInsert
      .mockImplementationOnce(() => firstOperationPromise)
      .mockImplementationOnce(() => Promise.resolve());

    const spansA = [createReadableSpan('spanA', 1)];
    const spansB = [createReadableSpan('spanB', 2)];

    // Act: Export spans and trigger forceFlush
    trackExport(spansA);
    trackExport(spansB);

    const forceFlushPromise = exporter.forceFlush();

    // Give time for first batch to be in-flight, ensure second hasn't started yet
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(storageInstance.batchInsert).toHaveBeenCalledTimes(1);

    // Now resolve the first operation
    resolveFirstOperation();

    await forceFlushPromise;

    // Assert: Verify execution order and results
    expectAllSuccess(2);
    // Allow equal timestamps due to ms resolution; order is ensured by the call count check above
    expect(callbackResults[0].timestamp).toBeLessThanOrEqual(callbackResults[1].timestamp);
    expect(storageInstance.batchInsert).toHaveBeenCalledTimes(2);
  });

  it('should process all items including those added during processing', async () => {
    // Arrange: Setup initial spans and storage behavior
    const initialSpans = [createReadableSpan('initial', 1)];
    const additionalSpans = [createReadableSpan('additional', 2)];

    let exportDuringProcessing = false;
    storageInstance.batchInsert.mockImplementation(() => {
      if (!exportDuringProcessing) {
        exportDuringProcessing = true;
        trackExport(additionalSpans);
      }
      return Promise.resolve();
    });

    // Act: Export spans and force flush
    trackExport(initialSpans);
    await exporter.forceFlush();

    // Assert: Verify all exports were processed
    expectAllSuccess(2);
    expect(storageInstance.batchInsert).toHaveBeenCalledTimes(2);
  });

  it('should be a no-op when queue is empty', async () => {
    // Act: Call forceFlush on empty queue
    await exporter.forceFlush();

    // Assert: Verify no storage operations occurred
    expect(storageInstance.batchInsert).not.toHaveBeenCalled();
  });
});
