/**
 * Integration test for the transient-transport-error retry wrapper in OM.
 *
 * Verifies that a transient `terminated`-style failure on the first observer
 * stream call does not kill the actor turn — the wrapper retries and the
 * agent still produces output normally.
 */

import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';
import { RETRY_CONFIG } from '../retry';

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
 */
function createFlakyObserverModel(observationsText: string, failuresBeforeSuccess: number) {
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
        throw new TypeError('terminated');
      }
      return buildSuccessGenerate();
    },

    async doStream() {
      observerCallCount = ++callCount;
      if (callCount <= failuresBeforeSuccess) {
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

  it('retries sync observation past the AI SDK retry budget on transient "terminated" errors', async () => {
    // AI SDK's pRetry retries 2 times by default → 3 total attempts. Force more
    // failures than that so the call only succeeds if OM's withRetry layers
    // additional retries on top.
    const failuresBeforeSuccess = 5;
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

    // We were called more times than the AI SDK retry budget allows on its own.
    expect(observerModel.__observerCallCount).toBeGreaterThan(failuresBeforeSuccess);
  });
});
