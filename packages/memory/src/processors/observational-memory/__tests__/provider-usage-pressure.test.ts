import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Memory } from '../../../index';

async function run(steps: number, reportsUsage: boolean, buffered = false) {
  let observations = 0;
  const observerText = '<observations>Read the preceding files; continue the task.</observations>';
  const observer = new MockLanguageModelV2({
    doStream: async () => {
      observations++;
      return {
        warnings: [],
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'text-start', id: 'observation' });
            controller.enqueue({ type: 'text-delta', id: 'observation', delta: observerText });
            controller.enqueue({ type: 'text-end', id: 'observation' });
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
            });
            controller.close();
          },
        }),
      };
    },
    doGenerate: async () => {
      observations++;
      return {
        content: [{ type: 'text', text: observerText }],
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
        warnings: [],
      };
    },
  });
  const store = new InMemoryStore();
  const memory = new Memory({
    storage: store,
    options: {
      observationalMemory: {
        enabled: true,
        scope: 'thread',
        observation: { model: observer, messageTokens: 6_000, bufferTokens: buffered ? 1_200 : false },
        reflection: { model: observer, observationTokens: 50_000 },
      },
    },
  });
  const inputs: number[] = [];
  const observationCounts: number[] = [];
  const actor = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      // Provider-token occupancy intentionally has no relation to ciphertext byte length.
      const reasoningItems = prompt
        .flatMap(message => (typeof message.content === 'string' ? [] : message.content))
        .filter(part => part.type === 'reasoning').length;
      const inputTokens = 500 + reasoningItems * 2_000;
      inputs.push(inputTokens);
      observationCounts.push(observations);
      const call = inputs.length;
      const done = call > steps;
      const usage = reportsUsage
        ? {
            inputTokens,
            outputTokens: 2_010,
            totalTokens: inputTokens + 2_010,
            reasoningTokens: 2_000,
            cachedInputTokens: inputTokens,
          }
        : { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined };
      const id = `rs_${call}`;
      const providerMetadata = { openai: { itemId: id, reasoningEncryptedContent: `opaque-${call}` } };
      return {
        warnings: [],
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'reasoning-start', id, providerMetadata });
            controller.enqueue({ type: 'reasoning-delta', id, delta: 'Next.' });
            controller.enqueue({ type: 'reasoning-end', id, providerMetadata });
            if (done) {
              controller.enqueue({ type: 'text-start', id: 't' });
              controller.enqueue({ type: 'text-delta', id: 't', delta: 'done' });
              controller.enqueue({ type: 'text-end', id: 't' });
            } else {
              controller.enqueue({
                type: 'tool-call',
                toolCallId: `call-${call}`,
                toolName: 'read',
                input: JSON.stringify({ n: call }),
              });
            }
            controller.enqueue({ type: 'finish', finishReason: done ? 'stop' : 'tool-calls', usage });
            controller.close();
          },
        }),
      };
    },
  });
  const agent = new Agent({
    id: 'usage-pressure',
    name: 'Usage pressure',
    instructions: 'Read the files.',
    model: actor,
    memory,
    tools: {
      read: createTool({
        id: 'read',
        description: 'Read a file',
        inputSchema: z.object({ n: z.number() }),
        execute: async ({ n }) => `file ${n}`,
      }),
    },
  });
  const result = await agent.stream('Read the files.', {
    memory: { thread: 'usage-thread', resource: 'usage-resource' },
    maxSteps: steps + 2,
  });
  expect(await result.text).toBe('done');
  return { inputs, observationCounts, observations };
}

type Overhead = {
  steps: number;
  messageTokens: number;
  bufferTokens?: number;
  blockAfter?: number;
  /** Tool definitions the provider is charged for on every request, in characters. */
  toolDefinitionChars?: number;
  /** When set, every request reports this input instead of measuring the prompt. */
  reportedInput?: number;
};

// Provider input is the prompt's content only (chars / 4): no Mastra metadata, no reasoning.
function promptChars(prompt: unknown[]): number {
  let chars = 0;
  for (const message of prompt as { content: unknown }[]) {
    if (typeof message.content === 'string') {
      chars += message.content.length;
      continue;
    }
    for (const part of message.content as Record<string, unknown>[]) {
      if (part.type === 'text' || part.type === 'reasoning') chars += String(part.text).length;
      else if (part.type === 'tool-call') chars += JSON.stringify(part.input).length;
      else if (part.type === 'tool-result') chars += JSON.stringify(part.output).length;
    }
  }
  return chars;
}

// Distinct words, so the token estimate tracks chars / 4 rather than collapsing repeats.
function filler(chars: number, seed: string): string {
  let text = '';
  for (let i = 0; text.length < chars; i++) text += `${seed}${i.toString(36)} reads file ${i * 7919}; `;
  return text.slice(0, chars);
}

