import { InMemoryStore } from '@mastra/core/storage';
import type { QueryResult } from '@mastra/core/vector';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LibSQLVector } from '../../../stores/libsql/src/vector';
import { Memory } from './index';

/** Real in-memory database, with only the query visibility boundary delayed (#27834). */
class EventuallyConsistentVector extends LibSQLVector {
  staleReads = 0;
  /** Simulated provider latency, served by the (fake) timer clock. */
  queryDelayMs = 0;
  updateDelayMs = 0;
  /** Clock reading when each migration attempt issued its first read, and when each write started. */
  migrationStartedAt: number | undefined;
  updateStartedAt: number[] = [];
  private readonly pages = new Map<string, { results: QueryResult[]; readsLeft: number }>();

  constructor(public visibilityDelay: number) {
    super({ id: 'eventual-observations', url: ':memory:' });
  }

  catchUp() {
    this.visibilityDelay = 0;
    this.pages.clear();
  }

  override async query(params: Parameters<LibSQLVector['query']>[0]) {
    // Only migration reads lag; ordinary reads inspect the committed database state.
    const filter = params.filter;
    if (
      !params.includeVector ||
      !filter ||
      typeof filter !== 'object' ||
      !('resource_id' in filter) ||
      typeof filter.resource_id !== 'object'
    ) {
      return super.query(params);
    }
    if (params.topK && params.topK > 20) throw new Error('Vectorize permits at most 20 results with values');
    this.migrationStartedAt ??= Date.now();
    if (this.queryDelayMs > 0) await new Promise(resolve => setTimeout(resolve, this.queryDelayMs));
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

  override async updateVector(params: Parameters<LibSQLVector['updateVector']>[0]) {
    this.updateStartedAt.push(Date.now());
    if (this.updateDelayMs > 0) await new Promise(resolve => setTimeout(resolve, this.updateDelayMs));
    return super.updateVector(params);
  }

  resetAttempt() {
    this.migrationStartedAt = undefined;
    this.updateStartedAt = [];
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
      maxEmbeddingsPerCall: 100,
      supportsParallelCalls: true,
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
  void result.then(
    () => (settled = true),
    () => (settled = true),
  );
  await vi.waitFor(
    async () => {
      await vi.runOnlyPendingTimersAsync();
      expect(settled).toBe(true);
    },
    { timeout: 10_000, interval: 1 },
  );
  return result;
}

async function readObservations(vector: LibSQLVector, resourceId: string) {
  const [indexName] = await vector.listIndexes();
  if (!indexName) throw new Error('Missing seeded observation index');
  return vector.query({
    indexName,
    queryVector: [1, 0],
    topK: 100,
    includeVector: true,
    filter: { resource_id: resourceId },
  });
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

  // Technical: the 120-second budget was only checked before each read, so a slow read or a page of
  // slow writes kept starting updateVector calls after it expired.
  it.each([
    { provider: 'writes take 10 seconds each', queryDelayMs: 0, updateDelayMs: 10_000, movedBeforeDeadline: 12 },
    {
      provider: 'the first read returns after the deadline',
      queryDelayMs: 130_000,
      updateDelayMs: 0,
      movedBeforeDeadline: 0,
    },
  ])(
    'stops writing when the transfer budget runs out because $provider, keeps finished moves, and a retry finishes',
    async ({ queryDelayMs, updateDelayMs, movedBeforeDeadline }) => {
      const { memory, vector } = await createFixture(0);
      vector.queryDelayMs = queryDelayMs;
      vector.updateDelayMs = updateDelayMs;

      await expect(transfer(memory)).rejects.toThrow(/observation vectors failed.*did not complete within 120 seconds/);

      if (vector.migrationStartedAt === undefined) throw new Error('Transfer never read the observation index');
      const deadline = vector.migrationStartedAt + 120_000;
      expect(vector.updateStartedAt).toHaveLength(movedBeforeDeadline);
      expect(vector.updateStartedAt.every(startedAt => startedAt < deadline)).toBe(true);
      const movedFirst = await readObservations(vector, 'new');
      expect(movedFirst).toHaveLength(movedBeforeDeadline);
      expect((await readObservations(vector, 'old')).filter(r => r.metadata?.thread_id === 'moving')).toHaveLength(
        45 - movedBeforeDeadline,
      );

      // The provider recovers; retrying the same transfer moves only what is left.
      vector.queryDelayMs = 0;
      vector.updateDelayMs = 0;
      vector.resetAttempt();
      await transfer(memory);
      expect(vector.updateStartedAt).toHaveLength(45 - movedBeforeDeadline);
      expect(await readObservations(vector, 'new')).toHaveLength(45);
      expect(await readObservations(vector, 'new')).toEqual(expect.arrayContaining(movedFirst));
      expect(await readObservations(vector, 'old')).toEqual([
        expect.objectContaining({ metadata: expect.objectContaining({ thread_id: 'unrelated' }) }),
      ]);
    },
  );
});
