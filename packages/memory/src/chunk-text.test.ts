import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, beforeEach } from 'vitest';

import { Memory } from './index';

class TestableMemory extends Memory {
  public testChunkText(text: string, tokenSize?: number): string[] {
    return this.chunkText(text, tokenSize);
  }
}

describe('Memory.chunkText', () => {
  let memory: TestableMemory;

  beforeEach(() => {
    memory = new TestableMemory({ storage: new InMemoryStore() });
  });

  it('keeps every chunk within the character budget for unbroken content', () => {
    const tokenSize = 10;
    const charSize = tokenSize * 4;
    const text = 'a'.repeat(charSize * 3 + 7);

    const chunks = memory.testChunkText(text, tokenSize);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe(text);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(charSize);
    }
  });

  it('never emits an empty chunk when the first word is oversized', () => {
    const tokenSize = 10;
    const text = 'x'.repeat(tokenSize * 4 + 5);

    const chunks = memory.testChunkText(text, tokenSize);

    expect(chunks).not.toContain('');
    expect(chunks[0]).not.toBe('');
  });

  it('splits spaceless content that has no whitespace to break on', () => {
    const tokenSize = 5;
    const charSize = tokenSize * 4;
    const text = '世'.repeat(charSize * 2);

    const chunks = memory.testChunkText(text, tokenSize);

    expect(chunks.length).toBe(2);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(charSize);
    }
  });

  it('still packs normal whitespace-separated text into few chunks', () => {
    const chunks = memory.testChunkText('the quick brown fox jumps', 4096);

    expect(chunks).toEqual(['the quick brown fox jumps']);
  });

  it('flushes the current chunk before an oversized word and keeps the remainder', () => {
    const tokenSize = 10;
    const charSize = tokenSize * 4;
    const text = `short ${'y'.repeat(charSize + 3)} tail`;

    const chunks = memory.testChunkText(text, tokenSize);

    expect(chunks).not.toContain('');
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(charSize);
    }
    expect(chunks[0]).toBe('short');
    expect(chunks.join('').includes('y'.repeat(charSize))).toBe(true);
  });
});
