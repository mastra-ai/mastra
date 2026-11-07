import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraVector } from '@mastra/core/vector';
import { describe, expect, it, vi } from 'vitest';

import { Memory } from './index';

const dimension = 3;

function setup() {
  const vector = {
    id: 'recording-vector',
    createIndex: vi.fn().mockResolvedValue(undefined),
    upsert: vi.fn().mockResolvedValue([]),
    query: vi.fn().mockResolvedValue([]),
    listIndexes: vi.fn().mockResolvedValue([]),
    deleteVectors: vi.fn().mockResolvedValue(undefined),
    describeIndex: vi.fn().mockResolvedValue({ dimension }),
  } as unknown as MastraVector;
  const storage = new InMemoryStore();
  const memory = new Memory({
    storage,
    vector,
    embedder: {
      doEmbed: vi.fn().mockResolvedValue({ embeddings: [new Array(dimension).fill(0.1)] }),
      modelId: 'mock-embedder',
      specificationVersion: 'v1',
      provider: 'mock',
    } as any,
    options: { lastMessages: 10, semanticRecall: { topK: 2, messageRange: 1 } },
  });
  const model = new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start' as const, warnings: [] },
        { type: 'text-start' as const, id: 'text' },
        { type: 'text-delta' as const, id: 'text', delta: 'on it' },
        { type: 'text-end' as const, id: 'text' },
        {
          type: 'finish' as const,
          finishReason: 'stop' as const,
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      ]),
    }),
  });
  const agent = new Agent({ id: 'recall-agent', name: 'recall agent', instructions: 'Reply.', memory, model });
  new Mastra({ agents: { recallAgent: agent }, logger: false, storage });
  return { agent, memory, vector };
}

describe('semantic recall and messages a person sends', () => {
  it('indexes a sent message once, under its id', async () => {
    const { agent, memory, vector } = setup();
    const thread = { resourceId: 'recall-user', threadId: 'recall-thread' };
    await memory.createThread(thread);

    const sent = agent.sendMessage({ contents: 'build the login page' }, thread);
    const run = await sent.accepted;
    expect(run.action).toBe('wake');
    if (run.action === 'wake') await run.output.consumeStream();

    const rows = vi
      .mocked(vector.upsert)
      .mock.calls.flatMap(([args]) => args.metadata!.map((metadata, index) => ({ id: args.ids?.[index], metadata })))
      .filter(row => row.metadata.message_id === sent.signal.id);
    expect(rows.map(row => row.id)).toEqual([sent.signal.id]);
  });
});
