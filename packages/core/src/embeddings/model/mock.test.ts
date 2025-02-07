import { beforeEach, describe, expect, test } from 'vitest';

import { MockEmbedder } from './providers/mock';

describe('MastraEmbedding', () => {
  let embedder: MockEmbedder;

  beforeEach(() => {
    embedder = new MockEmbedder();
  });
  test('should create embedding for single text', async () => {
    const text = 'Hello, world!';

    const { embedding } = await embedder.embed(text);

    expect(embedding).toBeDefined();
    expect(embedding.length).toBeGreaterThan(0);
    expect(typeof embedding[0]).toBe('number');
  });

  test('should create embeddings for multiple texts', async () => {
    const texts = ['Hello, world!', 'Another text', 'Third text'];

    const { embeddings } = await embedder.embedMany(texts);

    expect(embeddings).toBeDefined();
    expect(embeddings.length).toBe(texts.length);
    embeddings.forEach(embedding => {
      expect(embedding.length).toBeGreaterThan(0);
      expect(typeof embedding[0]).toBe('number');
    });
  });

  test('should handle empty text for single embedding', async () => {
    const text = '';

    const { embedding } = await embedder.embed(text);

    expect(embedding).toBeDefined();
    expect(embedding.length).toBeGreaterThan(0);
  });

  test('should handle empty array for multiple embeddings', async () => {
    const texts: string[] = [];

    const { embeddings } = await embedder.embedMany(texts);

    expect(embeddings).toBeDefined();
    expect(embeddings).toEqual([]);
  });

  test('should handle maxRetries parameter for single embedding', async () => {
    const text = 'Test text';

    const { embedding } = await embedder.embed(text, { maxRetries: 5 });

    expect(embedding).toBeDefined();
    expect(embedding.length).toBeGreaterThan(0);
  });

  test('should handle maxRetries parameter for multiple embeddings', async () => {
    const texts = ['Text 1', 'Text 2'];

    const { embeddings } = await embedder.embedMany(texts, { maxRetries: 5 });

    expect(embeddings).toBeDefined();
    expect(embeddings.length).toBe(texts.length);
  });
});
