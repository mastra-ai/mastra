import dotenv from 'dotenv';
import { beforeEach, describe, expect, it } from 'vitest';

import { MistralEmbedder } from './mistral';

// Load environment variables
dotenv.config();

describe('Mistral Embeddings', () => {
  let embedder: MistralEmbedder;

  beforeEach(() => {
    embedder = new MistralEmbedder({
      model: 'mistral-embed',
    });
  });
  it.skip('should create an embedding for a single string value', async () => {
    const value = 'This is a test string';
    const maxRetries = 3;

    const embedding = await embedder.embed(value, { maxRetries });
    console.log(embedding);

    expect(embedding).toBeDefined();
  });

  it.skip('should create embeddings for an array of string values', async () => {
    const values = ['String 1', 'String 2', 'String 3'];
    const maxRetries = 3;

    const embeddings = await embedder.embedMany(values, { maxRetries });
    console.log(embeddings);

    expect(embeddings).toBeDefined();
  });
});
