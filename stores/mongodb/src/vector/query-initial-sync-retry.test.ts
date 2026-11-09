import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoDBVector } from './';

/**
 * While a new vector search index is first built, Atlas answers `$vectorSearch` with an empty
 * result, except for a short window in which it fails with an INITIAL_SYNC error instead. The
 * errors below carry the text Atlas returned for both an autoEmbed index and a regular one.
 */
const initialSyncError = () =>
  Object.assign(
    new Error(
      'PlanExecutor error during aggregation :: caused by :: cannot query vector index 6abba9dfc588de94267fd1ff (vector index idx_vector_index collection idx (8df6a5a9-4532-4dcf-ae07-7874559e3be4) in database test_db) while in state INITIAL_SYNC',
    ),
    { code: 8, codeName: 'UnknownError' },
  );

const rateLimitError = () =>
  Object.assign(
    new Error(
      'PlanExecutor error during aggregation :: caused by :: Embedding provider rate limit exceeded, retry later',
    ),
    { code: 8, codeName: 'UnknownError' },
  );

function stubVector(toArray: () => Promise<unknown[]>) {
  const vector = new MongoDBVector({ id: 'test', uri: 'mongodb://localhost:27017', dbName: 'test_db' });
  const aggregate = vi.fn(() => ({ toArray }));
  (vector as any).resolveIndexTarget = vi.fn().mockResolvedValue({
    collectionName: 'idx',
    searchIndexName: 'idx_vector_index',
    isByo: false,
    allowWrites: true,
    registered: true,
  });
  (vector as any).getCollection = vi.fn().mockResolvedValue({ aggregate });
  return { vector, aggregate };
}

async function runQuery(vector: MongoDBVector) {
  const pending = vector.query({ indexName: 'idx', queryVector: [0.1, 0.2, 0.3], topK: 1 });
  // Keep the rejection handled while fake timers drive the retries.
  pending.catch(() => {});
  await vi.runAllTimersAsync();
  return pending;
}

describe('query while an index is in INITIAL_SYNC', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries across the INITIAL_SYNC window and returns the results', async () => {
    const toArray = vi
      .fn<() => Promise<unknown[]>>()
      .mockRejectedValueOnce(initialSyncError())
      .mockRejectedValueOnce(initialSyncError())
      .mockResolvedValueOnce([{ _id: 'a', score: 0.9, metadata: {} }]);
    const { vector, aggregate } = stubVector(toArray);

    const results = await runQuery(vector);

    expect(aggregate).toHaveBeenCalledTimes(3);
    expect(results.map(r => r.id)).toEqual(['a']);
  });

  it('does not retry an error unrelated to the index state', async () => {
    const toArray = vi.fn<() => Promise<unknown[]>>().mockRejectedValue(rateLimitError());
    const { vector, aggregate } = stubVector(toArray);

    await expect(runQuery(vector)).rejects.toThrow();
    expect(aggregate).toHaveBeenCalledTimes(1);
  });

  it('gives up once the retry budget is spent', async () => {
    const toArray = vi.fn<() => Promise<unknown[]>>().mockRejectedValue(initialSyncError());
    const { vector, aggregate } = stubVector(toArray);

    await expect(runQuery(vector)).rejects.toThrow();
    const attempts = aggregate.mock.calls.length;
    expect(attempts).toBeGreaterThan(1);
    expect(attempts).toBeLessThanOrEqual(10);
  });
});
