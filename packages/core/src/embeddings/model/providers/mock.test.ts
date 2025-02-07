import { describe, expect, it } from 'vitest';

import { embed, embedMany } from './mock';

describe('Mock Embeddings', () => {
  it('should create an embedding for a single string value', async () => {
    const value = 'This is a test string';
    const maxRetries = 3;

    const embedding = await embed(value, { maxRetries });
    console.log(embedding);

    expect(embedding).toBeDefined();
  });

  it('should create embeddings for an array of string values', async () => {
    const values = ['String 1', 'String 2', 'String 3'];
    const maxRetries = 3;

    const embeddings = await embedMany(values, { maxRetries });
    console.log(embeddings);

    expect(embeddings).toBeDefined();
  });
});
