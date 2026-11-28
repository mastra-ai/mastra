/**
 * Regression for #31609: a gateway that numbers tool calls per response
 * (`call_0`, `call_1`, …) reuses `call_0` for every single-call step. The
 * second call and its own result must reach the model instead of being merged
 * into the first invocation.
 *
 * A scripted model captures every prompt. Step 1 calls `lookup({q:"a"})` as
 * `call_0`, step 2 calls `lookup({q:"b"})` as `call_0` again (control: `call_1`),
 * step 3 answers, so the third prompt must contain both calls and both results.
 * Plain, memory-backed and durable agents share the same message-list merge.
 *
 * The second block covers the same reuse through a provider-executed say-do
 * tool: the gateway returns the call and its result in one response, so the
 * message list only ever sees a completed part and there is no separate
 * `updateToolInvocation` pass to disambiguate the occurrences.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';

type Kind = 'plain' | 'memory' | 'durable';
type Captured = { prompts: any[][] };

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

const stream = (chunks: any[]) => ({
  rawCall: { rawPrompt: null, rawSettings: {} },
  warnings: [],
  stream: convertArrayToReadableStream<any>(chunks),
});

const toolCallStream = (id: string, toolCallId: string, q: string) =>
  stream([
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id, modelId: 'mock-model', timestamp: new Date(0) },
    {
      type: 'tool-call',
      toolCallType: 'function',
      toolCallId,
      toolName: 'lookup',
      input: JSON.stringify({ q }),
      providerExecuted: false,
    },
    { type: 'finish', finishReason: 'tool-calls', usage },
  ]);

const textStream = (id: string, text: string) =>
  stream([
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id, modelId: 'mock-model', timestamp: new Date(0) },
    { type: 'text-start', id: `${id}-text` },
    { type: 'text-delta', id: `${id}-text`, delta: text },
    { type: 'text-end', id: `${id}-text` },
    { type: 'finish', finishReason: 'stop', usage },
  ]);

/** A provider-executed call whose result arrives in the same response, as gateways do. */
const providerCallStream = (id: string, toolCallId: string, q: string) =>
  stream([
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id, modelId: 'mock-model', timestamp: new Date(0) },
    {
      type: 'tool-call',
      toolCallType: 'function',
      toolCallId,
      toolName: 'web_search',
      input: JSON.stringify({ q }),
      providerExecuted: true,
    },
    {
      type: 'tool-result',
      toolCallId,
      toolName: 'web_search',
      result: { answer: `result-${q}` },
      providerExecuted: true,
    },
    { type: 'finish', finishReason: 'tool-calls', usage },
  ]);

const webSearch = {
  type: 'provider-defined' as const,
  id: 'test.web_search',
  name: 'web_search',
  inputSchema: z.object({ q: z.string() }),
  outputSchema: z.object({ answer: z.string() }),
  args: {},
};

/**
 * Step 1 and 2 call `lookup`, step 3 answers — `secondId` is the reused or distinct id and
 * `secondQ` the second step's arguments (`b` differs from step 1, `a` repeats it).
 */
function scriptedModel(secondId: string, captured: Captured, secondQ = 'b') {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      captured.prompts.push(prompt as any[]);
      const step = captured.prompts.length;
      if (step === 1) return toolCallStream('s1', 'call_0', 'a');
      if (step === 2) return toolCallStream('s2', secondId, secondQ);
      return textStream('s3', 'done');
    },
  });
}

const lookup = createTool({
  id: 'lookup',
  description: 'Look something up',
  inputSchema: z.object({ q: z.string() }),
  execute: async ({ q }) => ({ answer: `result-${q}` }),
});

const partsIn = (prompt: any[]) => prompt.flatMap(message => (Array.isArray(message.content) ? message.content : []));

const toolCallsIn = (prompt: any[]) =>
  partsIn(prompt)
    .filter(part => part.type === 'tool-call')
    .map(part => `${part.toolCallId} ${JSON.stringify(part.input)}`);

const toolResultsIn = (prompt: any[]) =>
  partsIn(prompt)
    .filter(part => part.type === 'tool-result')
    .map(part => `${part.toolCallId} ${JSON.stringify(part.output?.value ?? part.output)}`);

