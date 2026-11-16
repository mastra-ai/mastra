/**
 * Observational memory turned on only in the call's `memory.options` (not on `new Memory`).
 *
 * The OM engine is built from the Memory instance config, so a call-only OM setting has no
 * engine to save the turn. Every engine must still store the user message and the reply.
 */
import { randomUUID } from 'node:crypto';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, expect, it } from 'vitest';
import { persistedMessages, streamTurn } from './durable-harness-helpers';

const REPLY = 'Lisbon is sunny.';

function mockModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'r1', modelId: 'mock', timestamp: new Date(0) },
        { type: 'text-start', id: 't1' },
        { type: 'text-delta', id: 't1', delta: REPLY },
        { type: 'text-end', id: 't1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
      ]),
    }),
  });
}

const omOptions = { observationalMemory: { enabled: true, model: mockModel(), scope: 'thread' } } as any;

const CASES = {
  'regular Agent, OM on call only': { engine: 'plain', instanceOM: false, callOM: true },
  'DurableAgent, OM on Memory and call': { engine: 'durable', instanceOM: true, callOM: true },
  'DurableAgent, OM on call only': { engine: 'durable', instanceOM: false, callOM: true },
  'DurableAgent, OM on Memory only': { engine: 'durable', instanceOM: true, callOM: false },
} as const;

describe('call-only observational memory', () => {
  it.each(Object.entries(CASES))('%s stores the user message and the reply', async (_name, c) => {
    const storage = new LibSQLStore({ id: randomUUID(), url: ':memory:' });
    const memory = new Memory({
      storage,
      options: {
        lastMessages: 10,
        semanticRecall: false,
        generateTitle: false,
        ...(c.instanceOM ? omOptions : {}),
      } as any,
    });
    const agent = new Agent({ id: `a-${randomUUID()}`, name: 'a', model: mockModel(), memory, instructions: 'hi' });
    const runner = c.engine === 'plain' ? agent : createDurableAgent({ agent });
    const mastra = new Mastra({ agents: { a: runner as any }, storage, logger: false });

    const thread = randomUUID();
    const resource = randomUUID();
    const run = await streamTurn(runner, c.engine, 'Weather in Lisbon?', {
      memory: { thread, resource, ...(c.callOM ? { options: omOptions } : {}) },
    });
    await (mastra as any).stopWorkers?.();
    expect(run.threw).toBeNull();

    const messages = await persistedMessages(memory, thread, resource);
    expect(messages.map(m => m.role)).toEqual(['user', 'assistant']);
  });
});
