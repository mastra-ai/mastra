import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { MockLanguageModelV3 } from '@internal/ai-v6/test';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Memory } from '../../../index';

type RunOptions = {
  /** Shared storage, so a later run resumes the thread with a new Memory (a restarted process). */
  store?: InMemoryStore;
  messageTokens?: number;
  /** Prompt the provider adds on every request (e.g. its own tool-use prompt), never in the messages. */
  hiddenProviderTokens?: number;
};

async function run(steps: number, reportsUsage: boolean, buffered = false, options: RunOptions = {}) {
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
  const store = options.store ?? new InMemoryStore();
  const memory = new Memory({
    storage: store,
    options: {
      observationalMemory: {
        enabled: true,
        scope: 'thread',
        observation: {
          model: observer,
          messageTokens: options.messageTokens ?? 6_000,
          bufferTokens: buffered ? 1_200 : false,
        },
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
      const inputTokens = 500 + (options.hiddenProviderTokens ?? 0) + reasoningItems * 2_000;
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
  /** Prompt the provider adds on every request (its own tool-use prompt), never in the messages. */
  hiddenProviderTokens?: number;
  /** Input the provider counts per step beyond what the local estimate sees (e.g. an attachment tokenized larger). */
  unseenGrowthPerStep?: number;
  /** The first response reports no usage at all. */
  firstStepUsageUnknown?: boolean;
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
      const call = inputs.length + 1;
      const inputTokens =
        options.reportedInput ??
        Math.ceil((promptChars(prompt) + JSON.stringify(tools ?? []).length) / 4) +
          (options.hiddenProviderTokens ?? 0) +
          (options.unseenGrowthPerStep ?? 0) * (call - 1);
      inputs.push(inputTokens);
      const usage =
        options.firstStepUsageUnknown && call === 1
          ? { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined }
          : { inputTokens, outputTokens: 10, totalTokens: inputTokens + 10 };
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
              usage,
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

// The usage @ai-sdk/openai (4.0.106, convertOpenAIResponsesUsage) returns for a Responses call: nested totals
// plus the provider's own usage object under `raw`. A Codex response's usage also carries a per-field split of
// the request (`attribution.request_fields`); a live run reported instructions 53 and tools 69.
function responsesUsage(input: number, output: number, requestFields: Record<string, number>) {
  const fieldUsage = (tokens: number) => ({
    input_tokens: tokens,
    cached_tokens: 0,
    cache_write_tokens: 0,
    output_tokens: 0,
  });
  return {
    inputTokens: { total: input, noCache: input, cacheRead: 0, cacheWrite: undefined },
    outputTokens: { total: output, text: output, reasoning: 0 },
    raw: {
      input_tokens: input,
      input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
      output_tokens: output,
      output_tokens_details: { reasoning_tokens: 0 },
      total_tokens: input + output,
      attribution: {
        items: {},
        request_fields: Object.fromEntries(
          Object.entries(requestFields).map(([field, tokens]) => [field, fieldUsage(tokens)]),
        ),
      },
    },
  };
}

/**
 * A reasoning run whose provider reports the per-field split of each request. The first response reports no
 * usage, so every later request already replays reasoning and only the reported split can measure the prompt
 * the provider adds.
 */
async function runReported(steps: number, messageTokens: number, requestFields: Record<string, number>) {
  let observations = 0;
  const observerText = `<observations>${filler(200, 'o')}</observations>`;
  const observerUsage = { inputTokens: 10, outputTokens: 10, totalTokens: 20 };
  const observer = new MockLanguageModelV2({
    doGenerate: async () => {
      observations++;
      return {
        content: [{ type: 'text', text: observerText }],
        finishReason: 'stop',
        usage: observerUsage,
        warnings: [],
      };
    },
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
  });
  const memory = new Memory({
    storage: new InMemoryStore(),
    options: {
      observationalMemory: {
        enabled: true,
        scope: 'thread',
        observation: { model: observer, messageTokens, bufferTokens: false },
        reflection: { model: observer, observationTokens: 50_000 },
      },
    },
  });
  const added = Object.values(requestFields).reduce((sum, tokens) => sum + tokens, 0);
  let calls = 0;
  const actor = new MockLanguageModelV3({
    doStream: async ({ prompt }) => {
      calls++;
      const call = calls;
      const done = call > steps;
      const inputTokens = Math.ceil(promptChars(prompt) / 4) + added;
      const usage =
        call === 1
          ? {
              inputTokens: { total: undefined, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: undefined, text: undefined, reasoning: undefined },
            }
          : responsesUsage(inputTokens, 10, requestFields);
      const id = `rs_${call}`;
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'reasoning-start', id });
            controller.enqueue({ type: 'reasoning-delta', id, delta: 'Next.' });
            controller.enqueue({ type: 'reasoning-end', id });
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
              finishReason: { unified: done ? 'stop' : 'tool-calls', raw: undefined },
              usage,
            });
            controller.close();
          },
        }),
      };
    },
  });
  const usages: unknown[] = [];
  const agent = new Agent({
    id: 'reported-pressure',
    name: 'Reported pressure',
    instructions: 'Read the files.',
    model: actor,
    memory,
    tools: {
      read: createTool({
        id: 'read',
        description: 'Read a file',
        inputSchema: z.object({ n: z.number() }),
        execute: async ({ n }) => `file ${n}${'x'.repeat(400)}`,
      }),
    },
    outputProcessors: [
      {
        id: 'usage-spy',
        processOutputStep: async ({ usage, messageList }) => {
          usages.push(usage);
          return messageList;
        },
      },
    ],
  });
  const result = await agent.stream('Read the files.', {
    memory: { thread: 'reported-thread', resource: 'reported-resource' },
    maxSteps: steps + 2,
  });
  expect(await result.text).toBe('done');
  return { observations, usages };
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

  it('subtracts the prompt a provider adds that the local count never sees', async () => {
    // Anthropic charged 480 tokens for two tool schemas a local count puts near 69: its own tool-use prompt.
    // Here the provider adds 5k hidden tokens against a 3k budget; the messages stay far below it.
    const { observations } = await runOverhead({ steps: 10, messageTokens: 3_000, hiddenProviderTokens: 5_000 });
    expect(observations, 'observer calls when only the provider-added prompt is large').toBe(0);
  }, 60_000);

  it('takes the provider-added prompt from the per-field split the response reports', async () => {
    const requestFields = { instructions: 2_500, tools: 2_500 };
    const { observations, usages } = await runReported(10, 3_000, requestFields);
    const reported = usages.at(-1) as {
      raw?: { raw?: { attribution?: { request_fields?: Record<string, unknown> } } };
    };
    expect(
      Object.keys(reported.raw?.raw?.attribution?.request_fields ?? {}),
      'where the provider usage split reaches processOutputStep',
    ).toEqual(['instructions', 'tools']);
    expect(observations, 'observer calls when only the reported request fields are large').toBe(0);
  }, 60_000);

  it('does not measure the provider-added prompt from a request that replays reasoning', async () => {
    // A resumed thread replays 20 reasoning items the provider bills (2k each) but the local count sees as 0.
    // A residual taken from that request would hide the reasoning, and pressure with it, for the rest of the run.
    const store = new InMemoryStore();
    await run(20, true, false, { store, messageTokens: 1_000_000 });
    const resumed = await run(3, true, false, { store });
    expect(resumed.observations, 'observer calls once the replayed reasoning is measured').toBeGreaterThan(0);
  }, 60_000);

  it('keeps one measurement of the provider-added prompt while observations rewrite the system block', async () => {
    const plain = await run(60, true, false);
    const hidden = await run(60, true, false, { hiddenProviderTokens: 5_000 });
    expect(plain.observations).toBeGreaterThan(0);
    expect(hidden.observations, 'observer calls with a 5k provider-added prompt').toBeLessThanOrEqual(
      plain.observations + 2,
    );
  }, 120_000);

  it('measures the provider-added prompt once, so later growth the estimate misses still counts', async () => {
    // Each step the provider counts 600 more tokens than the local estimate sees (e.g. an attachment).
    const { observations } = await runOverhead({ steps: 10, messageTokens: 3_000, unseenGrowthPerStep: 600 });
    expect(observations, 'observer calls once the unseen growth passes the budget').toBeGreaterThan(0);
  }, 60_000);

  it('never records an unknown count as a measurement', async () => {
    const { observations } = await runOverhead({
      steps: 10,
      messageTokens: 3_000,
      hiddenProviderTokens: 5_000,
      firstStepUsageUnknown: true,
    });
    expect(observations, 'observer calls when the first response reports no usage').toBe(0);
  }, 60_000);
});
