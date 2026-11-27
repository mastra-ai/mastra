/**
 * Integration test for the transient-transport-error retry wrapper in OM.
 *
 * Verifies that a transient `terminated`-style failure on the first observer
 * stream call does not kill the actor turn — the wrapper retries and the
 * agent still produces output normally.
 */

import type { MastraDBMessage } from '@mastra/core/agent';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';
import { OmModelExecutionError } from '../error';
import { ObserverRunner } from '../observer-runner';
import { RETRY_CONFIG } from '../retry';
import { anthropicRateLimit, gatewayUpstreamRateLimit, openAiNoCredits, openAiRateLimit } from './provider-errors';

type StreamPart =
  | { type: 'stream-start'; warnings: unknown[] }
  | { type: 'response-metadata'; id: string; modelId: string; timestamp: Date }
  | { type: 'text-start'; id: string }
  | { type: 'text-delta'; id?: string; delta: string }
  | { type: 'text-end'; id: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; input: string }
  | {
      type: 'finish';
      finishReason: 'stop' | 'tool-calls';
      usage: { inputTokens: number; outputTokens: number; totalTokens: number };
    };

function createMockActorModel(responseText: string) {
  let callCount = 0;

  return {
    specificationVersion: 'v2' as const,
    provider: 'mock',
    modelId: 'mock-actor-model',
    defaultObjectGenerationMode: undefined,
    supportsImageUrls: false,
    supportedUrls: {},

    async doGenerate() {
      const firstCall = callCount === 0;
      callCount++;
      if (firstCall) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: `call-${Date.now()}`,
              toolName: 'test',
              input: JSON.stringify({ action: 'trigger' }),
            },
          ],
          warnings: [],
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        content: [{ type: 'text' as const, text: responseText }],
        warnings: [],
      };
    },

    async doStream() {
      const firstCall = callCount === 0;
      callCount++;

      const parts: StreamPart[] = firstCall
        ? [
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'r-1', modelId: 'mock-actor-model', timestamp: new Date() },
            {
              type: 'tool-call',
              toolCallId: `call-${Date.now()}`,
              toolName: 'test',
              input: JSON.stringify({ action: 'trigger' }),
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
            },
          ]
        : [
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'r-2', modelId: 'mock-actor-model', timestamp: new Date() },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: responseText },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
            },
          ];

      const stream = new ReadableStream({
        start(controller) {
          for (const p of parts) controller.enqueue(p);
          controller.close();
        },
      });

      return {
        stream,
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  };
}

/**
 * Observer model that throws a `terminated`-style undici error a configurable
 * number of times before succeeding. With `failuresBeforeSuccess` greater than
 * the AI SDK's built-in pRetry budget (default 2 retries → 3 attempts), the
 * call only succeeds if OM's withRetry wrapper layers additional retries on
 * top.
 *
 * With `failureMode: 'stream-error'` the model instead emits an
 * OpenRouter-style mid-stream error part ({ code: 502, message, metadata })
 * — the shape OpenRouter injects into the SSE stream when an upstream
 * provider is unavailable. Mid-stream errors bypass the AI SDK's pRetry
 * entirely, so OM's withRetry is the only retry layer.
 */
