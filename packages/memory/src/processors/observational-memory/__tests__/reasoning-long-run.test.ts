/**
 * A long single run on a reasoning model that sends its reasoning back on every request (OpenAI
 * Responses with store: false carries each step's encrypted reasoning). Most of the prompt is that
 * reasoning, not tool results, so OM has to count it or its threshold never sees the prompt grow.
 */

import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';

const threadId = 'reasoning-run-thread';
const resourceId = 'reasoning-run-resource';
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

/** Deterministic base64-like payload, the shape of OpenAI's encrypted reasoning. */
function encryptedReasoning(length: number, seed: number) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let state = seed;
  let out = '';
  for (let i = 0; i < length; i++) {
    state = (state * 1103515245 + 12345) % 2147483648;
    out += alphabet[state % 64];
  }
  return out;
}

async function reasoningRun(steps: number) {
  const store = new InMemoryStore();
  const memory = new Memory({
    storage: store,
    options: {
      observationalMemory: {
        enabled: true,
        scope: 'thread',
        // Mastra Code's thread settings, scaled down.
        observation: {
          model: observer(),
          messageTokens: 6_000,
          bufferTokens: 1_200,
          bufferActivation: 2_000,
          blockAfter: 12_000,
        },
        reflection: { model: observer(), observationTokens: 50_000 },
      },
    },
  });
  const memoryStore = (await store.getStore('memory'))!;
  await memoryStore.saveThread({
    thread: { id: threadId, resourceId, title: 't', createdAt: new Date(), updatedAt: new Date() },
  });

  const prompts: number[] = [];
  let calls = 0;
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      prompts.push(JSON.stringify(prompt).length);
      calls++;
      const done = calls > steps;
      const reasoningId = `rs_${calls}`;
      const providerMetadata = {
        openai: { itemId: reasoningId, reasoningEncryptedContent: encryptedReasoning(3_000, calls) },
      };
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'reasoning-start', id: reasoningId, providerMetadata });
            controller.enqueue({ type: 'reasoning-delta', id: reasoningId, delta: 'Next file.' });
            controller.enqueue({ type: 'reasoning-end', id: reasoningId, providerMetadata });
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

  // Small results: in the run this reproduces, reasoning outweighed all tool results 16 to 1.
  const view = createTool({
    id: 'view',
    description: 'Read a file',
    inputSchema: z.object({ path: z.string() }),
    execute: async ({ path }) => `${path}\nexport const value = 42;`,
  });
  const agent = new Agent({
    id: 'reasoning-run-agent',
    name: 'Reasoning run agent',
    instructions: 'Read every file.',
    model,
    memory,
    tools: { view },
  });

  const result = await agent.stream('Read every file in the project.', {
    memory: { thread: threadId, resource: resourceId },
    maxSteps: steps + 5,
  });
  const text = await result.text;
  return { prompts, text };
}

describe('a long single run whose prompt is mostly replayed reasoning', () => {
  it('keeps the prompt bounded once the reasoning is observed', async () => {
    // 200 steps of 3,000-char encrypted reasoning add about 700,000 chars if nothing leaves the prompt.
    const { prompts, text } = await reasoningRun(200);

    expect(text).toBe('all files read');
    expect(prompts.length).toBeGreaterThan(200);
    expect(Math.max(...prompts.slice(-50)), 'largest of the last 50 requests, in chars').toBeLessThan(150_000);
  }, 300_000);
});
