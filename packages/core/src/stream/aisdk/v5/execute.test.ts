import { APICallError } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { execute } from './execute';
import { testUsage } from './test-utils';

const inputMessages = [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'Summarize the plan.' }] }];
const schema = z.object({ suggestions: z.array(z.string()).min(1).max(3) });

async function readStream(stream: ReadableStream): Promise<void> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if ((value as any)?.type === 'error') {
        throw (value as any).error;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function createSuccessStream() {
  return convertArrayToReadableStream([
    { type: 'stream-start' as const, warnings: [] },
    { type: 'response-metadata' as const, id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
    { type: 'text-start' as const, id: 'text-1' },
    { type: 'text-delta' as const, id: 'text-1', delta: 'Hello' },
    { type: 'text-end' as const, id: 'text-1' },
    { type: 'finish' as const, finishReason: 'stop' as const, usage: testUsage, providerMetadata: undefined },
  ]);
}

describe('execute retry with rate limit headers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createRetryTestModel(config: {
    maxCallsBeforeSuccess: number;
    errorConfig: {
      statusCode: number;
      message: string;
      isRetryable: boolean;
      responseHeaders: Record<string, string>;
    };
  }) {
    let callCount = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        callCount++;
        if (callCount <= config.maxCallsBeforeSuccess) {
          throw new APICallError({
            message: config.errorConfig.message,
            url: 'https://api.example.com',
            requestBodyValues: {},
            statusCode: config.errorConfig.statusCode,
            responseBody: JSON.stringify({ error: { message: config.errorConfig.message } }),
            isRetryable: config.errorConfig.isRetryable,
            responseHeaders: config.errorConfig.responseHeaders,
          });
        }
        return {
          stream: createSuccessStream(),
          request: { body: '' },
          response: { headers: {} },
          warnings: [] as any[],
        };
      },
    });
    Object.defineProperty(model, 'callCount', {
      get: () => callCount,
    });
    return model;
  }

  it('should respect retry-after-ms header delay', async () => {
    const model = createRetryTestModel({
      maxCallsBeforeSuccess: 1,
      errorConfig: {
        statusCode: 429,
        message: 'Rate limited',
        isRetryable: true,
        responseHeaders: { 'retry-after-ms': '3000' },
      },
    });

    const stream = execute({
      runId: 'test-run-id',
      model: model as any,
      inputMessages,
      onResult: () => {},
      methodType: 'stream',
      modelSettings: { maxRetries: 2 },
    });

    const readPromise = readStream(stream);
    // advanceTimersToNextTimerAsync runs all microtasks and advances to the
    // first pending timer, which is typically a 0ms timer from the stream start
    // or dynamic import resolution. It does NOT advance past the retry delay.
    await vi.advanceTimersToNextTimerAsync();

    // Advance just short of the 3000ms header delay.
    await vi.advanceTimersByTimeAsync(2899);
    expect((model as any).callCount).toBe(1);

    // Advance past the header delay; the retry should fire.
    await vi.advanceTimersByTimeAsync(200);
    expect((model as any).callCount).toBe(2);

    await readPromise;
  });

  it('should respect retry-after header in seconds', async () => {
    const model = createRetryTestModel({
      maxCallsBeforeSuccess: 1,
      errorConfig: {
        statusCode: 429,
        message: 'Rate limited',
        isRetryable: true,
        responseHeaders: { 'retry-after': '5' },
      },
    });

    const stream = execute({
      runId: 'test-run-id',
      model: model as any,
      inputMessages,
      onResult: () => {},
      methodType: 'stream',
      modelSettings: { maxRetries: 2 },
    });

    const readPromise = readStream(stream);
    // Flush initial async microtasks before the 5000ms delay begins
    await vi.advanceTimersByTimeAsync(1);

    await vi.advanceTimersByTimeAsync(4899);
    expect((model as any).callCount).toBe(1);

    await vi.advanceTimersByTimeAsync(200);
    expect((model as any).callCount).toBe(2);

    await readPromise;
  });

  it('should fall back to exponential backoff when no rate limit headers are present', async () => {
    const model = createRetryTestModel({
      maxCallsBeforeSuccess: 1,
      errorConfig: {
        statusCode: 500,
        message: 'Server error',
        isRetryable: true,
        responseHeaders: {},
      },
    });

    const stream = execute({
      runId: 'test-run-id',
      model: model as any,
      inputMessages,
      onResult: () => {},
      methodType: 'stream',
      modelSettings: { maxRetries: 2 },
    });

    const readPromise = readStream(stream);
    await vi.advanceTimersByTimeAsync(1);

    // Exponential backoff for attempt 1 = 1000ms. At 900ms, retry hasn't fired yet.
    await vi.advanceTimersByTimeAsync(899);
    expect((model as any).callCount).toBe(1);

    // Advance past the 1000ms delay to trigger the retry.
    await vi.advanceTimersByTimeAsync(200);
    expect((model as any).callCount).toBe(2);

    await readPromise;
  });

  it('should fall back to exponential backoff when retry-after-ms is too long (>60s)', async () => {
    const model = createRetryTestModel({
      maxCallsBeforeSuccess: 1,
      errorConfig: {
        statusCode: 429,
        message: 'Rate limited',
        isRetryable: true,
        responseHeaders: { 'retry-after-ms': '70000' },
      },
    });

    const stream = execute({
      runId: 'test-run-id',
      model: model as any,
      inputMessages,
      onResult: () => {},
      methodType: 'stream',
      modelSettings: { maxRetries: 2 },
    });

    const readPromise = readStream(stream);
    await vi.advanceTimersByTimeAsync(1);

    // Fallback exponential backoff for attempt 1 = 1000ms. At 900ms, retry hasn't fired yet.
    await vi.advanceTimersByTimeAsync(899);
    expect((model as any).callCount).toBe(1);

    // Advance past the 1000ms delay to trigger the retry.
    await vi.advanceTimersByTimeAsync(200);
    expect((model as any).callCount).toBe(2);

    await readPromise;
  });

  it('should increase delay across multiple failures', async () => {
    const model = createRetryTestModel({
      maxCallsBeforeSuccess: 2,
      errorConfig: {
        statusCode: 500,
        message: 'Server error',
        isRetryable: true,
        responseHeaders: {},
      },
    });

    const stream = execute({
      runId: 'test-run-id',
      model: model as any,
      inputMessages,
      onResult: () => {},
      methodType: 'stream',
      modelSettings: { maxRetries: 3 },
    });

    const readPromise = readStream(stream);
    await vi.advanceTimersByTimeAsync(1);

    // First failure, then ~1000ms delay before second attempt
    await vi.advanceTimersByTimeAsync(899);
    expect((model as any).callCount).toBe(1);

    await vi.advanceTimersByTimeAsync(200);
    expect((model as any).callCount).toBe(2);

    // Second failure, then ~2000ms delay before third attempt.
    // Total time so far: 1100ms. At 2900ms total (1100+1800), still waiting on 2000ms delay.
    await vi.advanceTimersByTimeAsync(1799);
    expect((model as any).callCount).toBe(2);

    await vi.advanceTimersByTimeAsync(200);
    expect((model as any).callCount).toBe(3);

    await readPromise;
  });

  it('should surface non-retryable errors immediately', async () => {
    const model = createRetryTestModel({
      maxCallsBeforeSuccess: 1,
      errorConfig: {
        statusCode: 401,
        message: 'Unauthorized',
        isRetryable: false,
        responseHeaders: {},
      },
    });

    const stream = execute({
      runId: 'test-run-id',
      model: model as any,
      inputMessages,
      onResult: () => {},
      methodType: 'stream',
      modelSettings: { maxRetries: 2 },
    });

    // Non-retryable error should surface immediately
    await expect(readStream(stream)).rejects.toThrow('Unauthorized');
    expect((model as any).callCount).toBe(1);
  });

  it('should prefer retry-after-ms over retry-after when both are present', async () => {
    const model = createRetryTestModel({
      maxCallsBeforeSuccess: 1,
      errorConfig: {
        statusCode: 429,
        message: 'Rate limited',
        isRetryable: true,
        responseHeaders: { 'retry-after-ms': '3000', 'retry-after': '10' },
      },
    });

    const stream = execute({
      runId: 'test-run-id',
      model: model as any,
      inputMessages,
      onResult: () => {},
      methodType: 'stream',
      modelSettings: { maxRetries: 2 },
    });

    const readPromise = readStream(stream);
    await vi.advanceTimersByTimeAsync(1);

    // If retry-after (10s) were used, we would still be at 1 call.
    // If retry-after-ms (3000ms) is used, advancing past 3000ms should trigger retry.
    await vi.advanceTimersByTimeAsync(2899);
    expect((model as any).callCount).toBe(1);

    await vi.advanceTimersByTimeAsync(200);
    expect((model as any).callCount).toBe(2);

    await readPromise;
  });

  it('should fall back to retry-after when retry-after-ms is invalid', async () => {
    const model = createRetryTestModel({
      maxCallsBeforeSuccess: 1,
      errorConfig: {
        statusCode: 429,
        message: 'Rate limited',
        isRetryable: true,
        responseHeaders: { 'retry-after-ms': 'invalid', 'retry-after': '2' },
      },
    });

    const stream = execute({
      runId: 'test-run-id',
      model: model as any,
      inputMessages,
      onResult: () => {},
      methodType: 'stream',
      modelSettings: { maxRetries: 2 },
    });

    const readPromise = readStream(stream);
    await vi.advanceTimersByTimeAsync(1);

    // retry-after-ms is invalid, so retry-after=2s (2000ms) should be used.
    await vi.advanceTimersByTimeAsync(1899);
    expect((model as any).callCount).toBe(1);

    await vi.advanceTimersByTimeAsync(200);
    expect((model as any).callCount).toBe(2);

    await readPromise;
  });

  it('should respect HTTP-date retry-after header', async () => {
    // Align to the next whole second so Date.parse(toUTCString()) round-trips exactly.
    const now = Date.now();
    const futureTime = Math.ceil((now + 5000) / 1000) * 1000;
    const futureDate = new Date(futureTime);

    const model = createRetryTestModel({
      maxCallsBeforeSuccess: 1,
      errorConfig: {
        statusCode: 429,
        message: 'Rate limited',
        isRetryable: true,
        responseHeaders: { 'retry-after': futureDate.toUTCString() },
      },
    });

    const stream = execute({
      runId: 'test-run-id',
      model: model as any,
      inputMessages,
      onResult: () => {},
      methodType: 'stream',
      modelSettings: { maxRetries: 2 },
    });

    const readPromise = readStream(stream);
    await vi.advanceTimersByTimeAsync(1);

    // Delay is >= 5000ms, so at 4900ms total we should not have retried yet.
    await vi.advanceTimersByTimeAsync(4899);
    expect((model as any).callCount).toBe(1);

    // Advance past the date-based delay.
    await vi.advanceTimersByTimeAsync(2000);
    expect((model as any).callCount).toBe(2);

    await readPromise;
  });
});

