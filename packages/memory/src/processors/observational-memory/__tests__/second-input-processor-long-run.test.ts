/**
 * A long single run with a second input processor after observational memory. A processor that inspects
 * or rewrites messages and returns its `messages` array is common; it must not undo OM's compaction.
 */

import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import type { Processor } from '@mastra/core/processors';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';

const threadId = 'second-processor-thread';
const resourceId = 'second-processor-resource';
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

async function longRun(steps: number, inputProcessors: Processor[]) {
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
    id: 'second-processor-agent',
    name: 'Second processor agent',
    instructions: 'Read every file.',
    model,
    memory,
    tools: { view },
    inputProcessors,
  });

  const result = await agent.stream('Read every file in the project.', {
    memory: { thread: threadId, resource: resourceId },
    maxSteps: steps + 5,
  });
  const text = await result.text;
  return { prompts, text };
}

describe('a long run with an input processor that returns its messages after observational memory', () => {
  it('keeps the prompt as bounded as it is without that processor', async () => {
    // Returns what it was handed, as a processor that only inspects or rewrites messages does.
    const passThrough: Processor = {
      id: 'pass-through',
      processInputStep: async ({ messages }) => messages,
    };

    // 60 steps of ~2.8k-char tool results add about 170,000 chars if nothing leaves the prompt.
    const { prompts, text } = await longRun(60, [passThrough]);

    expect(text).toBe('all files read');
    expect(Math.max(...prompts.slice(-20)), 'largest of the last 20 requests, in chars').toBeLessThan(80_000);
  }, 120_000);
});
