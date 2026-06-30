import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, vi } from 'vitest';
import { Memory } from './index';

// Mock embedMany across AI SDK versions so constructing Memory does no network I/O.
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

const CHARS_PER_TOKEN = 4;

describe('Memory.chunkText', () => {
  it('splits normal prose on whitespace into chunks under the budget', () => {
    const memory = createMemory() as any;
    const tokenSize = 8;
    const charSize = tokenSize * CHARS_PER_TOKEN; // 32

    const text = 'the quick brown fox jumps over the lazy dog again and again';
    const chunks: string[] = memory.chunkText(text, tokenSize);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(charSize);
      expect(chunk).not.toBe('');
    }
    // No content is lost: re-joining the words round-trips the original text.
    expect(chunks.join(' ').split(/\s+/)).toEqual(text.split(/\s+/));
  });

  it('hard-splits a single unbroken word longer than the budget (base64/minified blob)', () => {
    const memory = createMemory() as any;
    const tokenSize = 4096;
    const charSize = tokenSize * CHARS_PER_TOKEN; // 16384

    // A single ~100k-char whitespace-free string, e.g. a base64 data URI.
    const blob = 'A'.repeat(100_000);
    const chunks: string[] = memory.chunkText(blob, tokenSize);

    expect(chunks.length).toBe(Math.ceil(blob.length / charSize));
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(charSize);
      expect(chunk).not.toBe('');
    }
    // Every character is preserved, in order.
    expect(chunks.join('')).toBe(blob);
  });

  it('never emits an empty leading chunk when the first word is oversized', () => {
    const memory = createMemory() as any;
    const tokenSize = 4;
    const charSize = tokenSize * CHARS_PER_TOKEN; // 16

    // First "word" exceeds the budget, then normal words follow.
    const text = `${'x'.repeat(50)} hello world`;
    const chunks: string[] = memory.chunkText(text, tokenSize);

    expect(chunks).not.toContain('');
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(charSize);
    }
  });

  it('splits spaceless CJK text (the whole message is one "word")', () => {
    const memory = createMemory() as any;
    const tokenSize = 4096;
    const charSize = tokenSize * CHARS_PER_TOKEN; // 16384

    // ~20k chars of spaceless CJK: no whitespace to split on at all.
    const cjk = '安'.repeat(20_000);
    const chunks: string[] = memory.chunkText(cjk, tokenSize);

    expect(chunks.length).toBe(Math.ceil(cjk.length / charSize));
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(charSize);
      expect(chunk).not.toBe('');
    }
    expect(chunks.join('')).toBe(cjk);
  });

  it('flushes accumulated words before hard-splitting an oversized word', () => {
    const memory = createMemory() as any;
    const tokenSize = 4;
    const charSize = tokenSize * CHARS_PER_TOKEN; // 16

    const text = `short words then ${'z'.repeat(40)} more`;
    const chunks: string[] = memory.chunkText(text, tokenSize);

    expect(chunks).not.toContain('');
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(charSize);
    }
    // The leading short words survive as their own chunk(s) before the blob.
    expect(chunks[0]).toContain('short');
  });
});