async function runOverhead(options: Overhead) {
  const { steps, messageTokens, bufferTokens, blockAfter, toolDefinitionChars = 0 } = options;
  const triggers: (string | undefined)[] = [];
  let observations = 0;
  const observerText = `<observations>${filler(200, 'o')}</observations>`;
  const observerUsage = { inputTokens: 10, outputTokens: 10, totalTokens: 20 };
  const observer = new MockLanguageModelV2({
    doStream: async () => {
      observations++;
      return {
        warnings: [],
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'text-start', id: 'observation' });
            controller.enqueue({ type: 'text-delta', id: 'observation', delta: observerText });
            controller.enqueue({ type: 'text-end', id: 'observation' });
            controller.enqueue({ type: 'finish', finishReason: 'stop', usage: observerUsage });
            controller.close();
          },
        }),
      };
    },
    doGenerate: async () => {
      observations++;
      return {
        content: [{ type: 'text', text: observerText }],
        finishReason: 'stop',
        usage: observerUsage,
        warnings: [],
      };
    },
  });
  const memory = new Memory({
    storage: new InMemoryStore(),
    options: {
      observationalMemory: {
        enabled: true,
        scope: 'thread',
        observation: {
          model: observer,
          messageTokens,
          ...(bufferTokens ? { bufferTokens, blockAfter } : { bufferTokens: false as const }),
        },
        hooks: { onObservationStart: info => void triggers.push(info?.trigger) },
        reflection: { model: observer, observationTokens: 50_000 },
      },
    },
  });
  const inputs: number[] = [];
  const actor = new MockLanguageModelV2({
    doStream: async ({ prompt, tools }) => {
      const inputTokens =
        options.reportedInput ?? Math.ceil((promptChars(prompt) + JSON.stringify(tools ?? []).length) / 4);
      inputs.push(inputTokens);
      const call = inputs.length;
      const done = call > steps;
      return {
        warnings: [],
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            if (done) {
              controller.enqueue({ type: 'text-start', id: 't' });
              controller.enqueue({ type: 'text-delta', id: 't', delta: 'done' });
              controller.enqueue({ type: 'text-end', id: 't' });
            } else {
              controller.enqueue({
                type: 'tool-call',
                toolCallId: `call-${call}`,
                toolName: 'read',
                input: JSON.stringify({ n: call }),
              });
            }
            controller.enqueue({
              type: 'finish',
              finishReason: done ? 'stop' : 'tool-calls',
              usage: { inputTokens, outputTokens: 10, totalTokens: inputTokens + 10 },
            });
            controller.close();
          },
        }),
      };
    },
  });
  const unusedTools = Object.fromEntries(
    Array.from({ length: toolDefinitionChars ? 10 : 0 }, (_, i) => [
      `tool_${i}`,
      createTool({
        id: `tool_${i}`,
        description: filler(toolDefinitionChars / 10, `d${i}`),
        inputSchema: z.object({ n: z.number() }),
        execute: async () => 'unused',
      }),
    ]),
  );
  const agent = new Agent({
    id: 'overhead-pressure',
    name: 'Overhead pressure',
    instructions: 'Read the files.',
    model: actor,
    memory,
    tools: {
      read: createTool({
        id: 'read',
        description: 'Read a file',
        inputSchema: z.object({ n: z.number() }),
        // Fixed result size; the thresholds in the overhead tests are chosen against it.
        execute: async ({ n }) => `file ${n}${'x'.repeat(400)}`,
      }),
      ...unusedTools,
    },
  });
  const result = await agent.stream('Read the files.', {
    memory: { thread: 'overhead-thread', resource: 'overhead-resource' },
    maxSteps: steps + 2,
  });
  expect(await result.text).toBe('done');
  return { inputs, observations, triggers };
}

describe('provider-reported context pressure', () => {
  it.each([false, true])(
    'bounds a 200-step reasoning run including cached input (buffered: %s)',
    async buffered => {
      const { inputs, observationCounts, observations } = await run(200, true, buffered);
      console.log('Usage-pressure proof:', {
        requests: inputs.length,
        maxInputTokens: Math.max(...inputs),
        observations,
      });
      expect(observationCounts[0], 'the first request has no usage anchor').toBe(0);
      expect(Math.max(...inputs.slice(-50)), 'provider input on the last 50 requests').toBeLessThan(20_000);
      expect(observations).toBeGreaterThan(0);
      // Unread output survives one observation. Once it is read and removed,
      // fresh usage must drop rather than force observation on every later step.
      expect(observations).toBeLessThanOrEqual(100);
      expect(inputs.slice(-50).some(tokens => tokens === 2_500)).toBe(true);
    },
    120_000,
  );

  it('keeps the estimate fallback when the provider reports no usage', async () => {
    const { inputs, observations } = await run(8, false);
    expect(inputs).toHaveLength(9);
    expect(observations).toBe(0);
  }, 30_000);

  it('does not charge tool definitions against the message budget', async () => {
    // About 5k tokens of tool definitions against a 3k message budget; the messages stay far below it.
    const { observations } = await runOverhead({ steps: 10, messageTokens: 3_000, toolDefinitionChars: 20_000 });
    expect(observations, 'observer calls when only the tool definitions are large').toBe(0);
  }, 60_000);

  it('buffers instead of blocking when measured pressure is between the threshold and blockAfter', async () => {
    // Messages are tiny, but each request reports ~1.4k input against a 1k threshold and a 1.5k blockAfter.
    const { triggers } = await runOverhead({
      steps: 6,
      messageTokens: 1_000,
      bufferTokens: 250,
      blockAfter: 1.5,
      reportedInput: 1_400,
    });
    expect(triggers, 'no blocking observation below blockAfter').not.toContain('turn-sync');
    expect(triggers, 'a buffered observation starts in the band').toContain('async-buffer');
  }, 60_000);
});
