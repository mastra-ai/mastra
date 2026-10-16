import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, vi } from 'vitest';
import { Memory } from './index';

type Entry = { vector: number[]; metadata: Record<string, any> };

function matches(metadata: Record<string, any>, filter: Record<string, any> = {}): boolean {
  return Object.entries(filter).every(([key, expected]) =>
    expected && typeof expected === 'object' && '$ne' in expected
      ? metadata[key] !== expected.$ne
      : metadata[key] === expected,
  );
}

/**
 * Vector store that honours metadata filters and, like LibSQL, replaces the whole metadata
 * object on `updateVector`.
 */
function createVectorStore() {
  const indexes = new Map<string, Map<string, Entry>>();
  const index = (name: string) => indexes.get(name) ?? indexes.set(name, new Map()).get(name)!;
  return {
    id: 'fake-vector',
    createIndex: vi.fn(async ({ indexName }: { indexName: string }) => void index(indexName)),
    listIndexes: vi.fn(async () => [...indexes.keys()]),
    describeIndex: vi.fn(async () => ({ dimension: 2, count: 0, metric: 'cosine' })),
    upsert: vi.fn(async ({ indexName, ids, vectors, metadata }: any) => {
      ids.forEach((id: string, i: number) => index(indexName).set(id, { vector: vectors[i], metadata: metadata[i] }));
      return ids;
    }),
    query: vi.fn(async ({ indexName, filter, topK = 10 }: any) =>
      [...index(indexName).entries()]
        .filter(([, entry]) => matches(entry.metadata, filter))
        .slice(0, topK)
        .map(([id, entry]) => ({ id, score: 1, metadata: entry.metadata })),
    ),
    updateVector: vi.fn(async ({ indexName, id, update }: any) => {
      const entry = index(indexName).get(id)!;
      index(indexName).set(id, { vector: update.vector ?? entry.vector, metadata: update.metadata ?? entry.metadata });
    }),
    deleteVectors: vi.fn(async () => {}),
  };
}

function createMemory() {
  const vector = createVectorStore();
  const memory = new Memory({
    storage: new InMemoryStore(),
    vector: vector as any,
    embedder: {
      specificationVersion: 'v3',
      provider: 'test',
      modelId: 'test-model',
      doEmbed: vi.fn(async ({ values }: { values: string[] }) => ({
        embeddings: values.map(() => [0.1, 0.2]),
        warnings: [],
      })),
    } as any,
    options: { generateTitle: false },
  });
  return { memory, vector };
}

async function seedThread(memory: Memory, threadId: string, resourceId: string, text: string) {
  await memory.saveThread({
    thread: { id: threadId, resourceId, title: threadId, createdAt: new Date(), updatedAt: new Date() },
  });
  await memory.indexObservation({
    text,
    groupId: `${threadId}-group`,
    range: 'msg-1:msg-2',
    threadId,
    resourceId,
    recordId: `${threadId}-record`,
  });
}

describe('moving a thread to another resource', () => {
  it("finds the thread's past observations in recall search under its new resource", async () => {
    const { memory } = createMemory();
    await seedThread(memory, 'session-a', 'session-a', 'The deploy target is staging');
    await seedThread(memory, 'session-b', 'session-b', 'Session b keeps its own notes');

    await memory.updateThreadResourceId({ threadId: 'session-a', resourceId: 'factory-1' });

    const underFactory = await memory.searchMessages({ query: 'deploy target', resourceId: 'factory-1' });
    expect(underFactory.results).toEqual([
      expect.objectContaining({
        threadId: 'session-a',
        groupId: 'session-a-group',
        recordId: 'session-a-record',
        range: 'msg-1:msg-2',
        text: 'The deploy target is staging',
      }),
    ]);
    expect((await memory.searchMessages({ query: 'deploy target', resourceId: 'session-a' })).results).toEqual([]);
    expect((await memory.searchMessages({ query: 'notes', resourceId: 'session-b' })).results).toEqual([
      expect.objectContaining({ threadId: 'session-b' }),
    ]);
  });

  it('moves nothing when the thread already belongs to the resource', async () => {
    const { memory, vector } = createMemory();
    await seedThread(memory, 'session-a', 'session-a', 'The deploy target is staging');
    await memory.updateThreadResourceId({ threadId: 'session-a', resourceId: 'factory-1' });
    vector.updateVector.mockClear();

    await memory.updateThreadResourceId({ threadId: 'session-a', resourceId: 'factory-1' });

    expect(vector.updateVector).not.toHaveBeenCalled();
  });

  it('leaves a vector alone when the store returns it without metadata', async () => {
    const { memory, vector } = createMemory();
    await seedThread(memory, 'session-a', 'session-a', 'The deploy target is staging');
    vector.query.mockImplementationOnce(async () => [{ id: 'bare', score: 1 }] as any);
    vector.updateVector.mockClear();

    await memory.updateThreadResourceId({ threadId: 'session-a', resourceId: 'factory-1' });

    expect(vector.updateVector).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'bare' }));
  });
});
