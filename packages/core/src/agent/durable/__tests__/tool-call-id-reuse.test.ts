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

/** Step 1 and 2 call `lookup`, step 3 answers — `secondId` is the reused or distinct id. */
function scriptedModel(secondId: string, captured: Captured) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      captured.prompts.push(prompt as any[]);
      const step = captured.prompts.length;
      if (step === 1) return toolCallStream('s1', 'call_0', 'a');
      if (step === 2) return toolCallStream('s2', secondId, 'b');
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

  async function runAgent(kind: Kind, secondId: string): Promise<any[][]> {
    const captured: Captured = { prompts: [] };
    const base = new Agent({
      id: 'repro',
      name: 'repro',
      instructions: 'test',
      model: scriptedModel(secondId, captured) as LanguageModelV2,
      tools: { lookup },
      ...(kind === 'plain' ? {} : { memory: new MockMemory({ storage: new InMemoryStore() }) }),
    });
    const pubsub = new EventEmitterPubSub();
    pubsubs.push(pubsub);
    const agent = kind === 'durable' ? createDurableAgent({ agent: base, pubsub }) : base;
    new Mastra({ agents: { repro: agent }, storage: new InMemoryStore(), logger: false });

    const out = await (agent as any).stream('go', {
      maxSteps: 5,
      ...(kind === 'plain' ? {} : { memory: { thread: `t-${kind}-${secondId}`, resource: 'r' } }),
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
});