describe('tool call id reuse within a run (#31609)', () => {
  const pubsubs: EventEmitterPubSub[] = [];

  beforeEach(() => {
    pubsubs.length = 0;
  });

  afterEach(async () => {
    globalRunRegistry.clear();
    await Promise.all(pubsubs.splice(0).map(pubsub => pubsub.close()));
  });

  async function runAgent(kind: Kind, secondId: string, secondQ = 'b'): Promise<any[][]> {
    const captured: Captured = { prompts: [] };
    const base = new Agent({
      id: 'repro',
      name: 'repro',
      instructions: 'test',
      model: scriptedModel(secondId, captured, secondQ) as LanguageModelV2,
      tools: { lookup },
      ...(kind === 'plain' ? {} : { memory: new MockMemory({ storage: new InMemoryStore() }) }),
    });
    const pubsub = new EventEmitterPubSub();
    pubsubs.push(pubsub);
    const agent = kind === 'durable' ? createDurableAgent({ agent: base, pubsub }) : base;
    new Mastra({ agents: { repro: agent }, storage: new InMemoryStore(), logger: false });

    const out = await (agent as any).stream('go', {
      maxSteps: 5,
      ...(kind === 'plain' ? {} : { memory: { thread: `t-${kind}-${secondId}-${secondQ}`, resource: 'r' } }),
    });
    for await (const _chunk of out.fullStream) {
      // drain to completion
    }
    await out.cleanup?.();
    return captured.prompts;
  }

  it.each<Kind>(['plain', 'memory', 'durable'])('%s: keeps both calls when a later step reuses call_0', async kind => {
    const prompts = await runAgent(kind, 'call_0');
    expect(toolCallsIn(prompts[2]!)).toEqual(['call_0 {"q":"a"}', 'call_0 {"q":"b"}']);
    expect(toolResultsIn(prompts[2]!)).toEqual(['call_0 {"answer":"result-a"}', 'call_0 {"answer":"result-b"}']);
  });

  it.each<Kind>(['plain', 'memory', 'durable'])('%s: keeps distinct second-step ids separate', async kind => {
    const prompts = await runAgent(kind, 'call_1');
    expect(toolCallsIn(prompts[2]!)).toEqual(['call_0 {"q":"a"}', 'call_1 {"q":"b"}']);
    expect(toolResultsIn(prompts[2]!)).toEqual(['call_0 {"answer":"result-a"}', 'call_1 {"answer":"result-b"}']);
  });

  it.each<Kind>(['plain', 'memory', 'durable'])(
    '%s: keeps both calls when a later step repeats call_0 with the same arguments',
    async kind => {
      // Same id *and* same arguments: only the step separates the two invocations.
      const prompts = await runAgent(kind, 'call_0', 'a');
      expect(toolCallsIn(prompts[2]!)).toEqual(['call_0 {"q":"a"}', 'call_0 {"q":"a"}']);
      expect(toolResultsIn(prompts[2]!)).toEqual(['call_0 {"answer":"result-a"}', 'call_0 {"answer":"result-a"}']);
    },
  );
});

/** Step 1 and 2 let the provider return `web_search`'s result inline; step 3 answers. */
function scriptedProviderModel(secondId: string, captured: Captured, secondQ = 'b') {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      captured.prompts.push(prompt as any[]);
      const step = captured.prompts.length;
      if (step === 1) return providerCallStream('s1', 'call_0', 'a');
      if (step === 2) return providerCallStream('s2', secondId, secondQ);
      return textStream('s3', 'done');
    },
  });
}

const asObject = (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : value);

const providerCallsIn = (prompt: any[]) =>
  partsIn(prompt)
    .filter(part => part.type === 'tool-call')
    .map(part => `${part.toolCallId} ${JSON.stringify(asObject(part.input))}`);

const providerResultsIn = (prompt: any[]) =>
  partsIn(prompt)
    .filter(part => part.type === 'tool-result')
    .map(part => `${part.toolCallId} ${JSON.stringify(asObject(part.output?.value ?? part.output ?? part.result))}`);

describe('provider-executed call and result in one response (#31609)', () => {
  const pubsubs: EventEmitterPubSub[] = [];

  beforeEach(() => {
    pubsubs.length = 0;
  });

  afterEach(async () => {
    globalRunRegistry.clear();
    await Promise.all(pubsubs.splice(0).map(pubsub => pubsub.close()));
  });

  async function runProviderAgent(kind: Kind, secondId: string, secondQ = 'b'): Promise<any[][]> {
    const captured: Captured = { prompts: [] };
    const base = new Agent({
      id: 'repro',
      name: 'repro',
      instructions: 'test',
      model: scriptedProviderModel(secondId, captured, secondQ) as LanguageModelV2,
      tools: { web_search: webSearch },
      ...(kind === 'plain' ? {} : { memory: new MockMemory({ storage: new InMemoryStore() }) }),
    });
    const pubsub = new EventEmitterPubSub();
    pubsubs.push(pubsub);
    const agent = kind === 'durable' ? createDurableAgent({ agent: base, pubsub }) : base;
    new Mastra({ agents: { repro: agent }, storage: new InMemoryStore(), logger: false });

    const out = await (agent as any).stream('go', {
      maxSteps: 5,
      ...(kind === 'plain' ? {} : { memory: { thread: `p-${kind}-${secondId}-${secondQ}`, resource: 'r' } }),
    });
    for await (const _chunk of out.fullStream) {
      // drain to completion
    }
    await out.cleanup?.();
    return captured.prompts;
  }

  it.each<Kind>(['plain', 'memory', 'durable'])('%s: keeps both calls when a later step reuses call_0', async kind => {
    const prompts = await runProviderAgent(kind, 'call_0');
    expect(providerCallsIn(prompts[2]!)).toEqual(['call_0 {"q":"a"}', 'call_0 {"q":"b"}']);
    expect(providerResultsIn(prompts[2]!)).toEqual(['call_0 {"answer":"result-a"}', 'call_0 {"answer":"result-b"}']);
  });

  it.each<Kind>(['plain', 'memory', 'durable'])('%s: keeps distinct second-step ids separate', async kind => {
    const prompts = await runProviderAgent(kind, 'call_1');
    expect(providerCallsIn(prompts[2]!)).toEqual(['call_0 {"q":"a"}', 'call_1 {"q":"b"}']);
    expect(providerResultsIn(prompts[2]!)).toEqual(['call_0 {"answer":"result-a"}', 'call_1 {"answer":"result-b"}']);
  });

  it.each<Kind>(['plain', 'memory', 'durable'])(
    '%s: keeps both calls when a later step repeats call_0 with the same arguments',
    async kind => {
      // The gateway coalesces call and result into one part, so the repeated invocation is only
      // separated from the first by the step it arrives in (#31609).
      const prompts = await runProviderAgent(kind, 'call_0', 'a');
      expect(providerCallsIn(prompts[2]!)).toEqual(['call_0 {"q":"a"}', 'call_0 {"q":"a"}']);
      expect(providerResultsIn(prompts[2]!)).toEqual(['call_0 {"answer":"result-a"}', 'call_0 {"answer":"result-a"}']);
    },
  );
});
