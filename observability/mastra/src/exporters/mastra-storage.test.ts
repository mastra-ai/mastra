import { SpanType, TracingEventType, EntityType } from '@mastra/core/observability';
import type {
  ModelGenerationAttributes,
  WorkflowStepAttributes,
  TracingEvent,
  AnyExportedSpan,
  MetricEvent,
  LogEvent,
  ScoreEvent,
  FeedbackEvent,
} from '@mastra/core/observability';
import { serializeSpanAttributes } from '@mastra/core/storage';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MastraStorageExporter } from './mastra-storage';

// Mock Mastra and logger
const mockMastra = {
  getStorage: vi.fn(),
} as any;

const mockLogger = {
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
} as any;

describe('MastraStorageExporter', () => {
  describe('serializeSpanAttributes', () => {
    it('should serialize LLM generation attributes with dates', () => {
      const mockSpan = {
        id: 'span-1',
        type: SpanType.MODEL_GENERATION,
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
          },
          parameters: {
            temperature: 0.7,
            maxTokens: 1000,
          },
        } as ModelGenerationAttributes,
      } as any;

      const result = serializeSpanAttributes(mockSpan);

      expect(result).toEqual({
        model: 'gpt-4',
        provider: 'openai',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        parameters: {
          temperature: 0.7,
          maxTokens: 1000,
        },
      });
    });

    it('should serialize workflow step attributes', () => {
      const mockSpan = {
        id: 'span-2',
        type: SpanType.WORKFLOW_STEP,
        attributes: {
          stepId: 'step-1',
          status: 'success',
        } as WorkflowStepAttributes,
      } as any;

      const result = serializeSpanAttributes(mockSpan);

      expect(result).toEqual({
        stepId: 'step-1',
        status: 'success',
      });
    });

    it('should handle Date objects in attributes', () => {
      const testDate = new Date('2023-12-01T10:00:00Z');

      const mockSpan = {
        id: 'span-3',
        type: SpanType.WORKFLOW_SLEEP,
        attributes: {
          untilDate: testDate,
          durationMs: 5000,
        },
      } as any;

      const result = serializeSpanAttributes(mockSpan);

      expect(result).toEqual({
        untilDate: '2023-12-01T10:00:00.000Z',
        durationMs: 5000,
      });
    });

    it('should return null for undefined attributes', () => {
      const mockSpan = {
        id: 'span-4',
        type: SpanType.GENERIC,
        attributes: undefined,
      } as any;

      const result = serializeSpanAttributes(mockSpan);

      expect(result).toBeNull();
    });

    it('should handle serialization errors gracefully', () => {
      // Create an object that will cause JSON.stringify to throw
      const circularObj = {} as any;
      circularObj.self = circularObj;

      const mockSpan = {
        id: 'span-5',
        type: SpanType.TOOL_CALL,
        attributes: {
          circular: circularObj,
        },
      } as any;

      const result = serializeSpanAttributes(mockSpan);

      expect(result).toBeNull();
    });
  });

  describe('Batching functionality', () => {
    let mockStorage: any;
    let mockObservabilityStore: any;
    let timers: any[];

    beforeEach(() => {
      vi.clearAllMocks();
      timers = [];

      // Mock setTimeout and clearTimeout to track timers
      // For flush timer tests, we DON'T want to execute immediately
      vi.spyOn(global, 'setTimeout').mockImplementation(((fn: any, delay: any) => {
        const id = Math.random();
        timers.push({ id, fn, delay });
        // DON'T execute automatically - let tests control execution
        return id;
      }) as any);

      vi.spyOn(global, 'clearTimeout').mockImplementation(((id: any) => {
        const index = timers.findIndex(t => t.id === id);
        if (index !== -1) timers.splice(index, 1);
      }) as any);

      // Create mock observability store (returned by getStore('observability'))
      mockObservabilityStore = {
        observabilityStrategy: {
          preferred: 'batch-with-updates',
          supported: ['realtime', 'batch-with-updates', 'insert-only'],
        },
        batchCreateSpans: vi.fn().mockResolvedValue(undefined),
        batchUpdateSpans: vi.fn().mockResolvedValue(undefined),
        createSpan: vi.fn().mockResolvedValue(undefined),
        updateSpan: vi.fn().mockResolvedValue(undefined),
      };

      // Create mock storage with getStore method
      mockStorage = {
        getStore: vi.fn().mockImplementation((domain: string) => {
          if (domain === 'observability') {
            return Promise.resolve(mockObservabilityStore);
          }
          return Promise.resolve(null);
        }),
        constructor: { name: 'MockStorage' },
      };

      mockMastra.getStorage.mockReturnValue(mockStorage);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    describe('Strategy resolution', () => {
      it('should auto-select storage preferred strategy', async () => {
        const exporter = new MastraStorageExporter({ logger: mockLogger });
        await exporter.init({ mastra: mockMastra });

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'tracing storage exporter initialized',
          expect.objectContaining({
            strategy: 'batch-with-updates',
            source: 'auto',
            storageAdapter: 'MockStorage',
          }),
        );
      });

      it('should use user-specified strategy when supported', async () => {
        const exporter = new MastraStorageExporter({ strategy: 'realtime', logger: mockLogger });
        await exporter.init({ mastra: mockMastra });

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'tracing storage exporter initialized',
          expect.objectContaining({
            strategy: 'realtime',
            source: 'user',
          }),
        );
      });

      it('should fallback to storage preferred when user strategy not supported', async () => {
        mockObservabilityStore.observabilityStrategy.supported = ['batch-with-updates'];

        const exporter = new MastraStorageExporter({ strategy: 'realtime', logger: mockLogger });
        await exporter.init({ mastra: mockMastra });

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'User-specified tracing strategy not supported by storage adapter, falling back to auto-selection',
          expect.objectContaining({
            userStrategy: 'realtime',
            fallbackStrategy: 'batch-with-updates',
          }),
        );
      });

      it('should log error if storage not available during init()', async () => {
        const mockMastraWithoutStorage = {
          getStorage: vi.fn().mockReturnValue(null),
        } as any;

        const exporter = new MastraStorageExporter({ logger: mockLogger });
        // Should not throw, but log error instead
        await expect(exporter.init({ mastra: mockMastraWithoutStorage })).resolves.not.toThrow();

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'MastraStorageExporter disabled: Storage not available. Traces will not be persisted.',
        );
      });
    });

    describe('Realtime strategy', () => {
      it('should process events immediately', async () => {
        mockObservabilityStore.observabilityStrategy = {
          preferred: 'realtime',
          supported: ['realtime', 'batch-with-updates', 'insert-only'],
        };
        const exporter = new MastraStorageExporter({ strategy: 'realtime', logger: mockLogger });
        await exporter.init({ mastra: mockMastra });
        const mockEvent = createMockEvent(TracingEventType.SPAN_STARTED);

        await exporter.exportTracingEvent(mockEvent);

        // Realtime flushes immediately through batchCreateSpans
        expect(mockObservabilityStore.batchCreateSpans).toHaveBeenCalledWith({
          records: expect.arrayContaining([
            expect.objectContaining({
              traceId: 'trace-1',
              spanId: 'span-1',
            }),
          ]),
        });
      });
    });

    describe('Batch-with-updates strategy', () => {
      it('should buffer events and flush when batch size reached', async () => {
        const exporter = new MastraStorageExporter({
          strategy: 'batch-with-updates',
          maxBatchSize: 2,
          logger: mockLogger,
        });
        await exporter.init({ mastra: mockMastra });

        const event1 = createMockEvent(TracingEventType.SPAN_STARTED, 'trace-1', 'span-1');
        const event2 = createMockEvent(TracingEventType.SPAN_STARTED, 'trace-1', 'span-2');

        await exporter.exportTracingEvent(event1);
        // First event should schedule timer but not flush yet
        expect(mockObservabilityStore.batchCreateSpans).not.toHaveBeenCalled();

        await exporter.exportTracingEvent(event2);

        // Wait for the async flush to complete (it's called in a fire-and-forget manner)
        await new Promise(resolve => setImmediate(resolve));

        // Should flush when batch size reached
        expect(mockObservabilityStore.batchCreateSpans).toHaveBeenCalledWith({
          records: expect.arrayContaining([
            expect.objectContaining({ spanId: 'span-1' }),
            expect.objectContaining({ spanId: 'span-2' }),
          ]),
        });
      });

      it('should buffer events and flush when batch size reached when not using await on init', async () => {
        const exporter = new MastraStorageExporter({
          strategy: 'batch-with-updates',
          maxBatchSize: 2,
          logger: mockLogger,
        });
        //no await , let exporter handle a initialization in progress internally
        //this replicates no await call by observability.setMastraContext
        exporter.init({ mastra: mockMastra });

        const event1 = createMockEvent(TracingEventType.SPAN_STARTED, 'trace-1', 'span-1');
        const event2 = createMockEvent(TracingEventType.SPAN_STARTED, 'trace-1', 'span-2');

        await exporter.exportTracingEvent(event1);
        // First event should schedule timer but not flush yet
        expect(mockObservabilityStore.batchCreateSpans).not.toHaveBeenCalled();

        await exporter.exportTracingEvent(event2);

        // Wait for the async flush to complete (it's called in a fire-and-forget manner)
        await new Promise(resolve => setImmediate(resolve));

        // Should flush when batch size reached
        expect(mockObservabilityStore.batchCreateSpans).toHaveBeenCalledWith({
          records: expect.arrayContaining([
            expect.objectContaining({ spanId: 'span-1' }),
            expect.objectContaining({ spanId: 'span-2' }),
          ]),
        });
      });

      it('should log when init is not called', async () => {
        const exporter = new MastraStorageExporter({
          strategy: 'batch-with-updates',
          maxBatchSize: 1,
          logger: mockLogger,
        });

        const event1 = createMockEvent(TracingEventType.SPAN_STARTED, 'trace-1', 'span-1');

        await exporter.exportTracingEvent(event1);
        //provide window for async flush execution (it's called in a fire-and-forget manner)
        await new Promise(resolve => setImmediate(resolve));

        // no flush as not initialized
        expect(mockObservabilityStore.batchCreateSpans).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith('Cannot store traces. Observability storage is not initialized');
      });

      it('should handle span updates', async () => {
        const exporter = new MastraStorageExporter({
          strategy: 'batch-with-updates',
          maxBatchSize: 10,
          logger: mockLogger,
        });
        await exporter.init({ mastra: mockMastra });

        // Add span create first
        const createEvent = createMockEvent(TracingEventType.SPAN_STARTED, 'trace-1', 'span-1');
        await exporter.exportTracingEvent(createEvent);

        // Add updates
        const updateEvent1 = createMockEvent(TracingEventType.SPAN_UPDATED, 'trace-1', 'span-1');
        const updateEvent2 = createMockEvent(TracingEventType.SPAN_ENDED, 'trace-1', 'span-1');

        await exporter.exportTracingEvent(updateEvent1);
        await exporter.exportTracingEvent(updateEvent2);

        // Manually trigger flush
        await exporter.flush();

        expect(mockObservabilityStore.batchCreateSpans).toHaveBeenCalledWith({
          records: expect.arrayContaining([expect.objectContaining({ spanId: 'span-1', traceId: 'trace-1' })]),
        });
        // SPAN_UPDATED and SPAN_ENDED both route to batchUpdateSpans
        expect(mockObservabilityStore.batchUpdateSpans).toHaveBeenCalled();
        const updateCalls = mockObservabilityStore.batchUpdateSpans.mock.calls;
        const allUpdates = updateCalls.flatMap((call: any) => call[0].records);
        const span1Updates = allUpdates.filter((u: any) => u.spanId === 'span-1');
        expect(span1Updates.length).toBe(2);
      });

      it('should handle out-of-order updates by deferring to next flush', async () => {
        const exporter = new MastraStorageExporter({
          strategy: 'batch-with-updates',
          maxBatchSize: 10,
          logger: mockLogger,
        });
        await exporter.init({ mastra: mockMastra });

        // Send update without create first — should be deferred
        const updateEvent = createMockEvent(TracingEventType.SPAN_UPDATED, 'trace-1', 'span-1');
        await exporter.exportTracingEvent(updateEvent);

        // Flush without the create — update should be deferred (re-added to buffer)
        await exporter.flush();

        // Update should NOT have been flushed (no create yet)
        expect(mockObservabilityStore.batchUpdateSpans).not.toHaveBeenCalled();

        // Now send the create and flush again — both should be processed
        const createEvent = createMockEvent(TracingEventType.SPAN_STARTED, 'trace-1', 'span-1');
        await exporter.exportTracingEvent(createEvent);
        await exporter.flush();

        expect(mockObservabilityStore.batchCreateSpans).toHaveBeenCalled();
        expect(mockObservabilityStore.batchUpdateSpans).toHaveBeenCalled();
      });

      it('should handle event-type spans that only emit SPAN_ENDED', async () => {
        const exporter = new MastraStorageExporter({
          strategy: 'batch-with-updates',
          maxBatchSize: 1, // Set to 1 to trigger immediate flush
          logger: mockLogger,
        });
        await exporter.init({ mastra: mockMastra });

        // Event-type spans only emit SPAN_ENDED (no SPAN_STARTED)
        const eventSpan = createMockEvent(TracingEventType.SPAN_ENDED, 'trace-1', 'event-1', true);
        await exporter.exportTracingEvent(eventSpan);

        // Wait for async flush to complete
        await new Promise(resolve => setImmediate(resolve));

        // Should create the span record (not treat as out-of-order)
        expect(mockObservabilityStore.batchCreateSpans).toHaveBeenCalledWith({
          records: expect.arrayContaining([
            expect.objectContaining({
              spanId: 'event-1',
              traceId: 'trace-1',
            }),
          ]),
        });

        // Should not log out-of-order warning
        expect(mockLogger.warn).not.toHaveBeenCalledWith(
          'Out-of-order span update detected - buffering for retry on next flush',
          expect.anything(),
        );
      });
    });

    describe('Insert-only strategy', () => {
      it('should only process SPAN_ENDED events', async () => {
        const exporter = new MastraStorageExporter({
          strategy: 'insert-only',
          maxBatchSize: 1, // Set to 1 to trigger immediate flush
          logger: mockLogger,
        });
        await exporter.init({ mastra: mockMastra });

        const startEvent = createMockEvent(TracingEventType.SPAN_STARTED, 'trace-1', 'span-1');
        const updateEvent = createMockEvent(TracingEventType.SPAN_UPDATED, 'trace-1', 'span-1');
        const endEvent = createMockEvent(TracingEventType.SPAN_ENDED, 'trace-1', 'span-1');

        await exporter.exportTracingEvent(startEvent);
        await exporter.exportTracingEvent(updateEvent);
        await exporter.exportTracingEvent(endEvent);

        // Only the end event should trigger a batch
        expect(mockObservabilityStore.batchCreateSpans).toHaveBeenCalledWith({
          records: expect.arrayContaining([expect.objectContaining({ spanId: 'span-1' })]),
        });

        // Should have been called only once (for the end event)
        expect(mockObservabilityStore.batchCreateSpans).toHaveBeenCalledTimes(1);
        expect(mockObservabilityStore.batchUpdateSpans).not.toHaveBeenCalled();
      });
    });

    describe('Timer-based flushing', () => {
      it('should schedule flush for first event', async () => {
        const exporter = new MastraStorageExporter({
          strategy: 'batch-with-updates',
          maxBatchWaitMs: 1000,
          logger: mockLogger,
        });
        await exporter.init({ mastra: mockMastra });

        const mockEvent = createMockEvent(TracingEventType.SPAN_STARTED);
        await exporter.exportTracingEvent(mockEvent);

        // Should have scheduled a timer
        expect(timers).toHaveLength(1);
        expect(timers[0].delay).toBe(1000);
      });

      it('should clear timer when flush triggered by size', async () => {
        const exporter = new MastraStorageExporter({
          strategy: 'batch-with-updates',
          maxBatchSize: 2,
          maxBatchWaitMs: 1000,
          logger: mockLogger,
        });
        await exporter.init({ mastra: mockMastra });

        // First event should schedule timer
        const mockEvent1 = createMockEvent(TracingEventType.SPAN_STARTED, 'trace-1', 'span-1');
        await exporter.exportTracingEvent(mockEvent1);

        // Timer should be scheduled
        expect(timers).toHaveLength(1);

        // Second event should trigger flush and clear timer
        const mockEvent2 = createMockEvent(TracingEventType.SPAN_STARTED, 'trace-1', 'span-2');
        await exporter.exportTracingEvent(mockEvent2);

        // Timer should be cleared after size-based flush
        expect(global.clearTimeout).toHaveBeenCalled();
      });
    });

    describe('Retry logic', () => {
      it('should re-add failed events to buffer for next flush', async () => {
        const exporter = new MastraStorageExporter({
          strategy: 'batch-with-updates',
          maxRetries: 3,
          maxBatchSize: 10,
          logger: mockLogger,
        });
        await exporter.init({ mastra: mockMastra });

        // Mock storage failure then success
        mockObservabilityStore.batchCreateSpans
          .mockRejectedValueOnce(new Error('Storage error'))
          .mockResolvedValueOnce(undefined);

        const mockEvent = createMockEvent(TracingEventType.SPAN_STARTED);
        await exporter.exportTracingEvent(mockEvent);

        // First flush fails — events re-added to buffer
        await exporter.flush();
        expect(mockObservabilityStore.batchCreateSpans).toHaveBeenCalledTimes(1);

        // Second flush succeeds — re-added events processed
        await exporter.flush();
        expect(mockObservabilityStore.batchCreateSpans).toHaveBeenCalledTimes(2);
      });

      it('should drop events after max retries exceeded', async () => {
        const exporter = new MastraStorageExporter({
          strategy: 'batch-with-updates',
          maxRetries: 2, // Allow 2 retries
          maxBatchSize: 10,
          logger: mockLogger,
        });
        await exporter.init({ mastra: mockMastra });

        // Mock persistent storage failure
        mockObservabilityStore.batchCreateSpans.mockRejectedValue(new Error('Persistent error'));

        const mockEvent = createMockEvent(TracingEventType.SPAN_STARTED);
        await exporter.exportTracingEvent(mockEvent);

        // Original attempt fails — event re-added with retryCount=1
        await exporter.flush();
        expect(mockObservabilityStore.batchCreateSpans).toHaveBeenCalledTimes(1);

        // Retry 1 fails — event re-added with retryCount=2 (still <= maxRetries)
        await exporter.flush();
        expect(mockObservabilityStore.batchCreateSpans).toHaveBeenCalledTimes(2);

        // Retry 2 fails — retryCount goes to 3, exceeds maxRetries=2, dropped
        await exporter.flush();
        expect(mockObservabilityStore.batchCreateSpans).toHaveBeenCalledTimes(3);

        // Fourth flush — nothing left in buffer
        await exporter.flush();
        expect(mockObservabilityStore.batchCreateSpans).toHaveBeenCalledTimes(3); // Not called again
      });
    });

    describe('Flush', () => {
      it('should flush buffered events without shutting down', async () => {
        const exporter = new MastraStorageExporter({
          strategy: 'batch-with-updates',
          maxBatchSize: 10, // Ensure single event doesn't trigger auto-flush
          logger: mockLogger,
        });
        await exporter.init({ mastra: mockMastra });

        const mockEvent = createMockEvent(TracingEventType.SPAN_STARTED);
        await exporter.exportTracingEvent(mockEvent);

        // Call public flush() method
        await exporter.flush();

        expect(mockLogger.debug).toHaveBeenCalledWith('Flushing buffered events', { bufferedEvents: 1 });
        expect(mockObservabilityStore.batchCreateSpans).toHaveBeenCalled();

        // Exporter should still be usable after flush
        const anotherEvent = createMockEvent(TracingEventType.SPAN_STARTED, 'trace-2', 'span-2');
        await exporter.exportTracingEvent(anotherEvent);

        // Flush the second event too
        await exporter.flush();
        expect(mockObservabilityStore.batchCreateSpans).toHaveBeenCalledTimes(2);

        await exporter.shutdown();
      });

      it('should be a no-op when buffer is empty', async () => {
        const exporter = new MastraStorageExporter({
          strategy: 'batch-with-updates',
          logger: mockLogger,
        });
        await exporter.init({ mastra: mockMastra });

        // Call flush on empty buffer
        await exporter.flush();

        // Should not have called batchCreateSpans
        expect(mockObservabilityStore.batchCreateSpans).not.toHaveBeenCalled();

        await exporter.shutdown();
      });
    });

    describe('Shutdown', () => {
      it('should flush remaining events on shutdown', async () => {
        const exporter = new MastraStorageExporter({
          strategy: 'batch-with-updates',
          maxBatchSize: 10, // Ensure single event doesn't trigger auto-flush
          logger: mockLogger,
        });
        await exporter.init({ mastra: mockMastra });

        const mockEvent = createMockEvent(TracingEventType.SPAN_STARTED);
        await exporter.exportTracingEvent(mockEvent);

        await exporter.shutdown();

        expect(mockObservabilityStore.batchCreateSpans).toHaveBeenCalled();
      });
    });

    describe('Memory management', () => {
      it('should clean up completed spans — updates after end should not be deferred', async () => {
        const exporter = new MastraStorageExporter({
          strategy: 'batch-with-updates',
          maxBatchWaitMs: 100,
          maxBatchSize: 10,
          logger: mockLogger,
        });
        await exporter.init({ mastra: mockMastra });

        // Send span start and end events
        const span1Start = createMockEvent(TracingEventType.SPAN_STARTED, 'trace-1', 'span-1');
        const span1End = createMockEvent(TracingEventType.SPAN_ENDED, 'trace-1', 'span-1');
        const span2Start = createMockEvent(TracingEventType.SPAN_STARTED, 'trace-1', 'span-2');

        await exporter.exportTracingEvent(span1Start);
        await exporter.exportTracingEvent(span1End);
        await exporter.exportTracingEvent(span2Start);

        // Flush — span-1 created and ended, span-2 created
        await exporter.flush();

        expect(mockObservabilityStore.batchCreateSpans).toHaveBeenCalledWith({
          records: expect.arrayContaining([
            expect.objectContaining({ spanId: 'span-1' }),
            expect.objectContaining({ spanId: 'span-2' }),
          ]),
        });
        // span-1 end should be an update
        expect(mockObservabilityStore.batchUpdateSpans).toHaveBeenCalled();

        mockObservabilityStore.batchCreateSpans.mockClear();
        mockObservabilityStore.batchUpdateSpans.mockClear();

        // Now complete span-2
        const span2End = createMockEvent(TracingEventType.SPAN_ENDED, 'trace-1', 'span-2');
        await exporter.exportTracingEvent(span2End);

        // Flush again — span-2 end should succeed (not deferred)
        await exporter.flush();

        expect(mockObservabilityStore.batchUpdateSpans).toHaveBeenCalledWith({
          records: expect.arrayContaining([expect.objectContaining({ spanId: 'span-2' })]),
        });

        await exporter.shutdown();
      });
    });

    describe('Out-of-order span handling with delayed ends', () => {
      it('should handle spans that end after buffer has been flushed', async () => {
        const exporter = new MastraStorageExporter({
          strategy: 'batch-with-updates',
          maxBatchWaitMs: 100, // Short wait time for faster test
          maxBatchSize: 10, // High enough to not trigger size-based flush
          logger: mockLogger,
        });
        await exporter.init({ mastra: mockMastra });

        // Simulate workflow with nested spans like the example
        const workflowStartEvent = createMockEvent(TracingEventType.SPAN_STARTED, 'trace-1', 'workflow-1');
        const step1StartEvent = createMockEvent(TracingEventType.SPAN_STARTED, 'trace-1', 'step-1');

        // Send start events
        await exporter.exportTracingEvent(workflowStartEvent);
        await exporter.exportTracingEvent(step1StartEvent);

        // Flush the start events
        await exporter.flush();

        // Verify the creates were flushed
        expect(mockObservabilityStore.batchCreateSpans).toHaveBeenCalledWith({
          records: expect.arrayContaining([
            expect.objectContaining({ spanId: 'workflow-1' }),
            expect.objectContaining({ spanId: 'step-1' }),
          ]),
        });

        // Clear the mock calls to make assertions clearer
        mockObservabilityStore.batchCreateSpans.mockClear();
        mockObservabilityStore.batchUpdateSpans.mockClear();
        mockLogger.warn.mockClear();

        // Now send update and end events after the buffer has been cleared
        const step1UpdateEvent = createMockEvent(TracingEventType.SPAN_UPDATED, 'trace-1', 'step-1');
        const step1EndEvent = createMockEvent(TracingEventType.SPAN_ENDED, 'trace-1', 'step-1');
        const step2StartEvent = createMockEvent(TracingEventType.SPAN_STARTED, 'trace-1', 'step-2');

        await exporter.exportTracingEvent(step1UpdateEvent);
        await exporter.exportTracingEvent(step1EndEvent);
        await exporter.exportTracingEvent(step2StartEvent);

        // Flush the updates and new create
        await exporter.flush();

        // Now send more update and end events
        const step2EndEvent = createMockEvent(TracingEventType.SPAN_ENDED, 'trace-1', 'step-2');
        const workflowUpdateEvent = createMockEvent(TracingEventType.SPAN_UPDATED, 'trace-1', 'workflow-1');
        const workflowEndEvent = createMockEvent(TracingEventType.SPAN_ENDED, 'trace-1', 'workflow-1');

        await exporter.exportTracingEvent(step2EndEvent);
        await exporter.exportTracingEvent(workflowUpdateEvent);
        await exporter.exportTracingEvent(workflowEndEvent);

        // Flush any remaining events
        await (exporter as any).flush();

        // We should NOT have any errors or warnings logged
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();

        // All update and end events should be properly stored
        expect(mockObservabilityStore.batchUpdateSpans).toHaveBeenCalled();
        const updateCalls = mockObservabilityStore.batchUpdateSpans.mock.calls;
        const allUpdates = updateCalls.flatMap((call: any) => call[0].records);

        // Find all updates for each span (there can be multiple per span)
        const step1Updates = allUpdates.filter((u: any) => u.spanId === 'step-1');
        const workflowUpdates = allUpdates.filter((u: any) => u.spanId === 'workflow-1');
        const step2Updates = allUpdates.filter((u: any) => u.spanId === 'step-2');

        // Verify step-1 has both an update and an end event
        expect(step1Updates.length).toBe(2); // One SPAN_UPDATED, one SPAN_ENDED
        const step1EndUpdate = step1Updates.find((u: any) => u.updates.endedAt);
        expect(step1EndUpdate).toBeDefined();
        expect(step1EndUpdate.updates.endedAt).toBeInstanceOf(Date);

        // Verify workflow has both an update and an end event
        expect(workflowUpdates.length).toBe(2); // One SPAN_UPDATED, one SPAN_ENDED
        const workflowEndUpdate = workflowUpdates.find((u: any) => u.updates.endedAt);
        expect(workflowEndUpdate).toBeDefined();
        expect(workflowEndUpdate.updates.endedAt).toBeInstanceOf(Date);

        // Verify step-2 has an end event
        expect(step2Updates.length).toBe(1); // Only SPAN_ENDED (no update sent)
        expect(step2Updates[0].updates.endedAt).toBeInstanceOf(Date);

        // Clean up any remaining timers
        await exporter.shutdown();
      });
    });

    describe('Event-sourced strategy', () => {
      it('should route SPAN_STARTED to creates (batchCreateSpans)', async () => {
        mockObservabilityStore.observabilityStrategy = {
          preferred: 'event-sourced',
          supported: ['event-sourced'],
        };
        const exporter = new MastraStorageExporter({
          strategy: 'event-sourced',
          maxBatchSize: 10,
          logger: mockLogger,
        });
        await exporter.init({ mastra: mockMastra });

        const event = createMockEvent(TracingEventType.SPAN_STARTED, 'trace-1', 'span-1');
        await exporter.exportTracingEvent(event);

        await exporter.flush();

        expect(mockObservabilityStore.batchCreateSpans).toHaveBeenCalledWith({
          records: expect.arrayContaining([expect.objectContaining({ spanId: 'span-1', traceId: 'trace-1' })]),
        });
        expect(mockObservabilityStore.batchUpdateSpans).not.toHaveBeenCalled();

        await exporter.shutdown();
      });

      it('should ignore SPAN_UPDATED events', async () => {
        mockObservabilityStore.observabilityStrategy = {
          preferred: 'event-sourced',
          supported: ['event-sourced'],
        };
        const exporter = new MastraStorageExporter({
          strategy: 'event-sourced',
          maxBatchSize: 10,
          logger: mockLogger,
        });
        await exporter.init({ mastra: mockMastra });

        // Start then update
        await exporter.exportTracingEvent(createMockEvent(TracingEventType.SPAN_STARTED, 'trace-1', 'span-1'));
        await exporter.exportTracingEvent(createMockEvent(TracingEventType.SPAN_UPDATED, 'trace-1', 'span-1'));

        await exporter.flush();

        // Only the start event should be created; update is ignored
        expect(mockObservabilityStore.batchCreateSpans).toHaveBeenCalledTimes(1);
        const creates = mockObservabilityStore.batchCreateSpans.mock.calls[0][0].records;
        expect(creates).toHaveLength(1);
        expect(mockObservabilityStore.batchUpdateSpans).not.toHaveBeenCalled();

        await exporter.shutdown();
      });

      it('should route SPAN_ENDED to creates for non-event spans', async () => {
        mockObservabilityStore.observabilityStrategy = {
          preferred: 'event-sourced',
          supported: ['event-sourced'],
        };
        const exporter = new MastraStorageExporter({
          strategy: 'event-sourced',
          maxBatchSize: 10,
          logger: mockLogger,
        });
        await exporter.init({ mastra: mockMastra });

        await exporter.exportTracingEvent(createMockEvent(TracingEventType.SPAN_STARTED, 'trace-1', 'span-1'));
        await exporter.exportTracingEvent(createMockEvent(TracingEventType.SPAN_ENDED, 'trace-1', 'span-1'));

        await exporter.flush();

        // Both start and end go to batchCreateSpans (append-only)
        expect(mockObservabilityStore.batchCreateSpans).toHaveBeenCalledTimes(1);
        const creates = mockObservabilityStore.batchCreateSpans.mock.calls[0][0].records;
        expect(creates).toHaveLength(2);
        expect(mockObservabilityStore.batchUpdateSpans).not.toHaveBeenCalled();

        await exporter.shutdown();
      });

      it('should route event-type SPAN_ENDED to creates (batchCreateSpans)', async () => {
        mockObservabilityStore.observabilityStrategy = {
          preferred: 'event-sourced',
          supported: ['event-sourced'],
        };
        const exporter = new MastraStorageExporter({
          strategy: 'event-sourced',
          maxBatchSize: 10,
          logger: mockLogger,
        });
        await exporter.init({ mastra: mockMastra });

        // Event-type spans only emit SPAN_ENDED
        await exporter.exportTracingEvent(createMockEvent(TracingEventType.SPAN_ENDED, 'trace-1', 'event-1', true));

        await exporter.flush();

        expect(mockObservabilityStore.batchCreateSpans).toHaveBeenCalledWith({
          records: expect.arrayContaining([expect.objectContaining({ spanId: 'event-1' })]),
        });
        expect(mockObservabilityStore.batchUpdateSpans).not.toHaveBeenCalled();

        await exporter.shutdown();
      });

      it('should handle full lifecycle — only start and end are persisted', async () => {
        mockObservabilityStore.observabilityStrategy = {
          preferred: 'event-sourced',
          supported: ['event-sourced'],
        };
        const exporter = new MastraStorageExporter({
          strategy: 'event-sourced',
          maxBatchSize: 10,
          logger: mockLogger,
        });
        await exporter.init({ mastra: mockMastra });

        await exporter.exportTracingEvent(createMockEvent(TracingEventType.SPAN_STARTED, 'trace-1', 'span-1'));
        await exporter.exportTracingEvent(createMockEvent(TracingEventType.SPAN_UPDATED, 'trace-1', 'span-1'));
        await exporter.exportTracingEvent(createMockEvent(TracingEventType.SPAN_UPDATED, 'trace-1', 'span-1'));
        await exporter.exportTracingEvent(createMockEvent(TracingEventType.SPAN_ENDED, 'trace-1', 'span-1'));

        await exporter.flush();

        // 2 creates (start + end), updates are ignored
        expect(mockObservabilityStore.batchCreateSpans).toHaveBeenCalledTimes(1);
        const creates = mockObservabilityStore.batchCreateSpans.mock.calls[0][0].records;
        expect(creates).toHaveLength(2);

        // No updates — event-sourced ignores SPAN_UPDATED
        expect(mockObservabilityStore.batchUpdateSpans).not.toHaveBeenCalled();

        await exporter.shutdown();
      });

      it('should silently ignore SPAN_UPDATED without prior SPAN_STARTED', async () => {
        mockObservabilityStore.observabilityStrategy = {
          preferred: 'event-sourced',
          supported: ['event-sourced'],
        };
        const exporter = new MastraStorageExporter({
          strategy: 'event-sourced',
          maxBatchSize: 10,
          logger: mockLogger,
        });
        await exporter.init({ mastra: mockMastra });

        // Send update without start — event-sourced ignores updates entirely
        await exporter.exportTracingEvent(createMockEvent(TracingEventType.SPAN_UPDATED, 'trace-1', 'span-1'));

        await exporter.flush();

        // Nothing should be called — update was ignored
        expect(mockObservabilityStore.batchCreateSpans).not.toHaveBeenCalled();
        expect(mockObservabilityStore.batchUpdateSpans).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalledWith(
          'Out-of-order span update detected - deferring to next flush',
          expect.anything(),
        );

        await exporter.shutdown();
      });
    });

    describe('Non-tracing signal handlers', () => {
      it('onMetricEvent should prefer typed context and cost fields over labels and metadata', async () => {
        mockObservabilityStore.batchCreateMetrics = vi.fn().mockResolvedValue(undefined);
        const exporter = new MastraStorageExporter({ logger: mockLogger });
        await exporter.init({ mastra: mockMastra });

        const event: MetricEvent = {
          type: 'metric',
          metric: {
            metricId: 'metric-default-test-1',
            timestamp: new Date('2026-01-01T00:00:00Z'),
            traceId: 'trace-1',
            spanId: 'span-1',
            name: 'mastra_agent_duration_ms',
            value: 1,
            labels: {
              entity_type: EntityType.WORKFLOW_RUN,
              entity_name: 'legacy-agent-name',
              parent_type: EntityType.AGENT,
              parent_name: 'legacy-parent-name',
              service_name: 'legacy-service',
              other_label: 'kept',
            },
            correlationContext: {
              environment: 'production',
              entityType: EntityType.AGENT,
              entityName: 'my-agent',
              parentEntityType: EntityType.WORKFLOW_RUN,
              parentEntityName: 'my-workflow',
              serviceName: 'api-server',
            },
            costContext: {
              provider: 'openai',
              model: 'gpt-4o-mini',
              estimatedCost: 0.00123,
              costUnit: 'usd',
              costMetadata: {
                pricing_id: 'openai-gpt-4o-mini',
                tier_index: 0,
              },
            },
            metadata: {
              provider: 'legacy-provider',
              model: 'legacy-model',
              estimatedCost: 999,
              costUnit: 'legacy-unit',
              metadata_only: 'kept',
            },
          },
        };

        await exporter.onMetricEvent(event);
        await exporter.flush();

        const storedMetric = mockObservabilityStore.batchCreateMetrics.mock.calls[0][0].metrics[0];
        expect(storedMetric).toEqual(
          expect.objectContaining({
            metricId: 'metric-default-test-1',
            name: 'mastra_agent_duration_ms',
            value: 1,
            entityType: EntityType.AGENT,
            entityName: 'my-agent',
            parentEntityType: EntityType.WORKFLOW_RUN,
            parentEntityName: 'my-workflow',
            traceId: 'trace-1',
            spanId: 'span-1',
            provider: 'openai',
            model: 'gpt-4o-mini',
            estimatedCost: 0.00123,
            costUnit: 'usd',
            environment: 'production',
            serviceName: 'api-server',
            costMetadata: {
              pricing_id: 'openai-gpt-4o-mini',
              tier_index: 0,
            },
            labels: {
              other_label: 'kept',
            },
          }),
        );
        expect(storedMetric.metadata).toEqual(
          expect.objectContaining({
            metadata_only: 'kept',
            provider: 'legacy-provider',
            model: 'legacy-model',
            estimatedCost: 999,
            costUnit: 'legacy-unit',
          }),
        );

        await exporter.shutdown();
      });

      it('onMetricEvent should set null for missing entity fields', async () => {
        mockObservabilityStore.batchCreateMetrics = vi.fn().mockResolvedValue(undefined);
        const exporter = new MastraStorageExporter({ logger: mockLogger });
        await exporter.init({ mastra: mockMastra });

        const event: MetricEvent = {
          type: 'metric',
          metric: {
            metricId: 'metric-default-test-2',
            timestamp: new Date(),
            name: 'mastra_custom_metric',
            value: 42,
            labels: { status: 'ok' },
          },
        };

        await exporter.onMetricEvent(event);
        await exporter.flush();

        expect(mockObservabilityStore.batchCreateMetrics).toHaveBeenCalledWith({
          metrics: [
            expect.objectContaining({
              metricId: 'metric-default-test-2',
              entityType: null,
              entityName: null,
              parentEntityType: null,
              parentEntityName: null,
              rootEntityType: null,
              rootEntityName: null,
              traceId: null,
              spanId: null,
              provider: null,
              model: null,
              estimatedCost: null,
              costUnit: null,
              environment: null,
              serviceName: null,
              costMetadata: null,
              metadata: null,
              labels: { status: 'ok' },
            }),
          ],
        });

        await exporter.shutdown();
      });

      it('onScoreEvent should forward to batchCreateScores', async () => {
        mockObservabilityStore.batchCreateScores = vi.fn().mockResolvedValue(undefined);
        const exporter = new MastraStorageExporter({ logger: mockLogger });
        await exporter.init({ mastra: mockMastra });

        const event: ScoreEvent = {
          type: 'score',
          score: {
            scoreId: 'score-default-test',
            timestamp: new Date('2026-01-01T00:00:00Z'),
            traceId: 'trace-1',
            scorerId: 'relevance',
            score: 0.85,
            experimentId: 'exp-1',
          },
        };

        await exporter.onScoreEvent(event);
        await exporter.flush();

        expect(mockObservabilityStore.batchCreateScores).toHaveBeenCalledWith({
          scores: [
            expect.objectContaining({
              scoreId: 'score-default-test',
              traceId: 'trace-1',
              scorerId: 'relevance',
              score: 0.85,
              experimentId: 'exp-1',
            }),
          ],
        });

        await exporter.shutdown();
      });

      it('onFeedbackEvent should forward to batchCreateFeedback', async () => {
        mockObservabilityStore.batchCreateFeedback = vi.fn().mockResolvedValue(undefined);
        const exporter = new MastraStorageExporter({ logger: mockLogger });
        await exporter.init({ mastra: mockMastra });

        const event: FeedbackEvent = {
          type: 'feedback',
          feedback: {
            feedbackId: 'feedback-default-test',
            timestamp: new Date('2026-01-01T00:00:00Z'),
            traceId: 'trace-1',
            source: 'user',
            feedbackType: 'thumbs',
            value: 1,
          },
        };

        await exporter.onFeedbackEvent(event);
        await exporter.flush();

        expect(mockObservabilityStore.batchCreateFeedback).toHaveBeenCalledWith({
          feedbacks: [
            expect.objectContaining({
              feedbackId: 'feedback-default-test',
              traceId: 'trace-1',
              feedbackSource: 'user',
              feedbackType: 'thumbs',
              value: 1,
            }),
          ],
        });

        await exporter.shutdown();
      });

      it('onLogEvent should persist correlation context fields', async () => {
        mockObservabilityStore.batchCreateLogs = vi.fn().mockResolvedValue(undefined);
        const exporter = new MastraStorageExporter({ logger: mockLogger });
        await exporter.init({ mastra: mockMastra });

        const event: LogEvent = {
          type: 'log',
          log: {
            logId: 'log-default-test',
            timestamp: new Date('2026-01-01T00:00:00Z'),
            traceId: 'trace-1',
            level: 'info',
            message: 'Agent started',
            correlationContext: {
              entityType: EntityType.AGENT,
              entityName: 'my-agent',
              environment: 'production',
            },
            metadata: {
              entity_type: 'agent',
              entity_name: 'my-agent',
              environment: 'production',
            },
          },
        };

        await exporter.onLogEvent(event);
        await exporter.flush();

        expect(mockObservabilityStore.batchCreateLogs).toHaveBeenCalledWith({
          logs: [
            expect.objectContaining({
              logId: 'log-default-test',
              level: 'info',
              message: 'Agent started',
              entityType: EntityType.AGENT,
              entityName: 'my-agent',
              environment: 'production',
            }),
          ],
        });

        await exporter.shutdown();
      });

      it('signal handlers should be no-ops when storage not initialized', async () => {
        const exporter = new MastraStorageExporter({ logger: mockLogger });
        // Don't call init — storage is not available

        const metricEvent: MetricEvent = {
          type: 'metric',
          metric: { metricId: 'metric-default-noop', timestamp: new Date(), name: 'test', value: 1, labels: {} },
        };

        // Should not throw
        await exporter.onMetricEvent(metricEvent);

        // Exporter didn't init, so no storage interaction happened (no error thrown)
      });
    });

    function createMockEvent(
      type: TracingEventType,
      traceId = 'trace-1',
      spanId = 'span-1',
      isEvent = false,
    ): TracingEvent {
      return {
        type,
        exportedSpan: {
          id: spanId,
          traceId,
          type: SpanType.GENERIC,
          name: 'test-span',
          startTime: new Date(),
          endTime: type === TracingEventType.SPAN_ENDED ? new Date() : undefined,
          isEvent,
          attributes: { test: 'value' },
          metadata: undefined,
          input: 'test input',
          output: type === TracingEventType.SPAN_ENDED ? 'test output' : undefined,
        } as any as AnyExportedSpan,
      };
    }
  });
});
