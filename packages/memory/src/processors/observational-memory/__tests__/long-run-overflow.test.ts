/**
 * A long single run whose own tool results fill the context. When the provider rejects a request as too
 * long, OM observes and the request is retried smaller, and that has to keep working for the rest of the
 * run, not only the first time.
 */

import { APICallError } from '@internal/ai-sdk-v5';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';

const threadId = 'long-run-thread';
const resourceId = 'long-run-resource';
const usage = { inputTokens: 10, outputTokens: 10, totalTokens: 20 };

function observer() {
  const text = '<observations>\n* Read several files for the task\n</observations>';
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage,
      warnings: [],
      content: [{ type: 'text', text }],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ type: 'text-start', id: 't' });
          controller.enqueue({ type: 'text-delta', id: 't', delta: text });
          controller.enqueue({ type: 'text-end', id: 't' });
          controller.enqueue({ type: 'finish', finishReason: 'stop', usage });
          controller.close();
        },
      }),
    }),
  } as any);
}

function tooLong() {
  return new APICallError({
    message: 'Your input exceeds the context window of this model. Please adjust your input and try again.',
    url: 'https://api.example.com/v1/responses',
    requestBodyValues: {},
    statusCode: 400,
  });
}

async function longRun(opts: {
  steps: number;
  limitChars: number;
  omSettings: Record<string, unknown>;
  maxProcessorRetries?: number;
}) {
  const store = new InMemoryStore();
  const memory = new Memory({
    storage: store,
    options: {
      observationalMemory: {
        enabled: true,
        scope: 'thread',
        observation: { model: observer(), ...opts.omSettings },
        reflection: { model: observer(), observationTokens: 50_000 },
      },
    },
  });
  const memoryStore = (await store.getStore('memory'))!;
  await memoryStore.saveThread({
    thread: { id: threadId, resourceId, title: 't', createdAt: new Date(), updatedAt: new Date() },
  });

  const prompts: number[] = [];
  const rejected: number[] = [];
  let calls = 0;
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const size = JSON.stringify(prompt).length;
      prompts.push(size);
      if (size > opts.limitChars) {
        rejected.push(size);
        throw tooLong();
      }
      calls++;
      const done = calls > opts.steps;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            if (done) {
              controller.enqueue({ type: 'text-start', id: 't' });
              controller.enqueue({ type: 'text-delta', id: 't', delta: 'all files read' });
              controller.enqueue({ type: 'text-end', id: 't' });
              controller.enqueue({ type: 'finish', finishReason: 'stop', usage });
            } else {
              controller.enqueue({
                type: 'tool-call',
                toolCallId: `call-${calls}`,
                toolName: 'view',
                input: JSON.stringify({ path: `src/file-${calls}.ts` }),
              });
              controller.enqueue({ type: 'finish', finishReason: 'tool-calls', usage });
            }
            controller.close();
          },
        }),
      };
    },
  } as any);

  const view = createTool({
    id: 'view',
    description: 'Read a file',
    inputSchema: z.object({ path: z.string() }),
    execute: async ({ path }) => `${path}\n${'const value = readTheThing(42); // filler line\n'.repeat(60)}`,
  });
  const agent = new Agent({
    id: 'long-run-agent',
    name: 'Long run agent',
    instructions: 'Read every file.',
    model,
    memory,
    tools: { view },
    ...(opts.maxProcessorRetries === undefined ? {} : { maxProcessorRetries: opts.maxProcessorRetries }),
  });

  const result = await agent.stream('Read every file in the project.', {
    memory: { thread: threadId, resource: resourceId },
    maxSteps: opts.steps + 5,
  });
  let error: unknown;
  const text = await result.text.catch(e => {
    error = e;
    return undefined;
  });
  return { prompts, rejected, text, error: error ?? (await result.error) };
}

describe('a long single run whose tool results keep overflowing the context', () => {
  // Mastra Code's thread settings, scaled down. The provider counts more than OM's estimate (about 1.9x on
  // JSON-heavy work), so it rejects requests while OM's own count is still below its threshold.
  const omSettings = { messageTokens: 6_000, bufferTokens: 1_200, bufferActivation: 2_000, blockAfter: 12_000 };

  it('recovers from every overflow, each retry smaller than the request it replaced', async () => {
    const { prompts, rejected, text, error } = await longRun({
      steps: 60,
      limitChars: 30_000,
      omSettings,
      maxProcessorRetries: 64,
    });

    expect(error).toBeUndefined();
    expect(text).toBe('all files read');
    // The run keeps reading, so it overflows more than once; each recovery must work, not only the first.
    expect(rejected.length).toBeGreaterThan(2);
    for (const size of rejected) {
      const retry = prompts[prompts.indexOf(size) + 1]!;
      expect(retry, `retry after a ${size}-char rejection`).toBeLessThan(size / 2);
    }
  }, 120_000);
});
