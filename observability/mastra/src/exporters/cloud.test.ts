import type {
  TracingEvent,
  AnyExportedSpan,
  CreateSpanOptions,
  LogEvent,
  MetricEvent,
  ScoreEvent,
  FeedbackEvent,
} from '@mastra/core/observability';
import { EntityType, SpanType, TracingEventType } from '@mastra/core/observability';

import { fetchWithRetry } from '@mastra/core/utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CloudExporter } from './cloud';

// Mock fetchWithRetry
vi.mock('@mastra/core/utils', () => ({
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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function expectOptionalProperty(record: Record<string, any>, key: string, value: unknown) {
  if (value === undefined) {
    expect(record).not.toHaveProperty(key);
    return;
  }

  expect(record).toHaveProperty(key, value);
}

function getMockSpan<TType extends SpanType>(
  options: CreateSpanOptions<TType> & { id: string; traceId: string },
): AnyExportedSpan {
  return {
    ...options,
    startTime: new Date(),
    endTime: new Date(),
    isEvent: options.isEvent ?? false,
    isRootSpan: true,
    parentSpanId: undefined,
  };
}

function getMockLogEvent(overrides: Partial<LogEvent['log']> = {}): LogEvent {
  return {
    type: 'log',
    log: {
      timestamp: new Date('2026-04-06T12:00:00.000Z'),
      traceId: 'trace-log-123',
      spanId: 'span-log-123',
      level: 'info',
      message: 'test log',
      data: { requestId: 'req-123' },
      correlationContext: {
        organizationId: 'team-123',
        resourceId: 'project-456',
        serviceName: 'cloud-exporter-test',
      },
      metadata: { source: 'test-suite' },
      ...overrides,
    },
  };
}

function getMockMetricEvent(overrides: Partial<MetricEvent['metric']> = {}): MetricEvent {
  return {
    type: 'metric',
    metric: {
      timestamp: new Date('2026-04-06T12:01:00.000Z'),
      traceId: 'trace-metric-123',
      spanId: 'span-metric-123',
      name: 'mastra.tokens',
      value: 42,
      labels: { provider: 'openai' },
      correlationContext: {
        organizationId: 'team-123',
        resourceId: 'project-456',
        serviceName: 'cloud-exporter-test',
      },
      metadata: { unit: 'tokens' },
      ...overrides,
    },
  };
}

function getMockScoreEvent(overrides: Partial<ScoreEvent['score']> = {}): ScoreEvent {
  return {
    type: 'score',
    score: {
      timestamp: new Date('2026-04-06T12:02:00.000Z'),
      traceId: 'trace-score-123',
      spanId: 'span-score-123',
      scorerId: 'relevance',
      scoreSource: 'manual',
      score: 0.9,
      reason: 'high confidence',
      correlationContext: {
        organizationId: 'team-123',
        resourceId: 'project-456',
        serviceName: 'cloud-exporter-test',
      },
      metadata: { rubric: 'v1' },
      ...overrides,
    },
  };
}

function getMockFeedbackEvent(overrides: Partial<FeedbackEvent['feedback']> = {}): FeedbackEvent {
  return {
    type: 'feedback',
    feedback: {
      timestamp: new Date('2026-04-06T12:03:00.000Z'),
      traceId: 'trace-feedback-123',
      spanId: 'span-feedback-123',
      feedbackSource: 'user',
      feedbackType: 'thumbs',
      value: 'up',
      comment: 'looks good',
      correlationContext: {
        organizationId: 'team-123',
        resourceId: 'project-456',
        serviceName: 'cloud-exporter-test',
      },
      metadata: { locale: 'en-US' },
      ...overrides,
    },
  };
}

describe('CloudExporter', () => {
  let exporter: CloudExporter;
  const testJWT = createTestJWT({ teamId: 'team-123', projectId: 'project-456' });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementation to default success
    mockFetchWithRetry.mockReset();
    mockFetchWithRetry.mockResolvedValue(new Response('{}', { status: 200 }));

    exporter = new CloudExporter({
      accessToken: testJWT,
      endpoint: 'http://localhost:3000',
    });
  });

  afterEach(async () => {
    await exporter.shutdown();
  });

  describe('Core Event Filtering', () => {
    const mockSpan: AnyExportedSpan = {
      ...getMockSpan({
        id: 'span-123',
        name: 'test-span',
        type: SpanType.MODEL_GENERATION,
        entityType: EntityType.AGENT,
        entityId: 'agent-123',
        entityName: 'Support Agent',
        isEvent: false,
        traceId: 'trace-456',
        tags: ['prod', 'customer-facing'],
        input: { prompt: 'test' },
        output: { response: 'result' },
      }),
      errorInfo: {
        message: 'generation failed',
        name: 'Error',
      },
    };

    it('should process SPAN_ENDED events', async () => {
      const spanEndedEvent: TracingEvent = {
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      };

      // Mock the internal buffer to verify span was added
      const addToBufferSpy = vi.spyOn(exporter as any, 'addToBuffer');

      await exporter.exportTracingEvent(spanEndedEvent);

      expect(addToBufferSpy).toHaveBeenCalledWith(spanEndedEvent);
    });

    it('should ignore SPAN_STARTED events', async () => {
      const spanStartedEvent: TracingEvent = {
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: mockSpan,
      };

      const addToBufferSpy = vi.spyOn(exporter as any, 'addToBuffer');

      await exporter.exportTracingEvent(spanStartedEvent);

      expect(addToBufferSpy).not.toHaveBeenCalled();
    });

    it('should ignore SPAN_UPDATED events', async () => {
      const spanUpdatedEvent: TracingEvent = {
        type: TracingEventType.SPAN_UPDATED,
        exportedSpan: mockSpan,
      };

      const addToBufferSpy = vi.spyOn(exporter as any, 'addToBuffer');

      await exporter.exportTracingEvent(spanUpdatedEvent);

      expect(addToBufferSpy).not.toHaveBeenCalled();
    });

    it('should only increment buffer size for SPAN_ENDED events', async () => {
      const events: TracingEvent[] = [
        { type: TracingEventType.SPAN_STARTED, exportedSpan: mockSpan },
        { type: TracingEventType.SPAN_UPDATED, exportedSpan: mockSpan },
        { type: TracingEventType.SPAN_ENDED, exportedSpan: mockSpan },
      ];

      for (const event of events) {
        await exporter.exportTracingEvent(event);
      }

      // Access private buffer to check size
      const buffer = (exporter as any).buffer;
      expect(buffer.totalSize).toBe(1); // Only SPAN_ENDED should be counted
      expect(buffer.spans).toHaveLength(1);
    });
  });

  describe('Buffer Management', () => {
    const mockSpan = getMockSpan({
      id: 'span-123',
      name: 'test-span',
      type: SpanType.MODEL_GENERATION,
      isEvent: false,
      traceId: 'trace-456',
      input: { prompt: 'test' },
      output: { response: 'result' },
    });

    it('should initialize buffer with empty state', () => {
      const buffer = (exporter as any).buffer;

      expect(buffer.spans).toEqual([]);
      expect(buffer.totalSize).toBe(0);
      expect(buffer.firstEventTime).toBeUndefined();
    });

    it('should set firstEventTime when adding first span to empty buffer', async () => {
      const beforeTime = Date.now();

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });

      const buffer = (exporter as any).buffer;
      const afterTime = Date.now();

      expect(buffer.firstEventTime).toBeInstanceOf(Date);
      expect(buffer.firstEventTime.getTime()).toBeGreaterThanOrEqual(beforeTime);
      expect(buffer.firstEventTime.getTime()).toBeLessThanOrEqual(afterTime);
    });

    it('should not update firstEventTime when adding subsequent spans', async () => {
      // Add first span
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });

      const buffer = (exporter as any).buffer;
      const firstTime = buffer.firstEventTime;

      // Add second span
      const secondSpan = { ...mockSpan, id: 'span-456' };
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: secondSpan,
      });

      // firstEventTime should not have changed
      expect(buffer.firstEventTime).toBe(firstTime);
      expect(buffer.totalSize).toBe(2);
    });

    it('should increment totalSize correctly', async () => {
      const buffer = (exporter as any).buffer;

      expect(buffer.totalSize).toBe(0);

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });
      expect(buffer.totalSize).toBe(1);

      const secondSpan = { ...mockSpan, id: 'span-456' };
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: secondSpan,
      });
      expect(buffer.totalSize).toBe(2);
    });

    it('should add spans with correct structure to buffer', async () => {
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });

      const buffer = (exporter as any).buffer;
      const spanRecord = buffer.spans[0];

      expect(spanRecord).toMatchObject({
        id: mockSpan.id,
        traceId: mockSpan.traceId,
        spanId: mockSpan.id,
        name: mockSpan.name,
        type: mockSpan.type,
        spanType: mockSpan.type,
        startTime: mockSpan.startTime,
        startedAt: mockSpan.startTime,
        endTime: mockSpan.endTime,
        endedAt: mockSpan.endTime,
        input: mockSpan.input,
        output: mockSpan.output,
        error: mockSpan.errorInfo ?? null,
        isEvent: mockSpan.isEvent,
        isRootSpan: mockSpan.isRootSpan,
        updatedAt: null,
      });

      expectOptionalProperty(spanRecord, 'entityType', mockSpan.entityType);
      expectOptionalProperty(spanRecord, 'entityId', mockSpan.entityId);
      expectOptionalProperty(spanRecord, 'entityName', mockSpan.entityName);
      expectOptionalProperty(spanRecord, 'tags', mockSpan.tags);
      expectOptionalProperty(spanRecord, 'errorInfo', mockSpan.errorInfo);
      expect(spanRecord.parentSpanId).toBeUndefined();
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
      const parentSpan: AnyExportedSpan = {
        ...mockSpan,
        id: 'parent-span',
      };

      const childSpan: AnyExportedSpan = {
        ...mockSpan,
        id: 'child-span',
        parentSpanId: parentSpan.id,
      };

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: childSpan,
      });

      const buffer = (exporter as any).buffer;
      const spanRecord = buffer.spans[0];

      expect(spanRecord.parentSpanId).toBe('parent-span');
    });
  });

  describe('Flush Trigger Conditions', () => {
    const mockSpan = getMockSpan({
      id: 'span-123',
      name: 'test-span',
      type: SpanType.MODEL_GENERATION,
      isEvent: false,
      traceId: 'trace-456',
      input: { prompt: 'test' },
      output: { response: 'result' },
    });

    it('should trigger flush when maxBatchSize is reached', async () => {
      const smallBatchExporter = new CloudExporter({
        accessToken: createTestJWT({ teamId: 'test-team', projectId: 'test-project' }),
        endpoint: 'http://localhost:3000',
        maxBatchSize: 2, // Small batch size for testing
      });

      const flushSpy = vi.spyOn(smallBatchExporter as any, 'flush');
      const shouldFlushSpy = vi.spyOn(smallBatchExporter as any, 'shouldFlush');

      // Add first span - should not flush
      await smallBatchExporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });

      expect(shouldFlushSpy).toHaveReturnedWith(false);
      expect(flushSpy).not.toHaveBeenCalled();

      // Add second span - should trigger flush
      const secondSpan = { ...mockSpan, id: 'span-456' };
      await smallBatchExporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: secondSpan,
      });

      expect(shouldFlushSpy).toHaveReturnedWith(true);
      expect(flushSpy).toHaveBeenCalled();
      await smallBatchExporter.shutdown();
    });

    it('should not wait for a size-triggered upload before exportTracingEvent resolves', async () => {
      const deferredUpload = createDeferred<Response>();
      mockFetchWithRetry.mockReturnValue(deferredUpload.promise);

      const smallBatchExporter = new CloudExporter({
        accessToken: createTestJWT({ teamId: 'test-team', projectId: 'test-project' }),
        endpoint: 'http://localhost:3000',
        maxBatchSize: 1,
      });

      let exportResolved = false;
      const exportPromise = smallBatchExporter
        .exportTracingEvent({
          type: TracingEventType.SPAN_ENDED,
          exportedSpan: mockSpan,
        })
        .then(() => {
          exportResolved = true;
        });

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockFetchWithRetry).toHaveBeenCalledTimes(1);
      expect(exportResolved).toBe(true);

      deferredUpload.resolve(new Response('{}', { status: 200 }));

      await exportPromise;
      await smallBatchExporter.shutdown();
    });

    it('should wait for already-started uploads when flush is called', async () => {
      const deferredUpload = createDeferred<Response>();
      mockFetchWithRetry.mockReturnValue(deferredUpload.promise);

      const smallBatchExporter = new CloudExporter({
        accessToken: createTestJWT({ teamId: 'test-team', projectId: 'test-project' }),
        endpoint: 'http://localhost:3000',
        maxBatchSize: 1,
      });

      await smallBatchExporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });

      expect((smallBatchExporter as any).buffer.totalSize).toBe(0);
      expect(mockFetchWithRetry).toHaveBeenCalledTimes(1);

      let flushResolved = false;
      const flushPromise = smallBatchExporter.flush().then(() => {
        flushResolved = true;
      });

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(flushResolved).toBe(false);

      deferredUpload.resolve(new Response('{}', { status: 200 }));

      await flushPromise;
      expect(mockFetchWithRetry).toHaveBeenCalledTimes(1);

      await smallBatchExporter.shutdown();
    });

    it('should schedule flush for first event in empty buffer', async () => {
      const scheduleFlushSpy = vi.spyOn(exporter as any, 'scheduleFlush');

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });

      expect(scheduleFlushSpy).toHaveBeenCalledOnce();
    });

    it('should not schedule additional flushes for subsequent events', async () => {
      const scheduleFlushSpy = vi.spyOn(exporter as any, 'scheduleFlush');

      // Add first span
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });

      expect(scheduleFlushSpy).toHaveBeenCalledTimes(1);

      // Add second span - should not schedule again
      const secondSpan = { ...mockSpan, id: 'span-456' };
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: secondSpan,
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
    const mockSpan = getMockSpan({
      id: 'span-123',
      name: 'test-span',
      type: SpanType.MODEL_GENERATION,
      isEvent: false,
      traceId: 'trace-456',
      input: { prompt: 'test' },
      output: { response: 'result' },
    });

    it('should set timer when scheduling flush', async () => {
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
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
      const shortExporter = new CloudExporter({
        accessToken: createTestJWT({ teamId: 'team-123', projectId: 'project-456' }),
        endpoint: 'http://localhost:3000',
        maxBatchWaitMs: 50,
      });
      const flushSpy = vi.spyOn(shortExporter as any, 'flush').mockResolvedValue(undefined);

      await shortExporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });

      // Wait for the real timer to fire
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(flushSpy).toHaveBeenCalled();
      await shortExporter.shutdown();
    });

    it('should clear timer after flush', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });

      // Trigger flush
      await (exporter as any).flush();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect((exporter as any).flushTimer).toBeNull();
    });

    it('should handle timer errors gracefully', async () => {
      const shortExporter = new CloudExporter({
        accessToken: createTestJWT({ teamId: 'team-123', projectId: 'project-456' }),
        endpoint: 'http://localhost:3000',
        maxBatchWaitMs: 50,
      });
      const loggerErrorSpy = vi.spyOn((shortExporter as any).logger, 'error');

      // Mock flush to throw error
      vi.spyOn(shortExporter as any, 'flush').mockRejectedValue(new Error('Flush failed'));

      await shortExporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });

      // Wait for the real timer to fire and error to be handled
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(loggerErrorSpy).toHaveBeenCalledWith('Scheduled flush failed', expect.any(Object));
      await shortExporter.shutdown();
    });

    it('should clear timer on flush and set flushTimer to null', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
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
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
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
    const mockSpan = getMockSpan({
      id: 'span-123',
      name: 'test-span',
      type: SpanType.MODEL_GENERATION,
      isEvent: false,
      traceId: 'trace-456',
      input: { prompt: 'test' },
      output: { response: 'result' },
    });

    beforeEach(() => {
      vi.clearAllMocks();
      mockFetchWithRetry.mockResolvedValue(new Response('{}', { status: 200 }));
    });

    it('should call cloud API with correct URL and headers', async () => {
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });

      // Trigger immediate flush
      await (exporter as any).flush();

      expect(mockFetchWithRetry).toHaveBeenCalledWith(
        'http://localhost:3000/ai/spans/publish',
        {
          method: 'POST',
          headers: {
            Authorization: expect.stringMatching(/^Bearer .+/),
            'Content-Type': 'application/json',
          },
          body: expect.any(String),
        },
        3,
      );
    });

    it('should send spans in correct format', async () => {
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });

      await (exporter as any).flush();

      const callArgs = mockFetchWithRetry.mock.calls[0];
      const requestOptions = callArgs[1] as RequestInit;
      const requestBody = JSON.parse(requestOptions.body as string);

      expect(requestBody).toMatchObject({
        spans: [
          {
            id: mockSpan.id,
            traceId: mockSpan.traceId,
            spanId: mockSpan.id,
            name: mockSpan.name,
            type: mockSpan.type,
            spanType: mockSpan.type,
            startTime: mockSpan.startTime.toISOString(),
            endTime: mockSpan.endTime?.toISOString(),
            input: mockSpan.input,
            output: mockSpan.output,
            error: mockSpan.errorInfo ?? null,
            isEvent: mockSpan.isEvent,
            isRootSpan: mockSpan.isRootSpan,
          },
        ],
      });

      expectOptionalProperty(requestBody.spans[0], 'entityType', mockSpan.entityType);
      expectOptionalProperty(requestBody.spans[0], 'entityId', mockSpan.entityId);
      expectOptionalProperty(requestBody.spans[0], 'entityName', mockSpan.entityName);
      expectOptionalProperty(requestBody.spans[0], 'tags', mockSpan.tags);
      expectOptionalProperty(requestBody.spans[0], 'errorInfo', mockSpan.errorInfo);
      expect(requestBody.spans[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(requestBody.spans[0].updatedAt).toBeNull();
    });

    it('should use JWT token in Authorization header', async () => {
      const testJWT = createTestJWT({ teamId: 'auth-test', projectId: 'auth-project' });
      const authExporter = new CloudExporter({
        accessToken: testJWT,
        endpoint: 'http://localhost:3000',
      });

      await authExporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });

      await (authExporter as any).flush();

      const callArgs = mockFetchWithRetry.mock.calls[0];
      const requestOptions = callArgs[1] as RequestInit;
      const headers = requestOptions.headers as Record<string, string>;

      expect(headers.Authorization).toBe(`Bearer ${testJWT}`);
      await authExporter.shutdown();
    });

    it('should handle multiple spans in batch', async () => {
      const exportedSpans = [
        { ...mockSpan, id: 'span-1' },
        { ...mockSpan, id: 'span-2' },
        { ...mockSpan, id: 'span-3' },
      ];

      for (const exportedSpan of exportedSpans) {
        await exporter.exportTracingEvent({
          type: TracingEventType.SPAN_ENDED,
          exportedSpan,
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

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });

      await (exporter as any).flush();

      expect(loggerDebugSpy).toHaveBeenCalledWith('Batch flushed successfully', {
        batchSize: 1,
        flushReason: 'time',
        durationMs: expect.any(Number),
      });
    });
  });

  describe('Additional Signal Support', () => {
    const mockSpan = getMockSpan({
      id: 'span-123',
      name: 'test-span',
      type: SpanType.MODEL_GENERATION,
      isEvent: false,
      traceId: 'trace-456',
      input: { prompt: 'test' },
      output: { response: 'result' },
    });

    beforeEach(() => {
      vi.clearAllMocks();
      mockFetchWithRetry.mockResolvedValue(new Response('{}', { status: 200 }));
    });

    it('should upload logs, metrics, scores, and feedback to their derived endpoints', async () => {
      const multiSignalExporter = new CloudExporter({
        accessToken: testJWT,
        endpoint: 'http://localhost:3000',
      });

      await multiSignalExporter.onLogEvent(getMockLogEvent());
      await multiSignalExporter.onMetricEvent(getMockMetricEvent());
      await multiSignalExporter.onScoreEvent(getMockScoreEvent());
      await multiSignalExporter.onFeedbackEvent(getMockFeedbackEvent());

      const buffer = (multiSignalExporter as any).buffer;
      expect(buffer.totalSize).toBe(4);
      expect(buffer.logs).toHaveLength(1);
      expect(buffer.metrics).toHaveLength(1);
      expect(buffer.scores).toHaveLength(1);
      expect(buffer.feedback).toHaveLength(1);

      await multiSignalExporter.flush();

      expect(mockFetchWithRetry).toHaveBeenCalledTimes(4);

      const getCallByUrl = (url: string) => {
        const call = mockFetchWithRetry.mock.calls.find(([callUrl]) => callUrl === url);
        expect(call).toBeDefined();
        return call!;
      };

      const logCall = getCallByUrl('http://localhost:3000/ai/logs/publish');
      const metricCall = getCallByUrl('http://localhost:3000/ai/metrics/publish');
      const scoreCall = getCallByUrl('http://localhost:3000/ai/scores/publish');
      const feedbackCall = getCallByUrl('http://localhost:3000/ai/feedback/publish');

      expect(logCall[0]).toBe('http://localhost:3000/ai/logs/publish');
      expect(JSON.parse((logCall[1] as RequestInit).body as string)).toMatchObject({
        logs: [{ message: 'test log', level: 'info' }],
      });

      expect(metricCall[0]).toBe('http://localhost:3000/ai/metrics/publish');
      expect(JSON.parse((metricCall[1] as RequestInit).body as string)).toMatchObject({
        metrics: [{ name: 'mastra.tokens', value: 42 }],
      });

      expect(scoreCall[0]).toBe('http://localhost:3000/ai/scores/publish');
      expect(JSON.parse((scoreCall[1] as RequestInit).body as string)).toMatchObject({
        scores: [{ scorerId: 'relevance', score: 0.9 }],
      });

      expect(feedbackCall[0]).toBe('http://localhost:3000/ai/feedback/publish');
      expect(JSON.parse((feedbackCall[1] as RequestInit).body as string)).toMatchObject({
        feedback: [{ feedbackType: 'thumbs', value: 'up' }],
      });

      await multiSignalExporter.shutdown();
    });

    it('should derive signal endpoints from a base endpoint', async () => {
      const derivedExporter = new CloudExporter({
        accessToken: testJWT,
        endpoint: 'https://collector.example.com',
      });

      await derivedExporter.onMetricEvent(getMockMetricEvent());
      await derivedExporter.flush();

      expect(mockFetchWithRetry).toHaveBeenCalledWith(
        'https://collector.example.com/ai/metrics/publish',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        }),
        3,
      );

      await derivedExporter.shutdown();
    });

    it('should derive project-scoped signal endpoints from a base endpoint when projectId is configured', async () => {
      const derivedExporter = new CloudExporter({
        accessToken: 'sk_org_api_key',
        endpoint: 'https://collector.example.com',
        projectId: 'project-workos',
      });

      await derivedExporter.onMetricEvent(getMockMetricEvent());
      await derivedExporter.flush();

      expect(mockFetchWithRetry).toHaveBeenCalledWith(
        'https://collector.example.com/projects/project-workos/ai/metrics/publish',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        }),
        3,
      );

      await derivedExporter.shutdown();
    });

    it('should derive sibling signal endpoints from an explicit traces endpoint override', async () => {
      const derivedExporter = new CloudExporter({
        accessToken: testJWT,
        endpoint: 'https://fallback.example.com',
        tracesEndpoint: 'https://collector.example.com/custom/spans/publish',
      });

      await derivedExporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });
      await derivedExporter.onMetricEvent(getMockMetricEvent());
      await derivedExporter.flush();

      expect(mockFetchWithRetry).toHaveBeenCalledWith(
        'https://collector.example.com/custom/spans/publish',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        }),
        3,
      );
      expect(mockFetchWithRetry).toHaveBeenCalledWith(
        'https://collector.example.com/custom/metrics/publish',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        }),
        3,
      );

      await derivedExporter.shutdown();
    });

    it('should derive project-scoped sibling signal endpoints from an origin-only traces endpoint override', async () => {
      const derivedExporter = new CloudExporter({
        accessToken: 'sk_org_api_key',
        endpoint: 'https://fallback.example.com',
        tracesEndpoint: 'https://collector.example.com',
        projectId: 'project-workos',
      });

      await derivedExporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });
      await derivedExporter.onMetricEvent(getMockMetricEvent());
      await derivedExporter.flush();

      expect(mockFetchWithRetry).toHaveBeenCalledWith(
        'https://collector.example.com/projects/project-workos/ai/spans/publish',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        }),
        3,
      );
      expect(mockFetchWithRetry).toHaveBeenCalledWith(
        'https://collector.example.com/projects/project-workos/ai/metrics/publish',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        }),
        3,
      );

      await derivedExporter.shutdown();
    });

    it('should prefer explicit per-signal endpoint overrides over derived traces siblings', async () => {
      const derivedExporter = new CloudExporter({
        accessToken: testJWT,
        tracesEndpoint: 'https://collector.example.com/custom/spans/publish',
        logsEndpoint: 'https://logs.example.com/custom/logs/publish',
      });

      await derivedExporter.onLogEvent(getMockLogEvent());
      await derivedExporter.flush();

      expect(mockFetchWithRetry).toHaveBeenCalledWith(
        'https://logs.example.com/custom/logs/publish',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        }),
        3,
      );

      await derivedExporter.shutdown();
    });

    it('should leave explicit full publish URLs unchanged when projectId is configured', async () => {
      const derivedExporter = new CloudExporter({
        accessToken: 'sk_org_api_key',
        projectId: 'project-workos',
        tracesEndpoint: 'https://collector.example.com/custom/spans/publish',
        logsEndpoint: 'https://logs.example.com/custom/logs/publish',
      });

      await derivedExporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });
      await derivedExporter.onLogEvent(getMockLogEvent());
      await derivedExporter.flush();

      expect(mockFetchWithRetry).toHaveBeenCalledWith(
        'https://collector.example.com/custom/spans/publish',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        }),
        3,
      );
      expect(mockFetchWithRetry).toHaveBeenCalledWith(
        'https://logs.example.com/custom/logs/publish',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        }),
        3,
      );

      await derivedExporter.shutdown();
    });

    it('should derive sibling signal endpoints from MASTRA_CLOUD_TRACES_ENDPOINT', async () => {
      vi.stubEnv('MASTRA_CLOUD_TRACES_ENDPOINT', 'https://collector.example.com/env/spans/publish');

      const derivedExporter = new CloudExporter({
        accessToken: testJWT,
      });

      try {
        await derivedExporter.onScoreEvent(getMockScoreEvent());
        await derivedExporter.flush();

        expect(mockFetchWithRetry).toHaveBeenCalledWith(
          'https://collector.example.com/env/scores/publish',
          expect.objectContaining({
            method: 'POST',
            body: expect.any(String),
          }),
          3,
        );
      } finally {
        await derivedExporter.shutdown();
        vi.unstubAllEnvs();
      }
    });

    it('should derive project-scoped signal endpoints from MASTRA_PROJECT_ID', async () => {
      vi.stubEnv('MASTRA_PROJECT_ID', 'project-from-env');

      const derivedExporter = new CloudExporter({
        accessToken: 'sk_org_api_key',
        endpoint: 'https://collector.example.com',
      });

      try {
        await derivedExporter.onScoreEvent(getMockScoreEvent());
        await derivedExporter.flush();

        expect(mockFetchWithRetry).toHaveBeenCalledWith(
          'https://collector.example.com/projects/project-from-env/ai/scores/publish',
          expect.objectContaining({
            method: 'POST',
            body: expect.any(String),
          }),
          3,
        );
      } finally {
        await derivedExporter.shutdown();
        vi.unstubAllEnvs();
      }
    });

    it('should prefer config projectId over MASTRA_PROJECT_ID', async () => {
      vi.stubEnv('MASTRA_PROJECT_ID', 'project-from-env');

      const derivedExporter = new CloudExporter({
        accessToken: 'sk_org_api_key',
        endpoint: 'https://collector.example.com',
        projectId: 'project-from-config',
      });

      try {
        await derivedExporter.onFeedbackEvent(getMockFeedbackEvent());
        await derivedExporter.flush();

        expect(mockFetchWithRetry).toHaveBeenCalledWith(
          'https://collector.example.com/projects/project-from-config/ai/feedback/publish',
          expect.objectContaining({
            method: 'POST',
            body: expect.any(String),
          }),
          3,
        );
      } finally {
        await derivedExporter.shutdown();
        vi.unstubAllEnvs();
      }
    });

    it('should treat an empty MASTRA_PROJECT_ID as unset', async () => {
      vi.stubEnv('MASTRA_PROJECT_ID', '');

      const derivedExporter = new CloudExporter({
        accessToken: 'sk_org_api_key',
        endpoint: 'https://collector.example.com',
      });

      try {
        await derivedExporter.onMetricEvent(getMockMetricEvent());
        await derivedExporter.flush();

        expect(mockFetchWithRetry).toHaveBeenCalledWith(
          'https://collector.example.com/ai/metrics/publish',
          expect.objectContaining({
            method: 'POST',
            body: expect.any(String),
          }),
          3,
        );
      } finally {
        await derivedExporter.shutdown();
        vi.unstubAllEnvs();
      }
    });

    it('should reject an empty config projectId', () => {
      expect(
        () =>
          new CloudExporter({
            accessToken: 'sk_org_api_key',
            endpoint: 'https://collector.example.com',
            projectId: '',
          }),
      ).toThrowError('CloudExporter projectId must only contain letters, numbers, hyphens, and underscores.');
    });

    it('should reject a config projectId that contains whitespace', () => {
      expect(
        () =>
          new CloudExporter({
            accessToken: 'sk_org_api_key',
            endpoint: 'https://collector.example.com',
            projectId: 'project 123',
          }),
      ).toThrowError('CloudExporter projectId must only contain letters, numbers, hyphens, and underscores.');
    });

    it('should reject a config projectId with special characters', () => {
      expect(
        () =>
          new CloudExporter({
            accessToken: 'sk_org_api_key',
            endpoint: 'https://collector.example.com',
            projectId: 'project/123',
          }),
      ).toThrowError('CloudExporter projectId must only contain letters, numbers, hyphens, and underscores.');
    });

    it('should treat an invalid MASTRA_PROJECT_ID as unset', async () => {
      vi.stubEnv('MASTRA_PROJECT_ID', 'has spaces');

      const derivedExporter = new CloudExporter({
        accessToken: 'sk_org_api_key',
        endpoint: 'https://collector.example.com',
      });

      try {
        await derivedExporter.onMetricEvent(getMockMetricEvent());
        await derivedExporter.flush();

        expect(mockFetchWithRetry).toHaveBeenCalledWith(
          'https://collector.example.com/ai/metrics/publish',
          expect.objectContaining({
            method: 'POST',
            body: expect.any(String),
          }),
          3,
        );
      } finally {
        await derivedExporter.shutdown();
        vi.unstubAllEnvs();
      }
    });

    it('should reject legacy publish-path endpoints', () => {
      expect(
        () =>
          new CloudExporter({
            accessToken: testJWT,
            endpoint: 'https://collector.example.com/ai/spans/publish',
          }),
      ).toThrowError(
        'CloudExporter endpoint must be a base origin like "https://collector.example.com" with no path, search, or hash.',
      );
    });

    it('should reject base endpoints that include any path segment', () => {
      expect(
        () =>
          new CloudExporter({
            accessToken: testJWT,
            endpoint: 'https://collector.example.com/custom-ingest',
          }),
      ).toThrowError(
        'CloudExporter endpoint must be a base origin like "https://collector.example.com" with no path, search, or hash.',
      );
    });

    it('should reject explicit traces endpoints that are not publish URLs', () => {
      expect(
        () =>
          new CloudExporter({
            accessToken: testJWT,
            tracesEndpoint: 'https://collector.example.com/custom-ingest',
          }),
      ).toThrowError(
        'CloudExporter tracesEndpoint must be a base origin like "https://collector.example.com" or a full traces publish URL ending in "/spans/publish".',
      );
    });
  });

  describe('Retry Logic and Error Handling', () => {
    const mockSpan = getMockSpan({
      id: 'span-123',
      name: 'test-span',
      type: SpanType.MODEL_GENERATION,
      isEvent: false,
      traceId: 'trace-456',
      input: { prompt: 'test' },
      output: { response: 'result' },
    });

    beforeEach(() => {
      vi.clearAllMocks();
      // Reset mock to default success behavior
      mockFetchWithRetry.mockResolvedValue(new Response('{}', { status: 200 }));
    });

    it('should retry on API failures using fetchWithRetry', async () => {
      const retryExporter = new CloudExporter({
        accessToken: createTestJWT({ teamId: 'retry-team', projectId: 'retry-project' }),
        endpoint: 'http://localhost:3000',
        maxRetries: 3,
      });

      // Mock API to fail first two times, succeed on third
      mockFetchWithRetry
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Server error'))
        .mockResolvedValueOnce(new Response('{}', { status: 200 }));

      await retryExporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });

      await (retryExporter as any).flush();

      // fetchWithRetry should be called with maxRetries parameter
      expect(mockFetchWithRetry).toHaveBeenCalledWith(
        'http://localhost:3000/ai/spans/publish',
        expect.any(Object),
        3, // maxRetries passed to fetchWithRetry
      );
      await retryExporter.shutdown();
    });

    it('should pass maxRetries to fetchWithRetry correctly', async () => {
      const customRetryExporter = new CloudExporter({
        accessToken: createTestJWT({ teamId: 'custom-team', projectId: 'custom-project' }),
        endpoint: 'http://localhost:3000',
        maxRetries: 5, // Custom retry count
      });

      mockFetchWithRetry.mockResolvedValue(new Response('{}', { status: 200 }));

      await customRetryExporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });

      await (customRetryExporter as any).flush();

      expect(mockFetchWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        5, // Custom maxRetries value
      );
      await customRetryExporter.shutdown();
    });

    it('should drop batch after fetchWithRetry exhausts all retries', async () => {
      const retryExporter = new CloudExporter({
        accessToken: createTestJWT({ teamId: 'fail-team', projectId: 'fail-project' }),
        endpoint: 'http://localhost:3000',
        maxRetries: 2,
      });

      const loggerErrorSpy = vi.spyOn((retryExporter as any).logger, 'error');

      // Mock fetchWithRetry to always fail after exhausting retries
      mockFetchWithRetry.mockRejectedValue(new Error('Persistent failure'));

      await retryExporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });

      // Flush should not throw - errors are caught and logged
      await (retryExporter as any).flush();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Batch upload failed after all retries, dropping batch',
        expect.any(Object),
      );
      await retryExporter.shutdown();
    });

    it('should handle flush errors gracefully in background', async () => {
      const shortExporter = new CloudExporter({
        accessToken: createTestJWT({ teamId: 'team-123', projectId: 'project-456' }),
        endpoint: 'http://localhost:3000',
        maxBatchWaitMs: 50,
      });
      const loggerErrorSpy = vi.spyOn((shortExporter as any).logger, 'error');

      // Mock fetchWithRetry to fail
      mockFetchWithRetry.mockRejectedValue(new Error('API down'));

      await shortExporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });

      // Wait for the real timer to fire and error to be handled
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should log the batch upload failure, not scheduled flush failure
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Batch upload failed after all retries, dropping batch',
        expect.any(Object),
      );
      await shortExporter.shutdown();
    });
  });

  describe('Public Flush API', () => {
    const mockSpan = getMockSpan({
      id: 'span-123',
      name: 'test-span',
      type: SpanType.MODEL_GENERATION,
      isEvent: false,
      traceId: 'trace-456',
      input: { prompt: 'test' },
      output: { response: 'result' },
    });

    beforeEach(() => {
      vi.clearAllMocks();
      mockFetchWithRetry.mockResolvedValue(new Response('{}', { status: 200 }));
    });

    it('should flush buffered events without shutting down', async () => {
      const loggerDebugSpy = vi.spyOn((exporter as any).logger, 'debug');
      const flushBufferSpy = vi.spyOn(exporter as any, 'flushBuffer');

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });

      const buffer = (exporter as any).buffer;
      expect(buffer.totalSize).toBe(1);

      // Call public flush() method
      await exporter.flush();

      expect(flushBufferSpy).toHaveBeenCalled();
      expect(loggerDebugSpy).toHaveBeenCalledWith('Flushing buffered events', { bufferedEvents: 1 });
      expect(mockFetchWithRetry).toHaveBeenCalled();

      // Buffer should be empty after flush
      expect(buffer.totalSize).toBe(0);

      // Exporter should still be usable after flush
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: { ...mockSpan, id: 'span-456' },
      });
      expect(buffer.totalSize).toBe(1);
    });

    it('should be a no-op when buffer is empty', async () => {
      const buffer = (exporter as any).buffer;
      const flushBufferSpy = vi.spyOn(exporter as any, 'flushBuffer');
      expect(buffer.totalSize).toBe(0);

      // Call flush on empty buffer
      await exporter.flush();

      expect(flushBufferSpy).not.toHaveBeenCalled();
      expect(mockFetchWithRetry).not.toHaveBeenCalled();
    });

    it('should skip flush when exporter is disabled', async () => {
      const disabledExporter = new CloudExporter({
        // Missing access token will disable the exporter
        accessToken: undefined,
        endpoint: 'http://localhost:3000',
      });

      // Should not throw
      await expect(disabledExporter.flush()).resolves.not.toThrow();

      // Should not call API since exporter is disabled
      expect(mockFetchWithRetry).not.toHaveBeenCalled();
    });

    it('should ignore log, metric, score, and feedback events when exporter is disabled', async () => {
      const originalToken = process.env.MASTRA_CLOUD_ACCESS_TOKEN;
      delete process.env.MASTRA_CLOUD_ACCESS_TOKEN;

      try {
        const disabledExporter = new CloudExporter({
          accessToken: undefined,
          endpoint: 'http://localhost:3000',
        });

        await disabledExporter.onLogEvent(getMockLogEvent());
        await disabledExporter.onMetricEvent(getMockMetricEvent());
        await disabledExporter.onScoreEvent(getMockScoreEvent());
        await disabledExporter.onFeedbackEvent(getMockFeedbackEvent());

        const buffer = (disabledExporter as any).buffer;
        expect(buffer.totalSize).toBe(0);
        expect(buffer.logs).toHaveLength(0);
        expect(buffer.metrics).toHaveLength(0);
        expect(buffer.scores).toHaveLength(0);
        expect(buffer.feedback).toHaveLength(0);
        expect(mockFetchWithRetry).not.toHaveBeenCalled();
      } finally {
        if (originalToken === undefined) {
          delete process.env.MASTRA_CLOUD_ACCESS_TOKEN;
        } else {
          process.env.MASTRA_CLOUD_ACCESS_TOKEN = originalToken;
        }
      }
    });
  });

  describe('Shutdown Functionality', () => {
    const mockSpan = getMockSpan({
      id: 'span-123',
      name: 'test-span',
      type: SpanType.MODEL_GENERATION,
      isEvent: false,
      traceId: 'trace-456',
      input: { prompt: 'test' },
      output: { response: 'result' },
    });

    it('should clear timer on shutdown', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const loggerInfoSpy = vi.spyOn((exporter as any).logger, 'info');

      // Set up a timer by adding an event
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });

      const timer = (exporter as any).flushTimer;
      expect(timer).not.toBeNull();

      await exporter.shutdown();

      expect(clearTimeoutSpy).toHaveBeenCalledWith(timer);
      expect((exporter as any).flushTimer).toBeNull();
      expect(loggerInfoSpy).toHaveBeenCalledWith('CloudExporter shutdown complete');
    });

    it('should flush remaining events on shutdown', async () => {
      const flushSpy = vi.spyOn(exporter, 'flush');
      const loggerInfoSpy = vi.spyOn((exporter as any).logger, 'info');

      // Add events to buffer
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: { ...mockSpan, id: 'span-456' },
      });

      const buffer = (exporter as any).buffer;
      expect(buffer.totalSize).toBe(2);

      await exporter.shutdown();

      expect(flushSpy).toHaveBeenCalled();
      expect(loggerInfoSpy).toHaveBeenCalledWith('CloudExporter shutdown complete');
    });

    it('should handle shutdown with empty buffer gracefully', async () => {
      const flushSpy = vi.spyOn(exporter, 'flush');
      const loggerInfoSpy = vi.spyOn((exporter as any).logger, 'info');

      const buffer = (exporter as any).buffer;
      expect(buffer.totalSize).toBe(0);

      await exporter.shutdown();

      expect(flushSpy).toHaveBeenCalled();
      expect(loggerInfoSpy).toHaveBeenCalledWith('CloudExporter shutdown complete');
    });

    it('should handle shutdown flush errors gracefully', async () => {
      const flushError = new Error('Shutdown flush failed');
      vi.spyOn(exporter, 'flush').mockRejectedValue(flushError);
      const loggerErrorSpy = vi.spyOn((exporter as any).logger, 'error');
      const loggerInfoSpy = vi.spyOn((exporter as any).logger, 'info');

      // Add event to buffer
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });

      await exporter.shutdown();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to flush remaining events during shutdown',
        expect.any(Object),
      );
      expect(loggerInfoSpy).toHaveBeenCalledWith('CloudExporter shutdown complete');
    });

    it('should handle shutdown when timer is already null', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const loggerInfoSpy = vi.spyOn((exporter as any).logger, 'info');

      // Ensure timer is null
      (exporter as any).flushTimer = null;

      await exporter.shutdown();

      // Should not call clearTimeout when timer is already null
      expect(clearTimeoutSpy).not.toHaveBeenCalled();
      expect(loggerInfoSpy).toHaveBeenCalledWith('CloudExporter shutdown complete');
    });
  });
});
