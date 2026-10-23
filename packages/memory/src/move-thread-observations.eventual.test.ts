import { InMemoryStore } from '@mastra/core/storage';
import type { QueryResult } from '@mastra/core/vector';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LibSQLVector } from '../../../stores/libsql/src/vector';
import { Memory } from './index';

/** Real in-memory database, with only the query visibility boundary delayed (#27834). */
class EventuallyConsistentVector extends LibSQLVector {
  staleReads = 0;
  private readonly pages = new Map<string, { results: QueryResult[]; readsLeft: number }>();

  constructor(public visibilityDelay: number) {
    super({ id: 'eventual-observations', url: ':memory:' });
  }

  catchUp() {
    this.visibilityDelay = 0;
    this.pages.clear();
  }

  override async query(params: Parameters<LibSQLVector['query']>[0]) {
    if (!params.includeVector) return super.query(params);
    if (params.topK && params.topK > 20) throw new Error('Vectorize permits at most 20 results with values');
    const page = this.pages.get(params.indexName);
    if (page && page.readsLeft > 0) {
      page.readsLeft--;
      this.staleReads++;
      return structuredClone(page.results);
    }
    const results = await super.query(params);
    this.pages.set(params.indexName, { results: structuredClone(results), readsLeft: this.visibilityDelay });
    return results;
  }
}

const vectors: LibSQLVector[] = [];
afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(vectors.splice(0).map(vector => vector.close()));
});

async function createFixture(visibilityDelay: number) {
  const vector = new EventuallyConsistentVector(visibilityDelay);
  vectors.push(vector);
  const memory = new Memory({
    storage: new InMemoryStore(),
    vector,
    embedder: {
      specificationVersion: 'v3',
      provider: 'test',
      modelId: 'test-embedding',
      doEmbed: async ({ values }) => ({ embeddings: values.map(() => [1, 0]), warnings: [] }),
    },
    options: { generateTitle: false },
  });
  for (const threadId of ['moving', 'unrelated']) {
    await memory.saveThread({
      thread: { id: threadId, resourceId: 'old', createdAt: new Date(), updatedAt: new Date() },
    });
    for (let i = 0; i < (threadId === 'moving' ? 45 : 1); i++) {
      await memory.indexObservation({
        text: `Observation ${threadId} ${i}`,
        groupId: `${threadId}-${i}`,
        threadId,
        resourceId: 'old',
        recordId: `${threadId}-record`,
        range: `msg-${i}:msg-${i}`,
      });
    }
  }
  return { memory, vector };
}

// Auto-advance only the retry clock; database operations still run against real LibSQL.
async function transfer(memory: Memory) {
  vi.useFakeTimers();
  const result = memory.updateThreadResourceId({ threadId: 'moving', resourceId: 'new' });
  let settled = false;
  // Attach both handlers immediately so an expected rejection never goes unhandled.
  void result.then(() => (settled = true), () => (settled = true));
  await vi.waitFor(() => expect(settled).toBe(true), { timeout: 300_000, interval: 1000 });
  return result;
}

async function readObservations(vector: LibSQLVector, resourceId: string) {
  const [indexName] = await vector.listIndexes();
  if (!indexName) throw new Error('Missing seeded observation index');
  return vector.query({ indexName, queryVector: [1, 0], topK: 100, filter: { resource_id: resourceId } });
}

describe('observation transfer on eventually consistent vector stores (#27834)', () => {
  it('moves every page after repeated stale reads and preserves observation contents', async () => {
    const { memory, vector } = await createFixture(3);
    const before = await readObservations(vector, 'old');

    await transfer(memory);

    expect(vector.staleReads).toBeGreaterThan(0);
    expect(await readObservations(vector, 'new')).toEqual(
      before
        .filter(result => result.metadata?.thread_id === 'moving')
        .map(result => ({ ...result, metadata: { ...result.metadata, resource_id: 'new' } })),
    );
    expect(await readObservations(vector, 'old')).toEqual(
      before.filter(result => result.metadata?.thread_id === 'unrelated'),
    );
    expect((await memory.getThreadById({ threadId: 'moving' }))?.resourceId).toBe('new');
  });

  it('reports incomplete migration after bounded retries and repairs it on a same-resource retry', async () => {
    const { memory, vector } = await createFixture(Infinity);

    await expect(transfer(memory)).rejects.toThrow(/observation vectors failed.*retried/);

    expect(vector.staleReads).toBeGreaterThan(1);
    expect(vector.staleReads).toBeLessThan(100);
    expect((await readObservations(vector, 'old')).some(result => result.metadata?.thread_id === 'moving')).toBe(true);
    expect((await memory.getThreadById({ threadId: 'moving' }))?.resourceId).toBe('new');

    // Let the provider's index catch up, then retry the already-committed storage move.
    vector.catchUp();
    await transfer(memory);
    expect(await readObservations(vector, 'new')).toHaveLength(45);
    expect(await readObservations(vector, 'old')).toEqual([
      expect.objectContaining({ metadata: expect.objectContaining({ thread_id: 'unrelated' }) }),
    ]);
  });
});
