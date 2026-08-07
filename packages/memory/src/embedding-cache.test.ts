import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, vi } from 'vitest';
import { Memory } from './index';

// Mock embedMany across AI SDK versions so embedMessageContent does no network I/O.
vi.mock('@internal/ai-v6', () => ({
  embedMany: vi.fn().mockResolvedValue({ embeddings: [[0.1, 0.2]], usage: { tokens: 1 } }),
}));
vi.mock('@internal/ai-sdk-v5', () => ({
  embedMany: vi.fn().mockResolvedValue({ embeddings: [[0.1, 0.2]], usage: { tokens: 1 } }),
}));
vi.mock('@internal/ai-sdk-v4', () => ({
  embedMany: vi.fn().mockResolvedValue({ embeddings: [[0.1, 0.2]], usage: { tokens: 1 } }),
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
