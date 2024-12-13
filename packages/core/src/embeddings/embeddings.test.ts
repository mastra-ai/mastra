import { describe, expect, it } from '@jest/globals';
import dotenv from 'dotenv';

import { embed } from './index';
import { EmbeddingModelConfig } from './types';

// Load environment variables
dotenv.config();

describe('Embedding Tests', () => {
  describe('createEmbedding', () => {
    it('should create an embedding for a single string value using OpenAI provider', async () => {
      const model: EmbeddingModelConfig = {
        provider: 'OPEN_AI',
        name: 'text-embedding-3-small',
      };
      const value = 'This is a test string';
      const maxRetries = 3;

      const embedding = await embed({
        model,
        value,
        maxRetries,
      });
      console.log(embedding);

      expect(embedding).toBeDefined();
    });

    it.skip('should create an embedding for a single string value using Cohere provider', async () => {
      const model: EmbeddingModelConfig = {
        provider: 'COHERE',
        name: 'embed-english-v3.0',
      };
      const value = 'This is a test string';
      const maxRetries = 3;

      const embedding = await embed({
        model,
        value,
        maxRetries,
      });
      console.log(embedding);

      expect(embedding).toBeDefined();
    });

    it('should create embeddings for an array of string values', async () => {
      const model: EmbeddingModelConfig = {
        provider: 'OPEN_AI',
        name: 'text-embedding-3-small',
      };
      const value = ['String 1', 'String 2', 'String 3'];
      const maxRetries = 3;

      const embeddings = await embed({
        model,
        value,
        maxRetries,
      });
      console.log(embeddings);

      expect(embeddings).toBeDefined();
    });

    it('should throw an error for an invalid embedding model provider', async () => {
      const model: EmbeddingModelConfig = {
        provider: 'INVALID_PROVIDER' as any,
        name: 'text-embedding-ada-002',
      };
      const value = 'This is a test string';
      const maxRetries = 3;

      await expect(embed({ model, value, maxRetries })).rejects.toThrow('Invalid embedding model');
    });
  });
});
