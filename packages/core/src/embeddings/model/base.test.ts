import { describe, expect, test } from 'vitest';

import { MockEmbeddingProvider } from './providers/mock';

describe('MastraEmbedding', () => {
  test('should create embedding for single text', async () => {
    const model = new MockEmbeddingProvider();
    const text = 'Hello, world!';

    const { embedding } = await model.embed(text);

    expect(embedding).toBeDefined();
    expect(embedding.length).toBeGreaterThan(0);
    expect(typeof embedding[0]).toBe('number');
  });

  test('should create embeddings for multiple texts', async () => {
    const model = new MockEmbeddingProvider();
    const texts = ['Hello, world!', 'Another text', 'Third text'];

    const { embeddings } = await model.embedMany(texts);

    expect(embeddings).toBeDefined();
    expect(embeddings.length).toBe(texts.length);
    embeddings.forEach(embedding => {
      expect(embedding.length).toBeGreaterThan(0);
      expect(typeof embedding[0]).toBe('number');
    });
  });

  test('should handle empty text for single embedding', async () => {
    const model = new MockEmbeddingProvider();
    const text = '';

    const { embedding } = await model.embed(text);

    expect(embedding).toBeDefined();
    expect(embedding.length).toBeGreaterThan(0);
  });

  test('should handle empty array for multiple embeddings', async () => {
    const model = new MockEmbeddingProvider();
    const texts: string[] = [];

    const { embeddings } = await model.embedMany(texts);

    expect(embeddings).toBeDefined();
    expect(embeddings).toEqual([]);
  });

  test('should handle maxRetries parameter for single embedding', async () => {
    const model = new MockEmbeddingProvider();
    const text = 'Test text';

    const { embedding } = await model.embed(text, { maxRetries: 5 });

    expect(embedding).toBeDefined();
    expect(embedding.length).toBeGreaterThan(0);
  });

  test('should handle maxRetries parameter for multiple embeddings', async () => {
    const model = new MockEmbeddingProvider();
    const texts = ['Text 1', 'Text 2'];

    const { embeddings } = await model.embedMany(texts, { maxRetries: 5 });

    expect(embeddings).toBeDefined();
    expect(embeddings.length).toBe(texts.length);
  });
});
