import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraVector } from '@mastra/core/vector';
import { describe, expect, it, vi } from 'vitest';

import { Memory } from './index';

const makeVector = (): MastraVector =>
  ({
    createIndex: vi.fn().mockResolvedValue(undefined),
    upsert: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue([]),
    listIndexes: vi.fn().mockResolvedValue([]),
    deleteVectors: vi.fn().mockResolvedValue(undefined),
    describeIndex: vi.fn().mockResolvedValue({ dimension: 3 }),
    id: 'mock-vector',
  }) as any;

const makeEmbedder = () =>
  ({
    doEmbed: vi.fn().mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]] }),
    modelId: 'mock-embedder',
    specificationVersion: 'v1',
    provider: 'mock',
  }) as any;

const message: MastraDBMessage = {
  id: 'msg-1',
  role: 'user',
  content: { format: 2, parts: [{ type: 'text', text: 'hello' }], content: 'hello' },
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  threadId: 'thread-1',
  resourceId: 'resource-1',
};

/** Saves a turn through the history processor and returns the skipVectors flag Memory received. */
async function skipVectorsSeenBySave(memory: Memory) {
  const save = vi.spyOn(memory as any, '__mastraPersistGeneratedMessages');
  const history = (await memory.getOutputProcessors()).find(p => p.id === 'message-history') as any;
  await history.persistMessages({ messages: [message], threadId: 'thread-1', resourceId: 'resource-1' });
  expect(save).toHaveBeenCalledTimes(1);
  return (save.mock.calls[0]![0] as { skipVectors?: boolean }).skipVectors;
}

describe('MessageHistory saves and message vectors', () => {
  it('leaves vectors to SemanticRecall when it is in the output pipeline', async () => {
    const memory = new Memory({
      storage: new InMemoryStore(),
      vector: makeVector(),
      embedder: makeEmbedder(),
      options: { semanticRecall: true, lastMessages: 10 },
    });
    const processors = await memory.getOutputProcessors();
    expect(processors.map(p => p.id)).toContain('semantic-recall');

    expect(await skipVectorsSeenBySave(memory)).toBe(true);
  });

  it('lets the save write vectors when no SemanticRecall processor will', async () => {
    const memory = new Memory({
      storage: new InMemoryStore(),
      vector: makeVector(),
      embedder: makeEmbedder(),
      options: { semanticRecall: false, lastMessages: 10 },
    });

    expect(await skipVectorsSeenBySave(memory)).toBe(false);
  });
});
