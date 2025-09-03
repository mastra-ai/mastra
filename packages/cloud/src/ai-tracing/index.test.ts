import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AITracingEventType } from '@mastra/core/ai-tracing';
import type { AITracingEvent, AnyAISpan } from '@mastra/core/ai-tracing';
import { AISpanType } from '@mastra/core/ai-tracing';

import { CloudAITracingExporter } from '.';
import { fetchWithRetry } from '../utils/fetchWithRetry';

// Mock fetchWithRetry
vi.mock('../utils/fetchWithRetry', () => ({
  fetchWithRetry: vi.fn(),
}));

const mockFetchWithRetry = vi.mocked(fetchWithRetry);

// Helper to create a valid JWT token for testing
function createTestJWT(payload: { teamId: string; projectId: string }): string {
  const header = { typ: 'JWT', alg: 'HS256' };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = 'fake-signature'; // We don't verify, so this can be anything

  return `${headerB64}.${payloadB64}.${signature}`;
}

describe('CloudAITracingExporter', () => {
  let exporter: CloudAITracingExporter;
  const testJWT = createTestJWT({ teamId: 'team-123', projectId: 'project-456' });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementation to default success
    mockFetchWithRetry.mockResolvedValue(new Response('{}', { status: 200 }));
    mockFetchWithRetry.mockReset();

    exporter = new CloudAITracingExporter({
      accessToken: testJWT,
      endpoint: 'http://localhost:3000/api',
    });
  });

  describe('Core Event Filtering', () => {
    const mockSpan: AnyAISpan = {
      id: 'span-123',
      name: 'test-span',
      type: AISpanType.LLM_GENERATION,
      startTime: new Date(),
      endTime: new Date(),
      isEvent: false,
      traceId: 'trace-456',
      parent: undefined,
      trace: {} as AnyAISpan,
      aiTracing: {} as any,
      input: { prompt: 'test' },
      output: { response: 'result' },
      end: vi.fn(),
      error: vi.fn(),
      update: vi.fn(),
      createChildSpan: vi.fn(),
      createEventSpan: vi.fn(),
      get isRootSpan() {
        return true;
      },
    };

    it('should process SPAN_ENDED events', async () => {
      const spanEndedEvent: AITracingEvent = {
        type: AITracingEventType.SPAN_ENDED,
        span: mockSpan,
      };

      // Mock the internal buffer to verify span was added
      const addToBufferSpy = vi.spyOn(exporter as any, 'addToBuffer');

      await exporter.exportEvent(spanEndedEvent);

      expect(addToBufferSpy).toHaveBeenCalledWith(spanEndedEvent);
    });

    it('should ignore SPAN_STARTED events', async () => {
      const spanStartedEvent: AITracingEvent = {
        type: AITracingEventType.SPAN_STARTED,
        span: mockSpan,
      };

      const addToBufferSpy = vi.spyOn(exporter as any, 'addToBuffer');

      await exporter.exportEvent(spanStartedEvent);

      expect(addToBufferSpy).not.toHaveBeenCalled();
    });

    it('should ignore SPAN_UPDATED events', async () => {
      const spanUpdatedEvent: AITracingEvent = {
        type: AITracingEventType.SPAN_UPDATED,
        span: mockSpan,
      };

      const addToBufferSpy = vi.spyOn(exporter as any, 'addToBuffer');

      await exporter.exportEvent(spanUpdatedEvent);

      expect(addToBufferSpy).not.toHaveBeenCalled();
    });

    it('should only increment buffer size for SPAN_ENDED events', async () => {
      const events: AITracingEvent[] = [
        { type: AITracingEventType.SPAN_STARTED, span: mockSpan },
        { type: AITracingEventType.SPAN_UPDATED, span: mockSpan },
        { type: AITracingEventType.SPAN_ENDED, span: mockSpan },
      ];

      for (const event of events) {
        await exporter.exportEvent(event);
      }

      // Access private buffer to check size
      const buffer = (exporter as any).buffer;
      expect(buffer.totalSize).toBe(1); // Only SPAN_ENDED should be counted
      expect(buffer.spans).toHaveLength(1);
    });
  });

  describe('Buffer Management', () => {
    const mockSpan: AnyAISpan = {
      id: 'span-123',
      name: 'test-span',
      type: AISpanType.LLM_GENERATION,
      startTime: new Date(),
      endTime: new Date(),
      isEvent: false,
      traceId: 'trace-456',
      parent: undefined,
      trace: {} as AnyAISpan,
      aiTracing: {} as any,
      input: { prompt: 'test' },
      output: { response: 'result' },
      end: vi.fn(),
      error: vi.fn(),
      update: vi.fn(),
      createChildSpan: vi.fn(),
      createEventSpan: vi.fn(),
      get isRootSpan() {
        return true;
      },
    };

    it('should initialize buffer with empty state', () => {
      const buffer = (exporter as any).buffer;

      expect(buffer.spans).toEqual([]);
      expect(buffer.totalSize).toBe(0);
      expect(buffer.firstEventTime).toBeUndefined();
    });

    it('should set firstEventTime when adding first span to empty buffer', async () => {
      const beforeTime = Date.now();

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: mockSpan,
      });

      const buffer = (exporter as any).buffer;
      const afterTime = Date.now();

      expect(buffer.firstEventTime).toBeInstanceOf(Date);
      expect(buffer.firstEventTime.getTime()).toBeGreaterThanOrEqual(beforeTime);
      expect(buffer.firstEventTime.getTime()).toBeLessThanOrEqual(afterTime);
    });

    it('should not update firstEventTime when adding subsequent spans', async () => {
      // Add first span
      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: mockSpan,
      });

      const buffer = (exporter as any).buffer;
      const firstTime = buffer.firstEventTime;

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Add second span
      const secondSpan = { ...mockSpan, id: 'span-456' };
      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: secondSpan,
      });

      // firstEventTime should not have changed
      expect(buffer.firstEventTime).toBe(firstTime);
      expect(buffer.totalSize).toBe(2);
    });

    it('should increment totalSize correctly', async () => {
      const buffer = (exporter as any).buffer;

      expect(buffer.totalSize).toBe(0);

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: mockSpan,
      });
      expect(buffer.totalSize).toBe(1);

      const secondSpan = { ...mockSpan, id: 'span-456' };
      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: secondSpan,
      });
      expect(buffer.totalSize).toBe(2);
    });

    it('should add spans with correct structure to buffer', async () => {
      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: mockSpan,
      });

      const buffer = (exporter as any).buffer;
      const spanRecord = buffer.spans[0];

      expect(spanRecord).toMatchObject({
        teamId: 'team-123',
        projectId: 'project-456',
        traceId: mockSpan.traceId,
        spanId: mockSpan.id,
        parentSpanId: null,
        name: mockSpan.name,
        spanType: mockSpan.type,
        startedAt: mockSpan.startTime,
        endedAt: mockSpan.endTime,
        input: mockSpan.input,
        output: mockSpan.output,
        error: mockSpan.errorInfo,
        isEvent: mockSpan.isEvent,
        updatedAt: null,
      });

      expect(spanRecord.createdAt).toBeInstanceOf(Date);
    });

    it('should reset buffer correctly', () => {
      const buffer = (exporter as any).buffer;
      const resetBuffer = (exporter as any).resetBuffer.bind(exporter);

      // Simulate buffer with data
      buffer.spans = [{ id: 'test' }];
      buffer.totalSize = 1;
      buffer.firstEventTime = new Date();

      resetBuffer();

      expect(buffer.spans).toEqual([]);
      expect(buffer.totalSize).toBe(0);
      expect(buffer.firstEventTime).toBeUndefined();
    });

    it('should handle parent span references', async () => {
      const parentSpan: AnyAISpan = {
        ...mockSpan,
        id: 'parent-span',
      };

      const childSpan: AnyAISpan = {
        ...mockSpan,
        id: 'child-span',
        parent: parentSpan,
      };

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: childSpan,
      });

      const buffer = (exporter as any).buffer;
      const spanRecord = buffer.spans[0];

      expect(spanRecord.parentSpanId).toBe('parent-span');
    });

    // it.only('should handle spans with null/undefined fields gracefully', async () => {
    //   const minimalSpan: AnyAISpan = {
    //     id: 'minimal-span',
    //     name: 'minimal',
    //     type: AISpanType.GENERIC,
    //     startTime: new Date(),
    //     endTime: undefined, // undefined endTime
    //     isEvent: false,
    //     traceId: 'trace-123',
    //     parent: undefined,
    //     trace: {} as AnyAISpan,
    //     aiTracing: {} as any,
    //     input: undefined, // undefined input
    //     output: undefined, // undefined output
    //     attributes: undefined, // undefined attributes
    //     metadata: undefined, // undefined metadata
    //     errorInfo: undefined, // undefined errorInfo
    //     end: vi.fn(),
    //     error: vi.fn(),
    //     update: vi.fn(),
    //     createChildSpan: vi.fn(),
    //     createEventSpan: vi.fn(),
    //     get isRootSpan() { return true; },
    //   };

    //   await exporter.exportEvent({
    //     type: AITracingEventType.SPAN_ENDED,
    //     span: minimalSpan,
    //   });

    //   const buffer = (exporter as any).buffer;
    //   const spanRecord = buffer.spans[0];

    //   expect(spanRecord.endedAt).toBeNull();
    //   expect(spanRecord.input).toBeUndefined();
    //   expect(spanRecord.output).toBeUndefined();
    //   expect(spanRecord.attributes).toBeNull();
    //   expect(spanRecord.metadata).toBeNull();
    //   expect(spanRecord.error).toBeUndefined();
    // });
  });

  describe('Flush Trigger Conditions', () => {
    const mockSpan: AnyAISpan = {
      id: 'span-123',
      name: 'test-span',
      type: AISpanType.LLM_GENERATION,
      startTime: new Date(),
      endTime: new Date(),
      isEvent: false,
      traceId: 'trace-456',
      parent: undefined,
      trace: {} as AnyAISpan,
      aiTracing: {} as any,
      input: { prompt: 'test' },
      output: { response: 'result' },
      end: vi.fn(),
      error: vi.fn(),
      update: vi.fn(),
      createChildSpan: vi.fn(),
      createEventSpan: vi.fn(),
      get isRootSpan() {
        return true;
      },
    };

    it('should trigger flush when maxBatchSize is reached', async () => {
      const smallBatchExporter = new CloudAITracingExporter({
        accessToken: createTestJWT({ teamId: 'test-team', projectId: 'test-project' }),
        endpoint: 'http://localhost:3000/api',
        maxBatchSize: 2, // Small batch size for testing
      });

      const flushSpy = vi.spyOn(smallBatchExporter as any, 'flush');
      const shouldFlushSpy = vi.spyOn(smallBatchExporter as any, 'shouldFlush');

      // Add first span - should not flush
      await smallBatchExporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: mockSpan,
      });

      expect(shouldFlushSpy).toHaveReturnedWith(false);
      expect(flushSpy).not.toHaveBeenCalled();

      // Add second span - should trigger flush
      const secondSpan = { ...mockSpan, id: 'span-456' };
      await smallBatchExporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: secondSpan,
      });

      expect(shouldFlushSpy).toHaveReturnedWith(true);
      expect(flushSpy).toHaveBeenCalled();
    });

    it('should schedule flush for first event in empty buffer', async () => {
      const scheduleFlushSpy = vi.spyOn(exporter as any, 'scheduleFlush');

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: mockSpan,
      });

      expect(scheduleFlushSpy).toHaveBeenCalledOnce();
    });

    it('should not schedule additional flushes for subsequent events', async () => {
      const scheduleFlushSpy = vi.spyOn(exporter as any, 'scheduleFlush');

      // Add first span
      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: mockSpan,
      });

      expect(scheduleFlushSpy).toHaveBeenCalledTimes(1);

      // Add second span - should not schedule again
      const secondSpan = { ...mockSpan, id: 'span-456' };
      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: secondSpan,
      });

      expect(scheduleFlushSpy).toHaveBeenCalledTimes(1); // Still only called once
    });

    it('should detect time-based flush condition', () => {
      const shouldFlush = (exporter as any).shouldFlush.bind(exporter);
      const buffer = (exporter as any).buffer;

      // Set up buffer with old firstEventTime
      buffer.totalSize = 1;
      buffer.firstEventTime = new Date(Date.now() - 6000); // 6 seconds ago (older than 5s default)

      expect(shouldFlush()).toBe(true);
    });

    it('should not trigger time-based flush for recent events', () => {
      const shouldFlush = (exporter as any).shouldFlush.bind(exporter);
      const buffer = (exporter as any).buffer;

      // Set up buffer with recent firstEventTime
      buffer.totalSize = 1;
      buffer.firstEventTime = new Date(Date.now() - 1000); // 1 second ago

      expect(shouldFlush()).toBe(false);
    });

    it('should not trigger flush for empty buffer', () => {
      const shouldFlush = (exporter as any).shouldFlush.bind(exporter);
      const buffer = (exporter as any).buffer;

      buffer.totalSize = 0;
      buffer.firstEventTime = new Date(Date.now() - 10000); // Old time but empty buffer

      expect(shouldFlush()).toBe(false);
    });
  });

  describe('Timer Management', () => {
    const mockSpan: AnyAISpan = {
      id: 'span-123',
      name: 'test-span',
      type: AISpanType.LLM_GENERATION,
      startTime: new Date(),
      endTime: new Date(),
      isEvent: false,
      traceId: 'trace-456',
      parent: undefined,
      trace: {} as AnyAISpan,
      aiTracing: {} as any,
      input: { prompt: 'test' },
      output: { response: 'result' },
      end: vi.fn(),
      error: vi.fn(),
      update: vi.fn(),
      createChildSpan: vi.fn(),
      createEventSpan: vi.fn(),
      get isRootSpan() {
        return true;
      },
    };

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should set timer when scheduling flush', async () => {
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: mockSpan,
      });

      expect(setTimeoutSpy).toHaveBeenCalledWith(
        expect.any(Function),
        5000, // Default maxBatchWaitMs
      );
    });

    it('should clear existing timer when scheduling new flush', () => {
      const scheduleFlush = (exporter as any).scheduleFlush.bind(exporter);
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      // Set initial timer
      (exporter as any).flushTimer = setTimeout(() => {}, 1000);
      const initialTimer = (exporter as any).flushTimer;

      // Schedule new flush
      scheduleFlush();

      expect(clearTimeoutSpy).toHaveBeenCalledWith(initialTimer);
    });

    it('should trigger flush when timer expires', async () => {
      const flushSpy = vi.spyOn(exporter as any, 'flush').mockResolvedValue(undefined);

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: mockSpan,
      });

      // Fast-forward timer
      vi.advanceTimersByTime(5000);

      expect(flushSpy).toHaveBeenCalled();
    });

    it('should clear timer after flush', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: mockSpan,
      });

      // Trigger flush
      await (exporter as any).flush();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect((exporter as any).flushTimer).toBeNull();
    });

    it.only('should handle timer errors gracefully', async () => {
      const loggerErrorSpy = vi.spyOn((exporter as any).logger, 'error');

      // Mock flush to throw error
      vi.spyOn(exporter as any, 'flush').mockRejectedValue(new Error('Flush failed'));

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: mockSpan,
      });

      // Fast-forward timer to trigger flush
      vi.advanceTimersByTime(5000);

      // Wait for error handling
      await vi.runAllTimersAsync();

      expect(loggerErrorSpy).toHaveBeenCalledWith('Scheduled flush failed', {
        error: 'Flush failed',
      });
    });

    it('should clear timer on flush and set flushTimer to null', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: mockSpan,
      });

      // Verify timer is set
      expect((exporter as any).flushTimer).not.toBeNull();

      // Trigger flush manually
      await (exporter as any).flush();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect((exporter as any).flushTimer).toBeNull();
    });

    it('should handle flush when flushTimer is null', async () => {
      // Ensure flushTimer starts as null
      expect((exporter as any).flushTimer).toBeNull();

      // Add event to buffer
      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: mockSpan,
      });

      // Manually clear the timer that was set
      const timer = (exporter as any).flushTimer;
      clearTimeout(timer);
      (exporter as any).flushTimer = null;

      // Flush should work even when timer is null
      await expect((exporter as any).flush()).resolves.not.toThrow();
    });

    it('should not clear timer when flushTimer is already null', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      // Ensure flushTimer is null
      (exporter as any).flushTimer = null;

      await (exporter as any).flush();

      // clearTimeout should not be called when timer is null
      expect(clearTimeoutSpy).not.toHaveBeenCalled();
    });

    it('should handle multiple timer schedules correctly', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      // Schedule first flush
      (exporter as any).scheduleFlush();
      const firstTimer = (exporter as any).flushTimer;
      expect(setTimeoutSpy).toHaveBeenCalledTimes(1);

      // Schedule second flush - should clear first timer
      (exporter as any).scheduleFlush();
      const secondTimer = (exporter as any).flushTimer;

      expect(clearTimeoutSpy).toHaveBeenCalledWith(firstTimer);
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
      expect(secondTimer).not.toBe(firstTimer);
    });
  });

  describe('Cloud API Integration', () => {
    const mockSpan: AnyAISpan = {
      id: 'span-123',
      name: 'test-span',
      type: AISpanType.LLM_GENERATION,
      startTime: new Date(),
      endTime: new Date(),
      isEvent: false,
      traceId: 'trace-456',
      parent: undefined,
      trace: {} as AnyAISpan,
      aiTracing: {} as any,
      input: { prompt: 'test' },
      output: { response: 'result' },
      end: vi.fn(),
      error: vi.fn(),
      update: vi.fn(),
      createChildSpan: vi.fn(),
      createEventSpan: vi.fn(),
      get isRootSpan() {
        return true;
      },
    };

    beforeEach(() => {
      vi.clearAllMocks();
      mockFetchWithRetry.mockResolvedValue(new Response('{}', { status: 200 }));
    });

    it('should call cloud API with correct URL and headers', async () => {
      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: mockSpan,
      });

      // Trigger immediate flush
      await (exporter as any).flush();

      expect(mockFetchWithRetry).toHaveBeenCalledWith(
        'http://localhost:3000/api/ai-traces/batch',
        {
          method: 'POST',
          headers: {
            Authorization: expect.stringMatching(/^Bearer .+/),
            'Content-Type': 'application/json',
          },
          body: expect.any(String),
        },
        3, // Single attempt at HTTP level
      );
    });

    it('should send spans in correct format', async () => {
      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: mockSpan,
      });

      await (exporter as any).flush();

      const callArgs = mockFetchWithRetry.mock.calls[0];
      const requestOptions = callArgs[1] as RequestInit;
      const requestBody = JSON.parse(requestOptions.body as string);

      expect(requestBody).toMatchObject({
        spans: [
          {
            teamId: 'team-123',
            projectId: 'project-456',
            traceId: mockSpan.traceId,
            spanId: mockSpan.id,
            name: mockSpan.name,
            spanType: mockSpan.type,
            input: mockSpan.input,
            output: mockSpan.output,
            isEvent: mockSpan.isEvent,
          },
        ],
      });

      expect(requestBody.spans[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(requestBody.spans[0].updatedAt).toBeNull();
    });

    it('should use JWT token in Authorization header', async () => {
      const testJWT = createTestJWT({ teamId: 'auth-test', projectId: 'auth-project' });
      const authExporter = new CloudAITracingExporter({
        accessToken: testJWT,
        endpoint: 'http://localhost:3000/api',
      });

      await authExporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: mockSpan,
      });

      await (authExporter as any).flush();

      const callArgs = mockFetchWithRetry.mock.calls[0];
      const requestOptions = callArgs[1] as RequestInit;
      const headers = requestOptions.headers as Record<string, string>;

      expect(headers.Authorization).toBe(`Bearer ${testJWT}`);
    });

    it('should handle multiple spans in batch', async () => {
      const spans = [
        { ...mockSpan, id: 'span-1' },
        { ...mockSpan, id: 'span-2' },
        { ...mockSpan, id: 'span-3' },
      ];

      for (const span of spans) {
        await exporter.exportEvent({
          type: AITracingEventType.SPAN_ENDED,
          span,
        });
      }

      await (exporter as any).flush();

      const callArgs = mockFetchWithRetry.mock.calls[0];
      const requestOptions = callArgs[1] as RequestInit;
      const requestBody = JSON.parse(requestOptions.body as string);

      expect(requestBody.spans).toHaveLength(3);
      expect(requestBody.spans[0].spanId).toBe('span-1');
      expect(requestBody.spans[1].spanId).toBe('span-2');
      expect(requestBody.spans[2].spanId).toBe('span-3');
    });

    it('should log successful flush', async () => {
      const loggerDebugSpy = vi.spyOn((exporter as any).logger, 'debug');

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: mockSpan,
      });

      await (exporter as any).flush();

      expect(loggerDebugSpy).toHaveBeenCalledWith('Batch flushed successfully', {
        batchSize: 1,
        flushReason: 'time',
        durationMs: expect.any(Number),
      });
    });
  });

  describe('Attribute Serialization', () => {
    const mockSpan: AnyAISpan = {
      id: 'span-123',
      name: 'test-span',
      type: AISpanType.LLM_GENERATION,
      startTime: new Date(),
      endTime: new Date(),
      isEvent: false,
      traceId: 'trace-456',
      parent: undefined,
      trace: {} as AnyAISpan,
      aiTracing: {} as any,
      input: { prompt: 'test' },
      output: { response: 'result' },
      end: vi.fn(),
      error: vi.fn(),
      update: vi.fn(),
      createChildSpan: vi.fn(),
      createEventSpan: vi.fn(),
      get isRootSpan() {
        return true;
      },
    };

    it('should serialize basic attributes correctly', async () => {
      const spanWithBasicAttributes: AnyAISpan = {
        ...mockSpan,
        attributes: {
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 100,
          isStreaming: true,
        },
      };

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: spanWithBasicAttributes,
      });

      const buffer = (exporter as any).buffer;
      const spanRecord = buffer.spans[0];

      expect(spanRecord.attributes).toEqual({
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 100,
        isStreaming: true,
      });
    });

    it('should serialize Date objects as ISO strings', async () => {
      const testDate = new Date('2023-12-01T10:00:00Z');
      const spanWithDateAttributes: AnyAISpan = {
        ...mockSpan,
        attributes: {
          createdAt: testDate,
          model: 'gpt-4',
        },
      };

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: spanWithDateAttributes,
      });

      const buffer = (exporter as any).buffer;
      const spanRecord = buffer.spans[0];

      expect(spanRecord.attributes).toEqual({
        createdAt: '2023-12-01T10:00:00.000Z',
        model: 'gpt-4',
      });
    });

    it('should serialize nested objects correctly', async () => {
      const spanWithNestedAttributes: AnyAISpan = {
        ...mockSpan,
        attributes: {
          model: 'gpt-4',
          options: {
            temperature: 0.7,
            maxTokens: 100,
            metadata: {
              userId: 'user-123',
              sessionId: 'session-456',
            },
          },
          tags: ['important', 'production'],
        },
      };

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: spanWithNestedAttributes,
      });

      const buffer = (exporter as any).buffer;
      const spanRecord = buffer.spans[0];

      expect(spanRecord.attributes).toEqual({
        model: 'gpt-4',
        options: {
          temperature: 0.7,
          maxTokens: 100,
          metadata: {
            userId: 'user-123',
            sessionId: 'session-456',
          },
        },
        tags: ['important', 'production'],
      });
    });

    it('should handle mixed complex types in attributes', async () => {
      const testDate = new Date('2023-12-01T10:00:00Z');
      const spanWithMixedAttributes: AnyAISpan = {
        ...mockSpan,
        attributes: {
          model: 'gpt-4',
          createdAt: testDate,
          config: {
            temperature: 0.7,
            timestamp: testDate,
            nested: {
              date: testDate,
              value: 42,
            },
          },
          primitiveArray: [1, 2, 'three'],
          dateArray: [testDate, new Date('2023-12-02T10:00:00Z')],
        },
      };

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: spanWithMixedAttributes,
      });

      const buffer = (exporter as any).buffer;
      const spanRecord = buffer.spans[0];

      expect(spanRecord.attributes).toEqual({
        model: 'gpt-4',
        createdAt: '2023-12-01T10:00:00.000Z',
        config: {
          temperature: 0.7,
          timestamp: '2023-12-01T10:00:00.000Z',
          nested: {
            date: '2023-12-01T10:00:00.000Z',
            value: 42,
          },
        },
        primitiveArray: [1, 2, 'three'],
        dateArray: ['2023-12-01T10:00:00.000Z', '2023-12-02T10:00:00.000Z'],
      });
    });

    it('should return null for undefined attributes', async () => {
      const spanWithUndefinedAttributes: AnyAISpan = {
        ...mockSpan,
        attributes: undefined,
      };

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: spanWithUndefinedAttributes,
      });

      const buffer = (exporter as any).buffer;
      const spanRecord = buffer.spans[0];

      expect(spanRecord.attributes).toBeNull();
    });

    it('should handle serialization errors gracefully', async () => {
      const loggerWarnSpy = vi.spyOn((exporter as any).logger, 'warn');

      // Create a circular reference to cause JSON.stringify to fail
      const circularObj: any = { name: 'circular' };
      circularObj.self = circularObj;

      const spanWithCircularAttributes: AnyAISpan = {
        ...mockSpan,
        attributes: {
          model: 'gpt-4',
          circular: circularObj,
        },
      };

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: spanWithCircularAttributes,
      });

      const buffer = (exporter as any).buffer;
      const spanRecord = buffer.spans[0];

      expect(spanRecord.attributes).toBeNull();
      expect(loggerWarnSpy).toHaveBeenCalledWith('Failed to serialize span attributes, storing as null', {
        spanId: mockSpan.id,
        spanType: mockSpan.type,
        error: expect.any(String),
      });
    });

    it('should test serializeObject method directly', () => {
      const serializeObject = (exporter as any).serializeObject.bind(exporter);
      const testDate = new Date('2023-12-01T10:00:00Z');

      const spanWithObject: AnyAISpan = {
        ...mockSpan,
        attributes: {
          string: 'test',
          number: 42,
          boolean: true,
          date: testDate,
          object: { nested: 'value' },
          array: [1, 2, testDate],
        },
      };

      const result = serializeObject({
        obj: spanWithObject.attributes,
        spanId: spanWithObject.id,
        spanType: spanWithObject.type,
      });

      expect(result).toEqual({
        string: 'test',
        number: 42,
        boolean: true,
        date: '2023-12-01T10:00:00.000Z',
        object: { nested: 'value' },
        array: [1, 2, '2023-12-01T10:00:00.000Z'],
      });
    });
  });

  describe('Retry Logic and Error Handling', () => {
    const mockSpan: AnyAISpan = {
      id: 'span-123',
      name: 'test-span',
      type: AISpanType.LLM_GENERATION,
      startTime: new Date(),
      endTime: new Date(),
      isEvent: false,
      traceId: 'trace-456',
      parent: undefined,
      trace: {} as AnyAISpan,
      aiTracing: {} as any,
      input: { prompt: 'test' },
      output: { response: 'result' },
      end: vi.fn(),
      error: vi.fn(),
      update: vi.fn(),
      createChildSpan: vi.fn(),
      createEventSpan: vi.fn(),
      get isRootSpan() {
        return true;
      },
    };

    beforeEach(() => {
      vi.useFakeTimers();
      vi.clearAllMocks();
      // Reset mock to default success behavior
      mockFetchWithRetry.mockResolvedValue(new Response('{}', { status: 200 }));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should retry on API failures using fetchWithRetry', async () => {
      const retryExporter = new CloudAITracingExporter({
        accessToken: createTestJWT({ teamId: 'retry-team', projectId: 'retry-project' }),
        endpoint: 'http://localhost:3000/api',
        maxRetries: 3,
      });

      // Mock API to fail first two times, succeed on third
      mockFetchWithRetry
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Server error'))
        .mockResolvedValueOnce(new Response('{}', { status: 200 }));

      await retryExporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: mockSpan,
      });

      await (retryExporter as any).flush();

      // fetchWithRetry should be called with maxRetries parameter
      expect(mockFetchWithRetry).toHaveBeenCalledWith(
        'http://localhost:3000/api/ai-traces/batch',
        expect.any(Object),
        3, // maxRetries passed to fetchWithRetry
      );
    });

    it('should pass maxRetries to fetchWithRetry correctly', async () => {
      const customRetryExporter = new CloudAITracingExporter({
        accessToken: createTestJWT({ teamId: 'custom-team', projectId: 'custom-project' }),
        endpoint: 'http://localhost:3000/api',
        maxRetries: 5, // Custom retry count
      });

      mockFetchWithRetry.mockResolvedValue(new Response('{}', { status: 200 }));

      await customRetryExporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: mockSpan,
      });

      await (customRetryExporter as any).flush();

      expect(mockFetchWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        5, // Custom maxRetries value
      );
    });

    it('should drop batch after fetchWithRetry exhausts all retries', async () => {
      const retryExporter = new CloudAITracingExporter({
        accessToken: createTestJWT({ teamId: 'fail-team', projectId: 'fail-project' }),
        endpoint: 'http://localhost:3000/api',
        maxRetries: 2,
      });

      const loggerErrorSpy = vi.spyOn((retryExporter as any).logger, 'error');

      // Mock fetchWithRetry to always fail after exhausting retries
      mockFetchWithRetry.mockRejectedValue(new Error('Persistent failure'));

      await retryExporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: mockSpan,
      });

      // Flush should not throw - errors are caught and logged
      await (retryExporter as any).flush();

      expect(loggerErrorSpy).toHaveBeenCalledWith('Batch upload failed after all retries, dropping batch', {
        droppedBatchSize: 1,
        error: 'Persistent failure',
      });
    });

    it('should handle flush errors gracefully in background', async () => {
      const loggerErrorSpy = vi.spyOn((exporter as any).logger, 'error');

      // Mock fetchWithRetry to fail
      mockFetchWithRetry.mockRejectedValue(new Error('API down'));

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: mockSpan,
      });

      // Fast-forward to trigger scheduled flush - errors should be caught
      vi.advanceTimersByTime(5000);

      // Wait for async error handling
      await vi.runAllTimersAsync();

      // Should log the batch upload failure, not scheduled flush failure
      expect(loggerErrorSpy).toHaveBeenCalledWith('Batch upload failed after all retries, dropping batch', {
        droppedBatchSize: 1,
        error: 'API down',
      });
    });
  });

  describe('Shutdown Functionality', () => {
    const mockSpan: AnyAISpan = {
      id: 'span-123',
      name: 'test-span',
      type: AISpanType.LLM_GENERATION,
      startTime: new Date(),
      endTime: new Date(),
      isEvent: false,
      traceId: 'trace-456',
      parent: undefined,
      trace: {} as AnyAISpan,
      aiTracing: {} as any,
      input: { prompt: 'test' },
      output: { response: 'result' },
      end: vi.fn(),
      error: vi.fn(),
      update: vi.fn(),
      createChildSpan: vi.fn(),
      createEventSpan: vi.fn(),
      get isRootSpan() {
        return true;
      },
    };

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should clear timer on shutdown', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const loggerInfoSpy = vi.spyOn((exporter as any).logger, 'info');

      // Set up a timer by adding an event
      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: mockSpan,
      });

      const timer = (exporter as any).flushTimer;
      expect(timer).not.toBeNull();

      await exporter.shutdown();

      expect(clearTimeoutSpy).toHaveBeenCalledWith(timer);
      expect((exporter as any).flushTimer).toBeNull();
      expect(loggerInfoSpy).toHaveBeenCalledWith('CloudAITracingExporter shutdown complete');
    });

    it('should flush remaining events on shutdown', async () => {
      const flushSpy = vi.spyOn(exporter as any, 'flush').mockResolvedValue(undefined);
      const loggerInfoSpy = vi.spyOn((exporter as any).logger, 'info');

      // Add events to buffer
      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: mockSpan,
      });

      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: { ...mockSpan, id: 'span-456' },
      });

      const buffer = (exporter as any).buffer;
      expect(buffer.totalSize).toBe(2);

      await exporter.shutdown();

      expect(loggerInfoSpy).toHaveBeenCalledWith('Flushing remaining events on shutdown', {
        remainingEvents: 2,
      });
      expect(flushSpy).toHaveBeenCalled();
      expect(loggerInfoSpy).toHaveBeenCalledWith('CloudAITracingExporter shutdown complete');
    });

    it('should handle shutdown with empty buffer gracefully', async () => {
      const flushSpy = vi.spyOn(exporter as any, 'flush');
      const loggerInfoSpy = vi.spyOn((exporter as any).logger, 'info');

      const buffer = (exporter as any).buffer;
      expect(buffer.totalSize).toBe(0);

      await exporter.shutdown();

      // Should not call flush for empty buffer
      expect(flushSpy).not.toHaveBeenCalled();
      expect(loggerInfoSpy).toHaveBeenCalledWith('CloudAITracingExporter shutdown complete');
    });

    it('should handle shutdown flush errors gracefully', async () => {
      const flushError = new Error('Shutdown flush failed');
      vi.spyOn(exporter as any, 'flush').mockRejectedValue(flushError);
      const loggerErrorSpy = vi.spyOn((exporter as any).logger, 'error');
      const loggerInfoSpy = vi.spyOn((exporter as any).logger, 'info');

      // Add event to buffer
      await exporter.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        span: mockSpan,
      });

      await exporter.shutdown();

      expect(loggerErrorSpy).toHaveBeenCalledWith('Failed to flush remaining events during shutdown', {
        error: 'Shutdown flush failed',
      });
      expect(loggerInfoSpy).toHaveBeenCalledWith('CloudAITracingExporter shutdown complete');
    });

    it('should handle shutdown when timer is already null', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const loggerInfoSpy = vi.spyOn((exporter as any).logger, 'info');

      // Ensure timer is null
      (exporter as any).flushTimer = null;

      await exporter.shutdown();

      // Should not call clearTimeout when timer is already null
      expect(clearTimeoutSpy).not.toHaveBeenCalled();
      expect(loggerInfoSpy).toHaveBeenCalledWith('CloudAITracingExporter shutdown complete');
    });
  });
});
