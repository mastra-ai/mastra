import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, vi } from 'vitest';
import { Memory } from './index';

// Mock embedMany across AI SDK versions so embedMessageContent does no network I/O.
vi.mock('@internal/ai-v6', () => ({
  embedMany: vi.fn(async ({ values }: { values: string[] }) => ({
    values,
    embeddings: values.map(() => [0.1, 0.2]),
    usage: { tokens: 1 },
    warnings: [],
  })),
}));
vi.mock('@internal/ai-sdk-v5', () => ({
  embedMany: vi.fn(async ({ values }: { values: string[] }) => ({
    values,
    embeddings: values.map(() => [0.1, 0.2]),
    usage: { tokens: 1 },
    warnings: [],
  })),
}));
vi.mock('@internal/ai-sdk-v4', () => ({
  embedMany: vi.fn(async ({ values }: { values: string[] }) => ({
    values,
    embeddings: values.map(() => [0.1, 0.2]),
    usage: { tokens: 1 },
    warnings: [],
  })),
}));

function createMemory() {
  return new Memory({
    storage: new InMemoryStore(),
    vector: {
      upsert: vi.fn().mockResolvedValue('id'),
      createIndex: vi.fn().mockResolvedValue({ indexName: 'test-index' }),
      query: vi.fn().mockResolvedValue([]),
      describeIndex: vi.fn(),
    } as any,
    embedder: {
      specificationVersion: 'v3',
      provider: 'test',
      modelId: 'test-model',
      doEmbed: vi.fn().mockResolvedValue({ embeddings: [[0.1, 0.2]], usage: { tokens: 1 }, warnings: [] }),
    } as any,
    options: { semanticRecall: true },
  });
}

describe('observation indexing IDs', () => {
  const observation = {
    text: 'An observation',
    groupId: 'group-1',
    range: 'message-1:message-2',
    threadId: 'thread-1',
    resourceId: 'resource-1',
  };

  it('reuses UUIDs across retries and Memory instances', async () => {
    const first = createMemory();
    const second = createMemory();
    await first.indexObservation(observation);
    await first.indexObservation(observation);
    await second.indexObservation(observation);
    const calls = vi.mocked(first.vector!.upsert).mock.calls;
    const ids = calls[0]![0].ids;
    expect(ids).toHaveLength(1);
    expect(ids![0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(calls[1]![0].ids).toEqual(ids);
    expect(vi.mocked(second.vector!.upsert).mock.calls[0]![0].ids).toEqual(ids);
  });

  it('does not duplicate chunks when a successful write reports a timeout', async () => {
    const memory = createMemory();
    const chunks = ['first', 'second', 'third', 'fourth'];
    vi.spyOn(memory as any, 'embedMessageContent').mockResolvedValue({
      chunks,
      embeddings: chunks.map(() => [0.1, 0.2]),
      usage: { tokens: 1 },
      dimension: 2,
    });
    const rows = new Set<string>();
    let attempts = 0;
    vi.mocked(memory.vector!.upsert).mockImplementation(async ({ ids, vectors }) => {
      const storedIds = vectors.map((_, index) => ids?.[index] ?? crypto.randomUUID());
      storedIds.forEach(id => rows.add(id));
      if (++attempts === 1) throw new Error('Connection terminated due to connection timeout');
      return storedIds;
    });
    await expect(memory.indexObservation(observation)).rejects.toThrow('connection timeout');
    await memory.indexObservation(observation);
    const calls = vi.mocked(memory.vector!.upsert).mock.calls;
    const ids = calls[0]![0].ids!;
    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length);
    expect(calls[1]![0].ids).toEqual(ids);
    expect(rows.size).toBe(ids.length);
  });

  it.each(['groupId', 'threadId', 'resourceId'] as const)('isolates IDs by %s', async key => {
    const memory = createMemory();
    await memory.indexObservation(observation);
    await memory.indexObservation({ ...observation, [key]: 'another-value' });
    const calls = vi.mocked(memory.vector!.upsert).mock.calls;
    expect(calls[0]![0].ids).not.toEqual(calls[1]![0].ids);
  });
});

describe('embedMessageContent caching', () => {
  it('reuses cached embeddings for repeated content (cache hit)', async () => {
    const memory = createMemory() as any;

    const a = await memory.embedMessageContent('hello world');
    const b = await memory.embedMessageContent('hello world');

    // Same content returns the same cached object reference.
    expect(b).toBe(a);
  });

  it('bounds the cache via LRU eviction instead of growing unboundedly', async () => {
    const memory = createMemory() as any;
    const N = 1500;

    for (let i = 0; i < N; i++) {
      await memory.embedMessageContent(`unique-content-${i}`);
    }

    // Without eviction the cache would hold all N entries. The LRU caps it well
    // below N, so a long-running instance can't accumulate every embedded content.
    expect(memory.embeddingCache.size).toBeLessThan(N);
    expect(memory.embeddingCache.size).toBeLessThanOrEqual(1000);
  });

  it('does not return the wrong cached embeddings for h32-colliding content', async () => {
    const memory = createMemory() as any;

    // These two strings collide under the 32-bit xxhash (both -> 2346541822) but
    // are distinct under the 64-bit hash now used for cache keys.
    const A = 'msg-4246';
    const B = 'msg-268273';

    const hasher = await memory.hasher;
    expect(hasher.h32(A)).toBe(hasher.h32(B)); // 32-bit collision (the latent bug)
    expect(hasher.h64(A)).not.toBe(hasher.h64(B)); // 64-bit keys stay distinct

    const resultA = await memory.embedMessageContent(A);
    const resultB = await memory.embedMessageContent(B);

    // Each content gets its own chunks; B must not receive A's cached entry.
    expect(resultA.chunks).toEqual([A]);
    expect(resultB.chunks).toEqual([B]);
    expect(resultB).not.toBe(resultA);
  });
});
