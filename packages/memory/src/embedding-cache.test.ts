import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, vi } from 'vitest';
import { Memory } from './index';

const mocks = vi.hoisted(() => {
  const embedManyImpl = vi.fn(async ({ values }: { values: string[] }) => ({
    embeddings: values.map(v => [v.length, v.charCodeAt(0) || 0]),
    usage: { tokens: 1 },
  }));
  return { embedManyImpl };
});

vi.mock('@internal/ai-v6', () => ({ embedMany: mocks.embedManyImpl }));
vi.mock('@internal/ai-sdk-v5', () => ({ embedMany: mocks.embedManyImpl }));
vi.mock('@internal/ai-sdk-v4', () => ({ embedMany: mocks.embedManyImpl }));

class TestableMemory extends Memory {
  testEmbedMessageContent(content: string) {
    return (this as any).embedMessageContent(content) as Promise<{
      chunks: string[];
      embeddings: number[][];
    }>;
  }
  cacheSize() {
    return ((this as any).embeddingCache as { size: number }).size;
  }
  cacheMax() {
    return ((this as any).embeddingCache as { max: number }).max;
  }
}

function makeMemory() {
  return new TestableMemory({
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
      doEmbed: vi.fn(),
    } as any,
    options: { semanticRecall: true },
  });
}

describe('Memory.embedMessageContent cache (#17900)', () => {
  it("does not return another message's embeddings for h32-colliding contents", async () => {
    // These two strings collide under xxhash32 (2346541822);
    // h64ToString must keep them in distinct cache slots.
    const memory = makeMemory();
    const first = await memory.testEmbedMessageContent('msg-4246');
    const second = await memory.testEmbedMessageContent('msg-268273');

    expect(first.chunks).toEqual(['msg-4246']);
    expect(second.chunks).toEqual(['msg-268273']);
    expect(second.embeddings).not.toEqual(first.embeddings);
  });

  it('is bounded so a long-running process cannot retain every embedded message', async () => {
    const memory = makeMemory();
    const max = memory.cacheMax();
    expect(typeof max).toBe('number');
    expect(max).toBeGreaterThan(0);

    for (let i = 0; i < max + 10; i++) {
      await memory.testEmbedMessageContent(`unique-content-${i}`);
    }

    expect(memory.cacheSize()).toBeLessThanOrEqual(max);
  });
});
