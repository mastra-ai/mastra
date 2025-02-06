import dotenv from 'dotenv';
import { describe, expect, it } from 'vitest';

import { embed, embedMany } from './cohere';

// Load environment variables
dotenv.config();

describe('Cohere Embeddings', () => {
  it.skip('should create an embedding for a single string value', async () => {
    const value = 'This is a test string';
    const maxRetries = 3;

    const embedding = await embed(value, {
      model: 'embed-english-v3.0',
      maxRetries,
    });
    console.log(embedding);

    expect(embedding).toBeDefined();
  });

  it.skip('should create embeddings for an array of string values', async () => {
    const values = ['String 1', 'String 2', 'String 3'];
    const maxRetries = 3;

    const embeddings = await embedMany(values, {
      model: 'embed-english-v3.0',
      maxRetries,
    });
    console.log(embeddings);

    expect(embeddings).toBeDefined();
  });
});