describe('execute structured output prompt handling', () => {
  it('does not inject processor schema instructions into the main prompt when useAgent is enabled', async () => {
    let capturedPrompt: unknown;
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }: any) => {
        capturedPrompt = prompt;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Main agent summary.' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: testUsage, providerMetadata: undefined },
          ]),
          request: { body: '' },
          response: { headers: {} },
          warnings: [] as any[],
        };
      },
    });

    const stream = execute({
      runId: 'test-run-id',
      model: model as any,
      inputMessages,
      onResult: () => {},
      methodType: 'stream',
      structuredOutput: {
        schema,
        model: model as any,
        useAgent: true,
      },
    });

    await readStream(stream);

    expect(capturedPrompt).toEqual(inputMessages);
    expect(JSON.stringify(capturedPrompt)).not.toContain(
      'Your response will be processed by another agent to extract structured data',
    );
  });

  it('injects processor schema instructions into the main prompt when useAgent is disabled', async () => {
    let capturedPrompt: unknown;
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }: any) => {
        capturedPrompt = prompt;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Main agent summary.' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: testUsage, providerMetadata: undefined },
          ]),
          request: { body: '' },
          response: { headers: {} },
          warnings: [] as any[],
        };
      },
    });

    const stream = execute({
      runId: 'test-run-id',
      model: model as any,
      inputMessages,
      onResult: () => {},
      methodType: 'stream',
      structuredOutput: {
        schema,
        model: model as any,
      },
    });

    await readStream(stream);

    expect(capturedPrompt).not.toEqual(inputMessages);
    const promptJson = JSON.stringify(capturedPrompt);
    expect(promptJson).toContain('Your response will be processed by another agent to extract structured data');
    expect(promptJson).toContain('suggestions');
  });
});
