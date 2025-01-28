import dotenv from 'dotenv';
import { describe, expect, it } from 'vitest';

import { embed, embedMany } from './index';

// Load environment variables
dotenv.config();

describe('Embedding Tests', () => {
  describe('createEmbedding', () => {
    it('should create an embedding for a single string value using OpenAI provider', async () => {
      const value = 'This is a test string';
      const maxRetries = 3;

      const embedding = await embed(value, {
        provider: 'OPEN_AI',
        model: 'text-embedding-3-small',
        maxRetries,
      });
      console.log(embedding);

      expect(embedding).toBeDefined();
    });

    it.skip('should create an embedding for a single string value using Cohere provider', async () => {
      const value = 'This is a test string';
      const maxRetries = 3;

      const embedding = await embed(value, {
        provider: 'COHERE',
        model: 'embed-english-v3.0',
        maxRetries,
      });
      console.log(embedding);

      expect(embedding).toBeDefined();
    });

    it('should create embeddings for an array of string values', async () => {
      const value = ['String 1', 'String 2', 'String 3'];
      const maxRetries = 3;

      const embeddings = await embedMany(value, {
        provider: 'OPEN_AI',
        model: 'text-embedding-3-small',
        maxRetries,
      });
      console.log(embeddings);

      expect(embeddings).toBeDefined();
    });

    it('should throw an error for an invalid embedding model provider', async () => {
      const value = 'This is a test string';
      const maxRetries = 3;

      await expect(
        embed(value, { provider: 'INVALID_PROVIDER' as any, model: 'text-embedding-3-small', maxRetries }),
      ).rejects.toThrow('Invalid embedding model');
    });
  });
});
