/**
 * DurableAgent processOutputResult abort parity with Agent (#25996).
 * A tripwire raised in processOutputResult must surface as a tripwire
 * and the rejected answer must not be saved to memory.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, afterEach } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import type { Processor } from '../../../processors';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function createModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
        { type: 'text-start', id: 't' },
        { type: 'text-delta', id: 't', delta: 'hello gate' },
        { type: 'text-end', id: 't' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

const gate: Processor = {
  id: 'gate',
  processOutputResult: ({ abort }) => abort('rejected by gate'),
};

describe('DurableAgent processOutputResult abort', () => {
  const pubsub = new EventEmitterPubSub();
  afterEach(async () => {
    await pubsub.close();
  });

  it('reports the tripwire and does not persist the rejected answer', async () => {
    const memory = new MockMemory();
    const agent = new Agent({
      id: 'gate-agent',
      name: 'Gate Agent',
      instructions: 'test',
      model: createModel() as LanguageModelV2,
      memory,
      outputProcessors: [gate],
    });
    const durableAgent = createDurableAgent({ agent, pubsub });
    new Mastra({ agents: { 'gate-agent': durableAgent as any }, logger: false, storage: new InMemoryStore(), pubsub });

    const { output, cleanup } = await durableAgent.stream('hi', {
      memory: { thread: 'thread-1', resource: 'user-1' },
    });
    const chunks: any[] = [];
    for await (const chunk of output.fullStream) chunks.push(chunk);

    expect(chunks.find(c => c.type === 'tripwire')?.payload).toMatchObject({
      reason: 'rejected by gate',
      processorId: 'gate',
    });
    expect(await output.finishReason).toBe('other');
    expect(output.tripwire).toMatchObject({ reason: 'rejected by gate', processorId: 'gate' });

    const { messages } = await memory.recall({ threadId: 'thread-1', resourceId: 'user-1' });
    expect(messages.filter(m => m.role === 'assistant')).toHaveLength(0);
    cleanup();
  });
});