function createFlakyObserverModel(
  observationsText: string,
  failuresBeforeSuccess: number,
  failureMode: 'throw' | 'stream-error' = 'throw',
) {
  let callCount = 0;
  let observerCallCount = 0;

  function buildSuccessGenerate() {
    return {
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      content: [{ type: 'text' as const, text: observationsText }],
      warnings: [],
    };
  }

  return {
    specificationVersion: 'v2' as const,
    provider: 'mock-flaky-observer',
    modelId: 'mock-flaky-observer-model',
    defaultObjectGenerationMode: undefined,
    supportsImageUrls: false,
    supportedUrls: {},

    get __observerCallCount() {
      return observerCallCount;
    },

    async doGenerate() {
      observerCallCount = ++callCount;
      if (callCount <= failuresBeforeSuccess) {
        if (failureMode === 'stream-error') {
          throw Object.assign(new Error('JSON error injected into SSE stream'), {
            code: 502,
            metadata: { error_type: 'provider_unavailable' },
          });
        }
        throw new TypeError('terminated');
      }
      return buildSuccessGenerate();
    },

    async doStream() {
      observerCallCount = ++callCount;
      if (callCount <= failuresBeforeSuccess) {
        if (failureMode === 'stream-error') {
          // OpenRouter mid-stream error: HTTP 200 established, then the raw
          // error object is injected into the SSE stream as an error part.
          const errorParts: unknown[] = [
            { type: 'stream-start', warnings: [] },
            {
              type: 'response-metadata',
              id: 'obs-err',
              modelId: 'mock-flaky-observer-model',
              timestamp: new Date(),
            },
            {
              type: 'error',
              error: {
                code: 502,
                message: 'JSON error injected into SSE stream',
                metadata: { error_type: 'provider_unavailable' },
              },
            },
          ];
          return {
            stream: new ReadableStream({
              start(controller) {
                for (const p of errorParts) controller.enqueue(p);
                controller.close();
              },
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        }
        throw new TypeError('terminated');
      }

      const parts: StreamPart[] = [
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'obs-1', modelId: 'mock-flaky-observer-model', timestamp: new Date() },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: observationsText },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        },
      ];

      const stream = new ReadableStream({
        start(controller) {
          for (const p of parts) controller.enqueue(p);
          controller.close();
        },
      });

      return {
        stream,
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  };
}

const omTriggerTool = createTool({
  id: 'test',
  description: 'Trigger tool for OM testing',
  inputSchema: z.object({
    action: z.string().optional(),
  }),
  execute: async () => {
    return { success: true, message: 'Tool executed' };
  },
});

const longResponseText = `I understand your request completely. Let me provide you with a comprehensive and detailed response that covers all the important aspects of what you asked about. Here are my thoughts and recommendations based on the information you provided. I hope this detailed explanation helps clarify everything you need to know about the topic at hand. Please let me know if you have any follow-up questions or need additional clarification on any of these points.`;

const observationsText = `<observations>
## What just happened
- 🟢 User greeted and asked for help
</observations>`;

function createThrowingObserverModel(error: () => Error) {
  const model = {
    specificationVersion: 'v2' as const,
    provider: 'mock-failing-observer',
    modelId: 'mock-failing-observer-model',
    supportedUrls: {},
    calls: 0,
    async doGenerate(): Promise<never> {
      model.calls++;
      throw error();
    },
    async doStream(): Promise<never> {
      model.calls++;
      throw error();
    },
  };
  return model;
}

/** An observer that fails with `error` until `recover()` is called, then observes. */
function createRecoveringObserverModel(error: () => Error) {
  const working = createFlakyObserverModel(observationsText, 0);
  const prompts: string[] = [];
  let failing = true;
  const model = {
    ...working,
    calls: 0,
    prompts,
    recover() {
      failing = false;
    },
    async doGenerate(options: { prompt: unknown }) {
      model.calls++;
      if (failing) throw error();
      prompts.push(JSON.stringify(options.prompt));
      return working.doGenerate();
    },
    async doStream(options: { prompt: unknown }) {
      model.calls++;
      if (failing) throw error();
      prompts.push(JSON.stringify(options.prompt));
      return working.doStream();
    },
  };
  return model;
}

function createObserverRunner(maxRetries?: number) {
  return new ObserverRunner({
    observationConfig: {
      model: 'mock/model',
      messageTokens: 1000,
      bufferTokens: false,
      previousObserverTokens: 1000,
      observeAttachments: false,
      ...(maxRetries === undefined ? {} : { maxRetries }),
    } as any,
    observedMessageIds: new Set(),
    resolveModel: () => ({ model: 'mock/model' as any }),
    tokenCounter: { countMessages: () => 1 } as any,
  });
}

function createMessage(): MastraDBMessage {
  return {
    id: 'message-1',
    threadId: 'thread-1',
    resourceId: 'resource-1',
    role: 'user',
    content: { format: 2, parts: [{ type: 'text', text: 'hello' }] },
    createdAt: new Date(),
  } as MastraDBMessage;
}

describe('OM transient-error retry', { timeout: 30_000 }, () => {
  const originalConfig = { ...RETRY_CONFIG };

  beforeEach(() => {
    // Shrink the schedule so the test stays fast even when retries fire.
    RETRY_CONFIG.initialDelayMs = 1;
    RETRY_CONFIG.maxDelayMs = 4;
    RETRY_CONFIG.jitter = 0;
  });

  afterEach(() => {
    Object.assign(RETRY_CONFIG, originalConfig);
  });

  it.each([
    { maxRetries: 0, expectedCalls: 1 },
    { maxRetries: 1, expectedCalls: 2 },
    { maxRetries: undefined, expectedCalls: 9 },
  ])('uses $maxRetries retries as $expectedCalls total observer calls', async ({ maxRetries, expectedCalls }) => {
    const observer = createObserverRunner(maxRetries);
    const stream = vi.fn().mockRejectedValue(new TypeError('terminated'));
    vi.spyOn(observer as any, 'createAgent').mockReturnValue({
      id: 'observational-memory-observer',
      stream,
    });

    await expect(observer.call(undefined, [createMessage()])).rejects.toBeInstanceOf(OmModelExecutionError);

    expect(stream).toHaveBeenCalledTimes(expectedCalls);
  });

  it('succeeds on the configured observer retry', async () => {
    const observer = createObserverRunner(1);
    const stream = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('terminated'))
      .mockResolvedValueOnce({
        getFullOutput: async () => ({
          text: observationsText,
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        }),
      });
    vi.spyOn(observer as any, 'createAgent').mockReturnValue({
      id: 'observational-memory-observer',
      stream,
    });

    const result = await observer.call(undefined, [createMessage()]);

    expect(result.observations).toContain('User greeted');
    expect(stream).toHaveBeenCalledTimes(2);
  });

  it('uses the observation retry budget for a transient "terminated" failure', async () => {
    const failuresBeforeSuccess = 1;
    const store = new InMemoryStore();
    const observerModel = createFlakyObserverModel(observationsText, failuresBeforeSuccess);

    const memory = new Memory({
      storage: store,
      options: {
        observationalMemory: {
          enabled: true,
          observation: {
            model: observerModel as any,
            messageTokens: 20,
            maxRetries: 1,
            // Disable async buffering — test the synchronous observation path
            // (the path that previously killed the actor on `terminated`).
            bufferTokens: false,
          },
          reflection: {
            observationTokens: 50_000,
          },
        },
      },
    });

    const agent = new Agent({
      id: 'transient-retry-test-agent',
      name: 'Transient Retry Test Agent',
      instructions: 'You are a helpful assistant. Always use the test tool first.',
      model: createMockActorModel(longResponseText) as any,
      tools: { test: omTriggerTool },
      memory,
    });

    const result = await agent.generate('Hello, I need help.', {
      memory: {
        thread: 'transient-retry-thread',
        resource: 'transient-retry-resource',
      },
    });

    // The actor turn completed normally — no tripwire, no empty text.
    expect(result.tripwire).toBeFalsy();
    expect(result.text).toBe(longResponseText);

    expect(observerModel.__observerCallCount).toBeGreaterThan(failuresBeforeSuccess);
  });

  it('retries observation on OpenRouter-style mid-stream SSE errors (numeric code 502)', async () => {
    // Mid-stream errors never hit the AI SDK's pRetry (the HTTP request
    // succeeded), so OM's withRetry is the only retry layer. Previously these
    // errors were classified as non-transient and killed the actor turn with
    // "Observational memory observation buffering failed: JSON error injected
    // into SSE stream".
    const failuresBeforeSuccess = 2;
    const store = new InMemoryStore();
    const observerModel = createFlakyObserverModel(observationsText, failuresBeforeSuccess, 'stream-error');

    const memory = new Memory({
      storage: store,
      options: {
        observationalMemory: {
          enabled: true,
          observation: {
            model: observerModel as any,
            messageTokens: 20,
            bufferTokens: false,
            maxRetries: 2,
          },
          reflection: {
            observationTokens: 50_000,
          },
        },
      },
    });

    const agent = new Agent({
      id: 'sse-error-retry-test-agent',
      name: 'SSE Error Retry Test Agent',
      instructions: 'You are a helpful assistant. Always use the test tool first.',
      model: createMockActorModel(longResponseText) as any,
      tools: { test: omTriggerTool },
      memory,
    });

    const result = await agent.generate('Hello, I need help.', {
      memory: {
        thread: 'sse-error-retry-thread',
        resource: 'sse-error-retry-resource',
      },
    });

    // The actor turn completed normally despite mid-stream provider errors.
    expect(result.tripwire).toBeFalsy();
    expect(result.text).toBe(longResponseText);
    expect(observerModel.__observerCallCount).toBeGreaterThan(failuresBeforeSuccess);
  });

  it.each([
    { name: 'an account with no credits left', error: openAiNoCredits, expectedCalls: 1 },
    { name: 'an OpenAI rate limit', error: openAiRateLimit, expectedCalls: 4 },
    { name: 'a rate limit', error: anthropicRateLimit, expectedCalls: 4 },
    { name: 'a gateway rate limit that mentions credits', error: gatewayUpstreamRateLimit, expectedCalls: 4 },
  ])(
    'calls the observer model $expectedCalls time(s) on $name, then fails the turn',
    async ({ error, expectedCalls }) => {
      const observerModel = createThrowingObserverModel(error);
      const memory = new Memory({
        storage: new InMemoryStore(),
        options: {
          observationalMemory: {
            enabled: true,
            observation: { model: observerModel as any, messageTokens: 20, bufferTokens: false, maxRetries: 3 },
            reflection: { observationTokens: 50_000 },
          },
        },
      });

      const agent = new Agent({
        id: 'failing-observer-test-agent',
        name: 'Failing Observer Test Agent',
        instructions: 'You are a helpful assistant. Always use the test tool first.',
        model: createMockActorModel(longResponseText) as any,
        tools: { test: omTriggerTool },
        memory,
      });

      const result = await agent.generate('Hello, I need help.', {
        memory: { thread: 'failing-observer-thread', resource: 'failing-observer-resource' },
      });

      expect(observerModel.calls).toBe(expectedCalls);
      expect(result.tripwire?.reason).toContain(error().message);
    },
  );

  it('keeps the unobserved messages after stopping on an account with no credits, and observes them once it works', async () => {
    const store = new InMemoryStore();
    const observerModel = createRecoveringObserverModel(openAiNoCredits);
    const memory = new Memory({
      storage: store,
      options: {
        observationalMemory: {
          enabled: true,
          observation: { model: observerModel as any, messageTokens: 20, bufferTokens: false, maxRetries: 3 },
          reflection: { observationTokens: 50_000 },
        },
      },
    });
    const agent = new Agent({
      id: 'recovering-observer-test-agent',
      name: 'Recovering Observer Test Agent',
      instructions: 'You are a helpful assistant. Always use the test tool first.',
      model: createMockActorModel(longResponseText) as any,
      tools: { test: omTriggerTool },
      memory,
    });
    const thread = { thread: 'recovering-observer-thread', resource: 'recovering-observer-resource' };
    const memoryStore = (await store.getStore('memory'))!;

    const failed = await agent.generate('First question: what is the capital of France?', { memory: thread });
    expect(failed.tripwire?.reason).toContain(openAiNoCredits().message);
    expect(observerModel.calls).toBe(1);
    const afterFailure = await memoryStore.getObservationalMemory(thread.thread, thread.resource);
    expect(afterFailure?.activeObservations ?? '').toBe('');
    expect(afterFailure?.lastObservedAt).toBeFalsy();

    // Credits are added; the next turn observes the window the failed turn left behind.
    observerModel.recover();
    const next = await agent.generate('Second question.', { memory: thread });
    expect(next.tripwire).toBeFalsy();
    expect(observerModel.prompts.join('\n')).toContain('capital of France');
    const afterRecovery = await memoryStore.getObservationalMemory(thread.thread, thread.resource);
    expect(afterRecovery?.activeObservations).toContain('User greeted');
  });
});
