import { embed } from '@mastra/core/ai';
import { fastembed } from '@mastra/fastembed';

import { describe, it, expect } from 'vitest';

export function getFastembedTests() {
  describe('FastEmbed AI SDK v7 Compatibility', () => {
    // V4 specification tests (AI SDK v7)

    describe('v4 specification', () => {
      it('should use v4 specification version', () => {
        expect(fastembed.specificationVersion).toBe('v4');
      });

      it('should work with embed function from AI SDK v7', async () => {
        const result = await embed({
          model: fastembed,
          value: 'test embedding',
        });

        expect(result).toBeDefined();
        expect(result.embedding).toBeDefined();
        expect(Array.isArray(result.embedding)).toBe(true);
        expect(result.embedding.length).toBeGreaterThan(0);
      }, 30000);

      it('should have required v4 model properties', () => {
        expect(fastembed.specificationVersion).toBe('v4');
        expect(fastembed.provider).toBe('fastembed');
        expect(fastembed.modelId).toBeDefined();
        expect(fastembed.maxEmbeddingsPerCall).toBeDefined();
        expect(fastembed.supportsParallelCalls).toBeDefined();
      });

      it('should support doEmbed with v4 signature', async () => {
        const result = await fastembed.doEmbed({
          values: ['hello world', 'test text'],
          abortSignal: undefined,
        });

        expect(result).toBeDefined();
        expect(result.embeddings).toBeDefined();
        expect(Array.isArray(result.embeddings)).toBe(true);
        expect(result.embeddings.length).toBe(2);
        expect(result.embeddings[0]).toBeDefined();
        expect(result.embeddings[0]!.length).toBeGreaterThan(0);
      }, 30000);
    });

    describe('Named exports', () => {
      it('should export small model with v4 specification', () => {
        expect(fastembed.small.specificationVersion).toBe('v4');
        expect(fastembed.small.modelId).toBe('bge-small-en-v1.5');
      });

      it('should export base model with v4 specification', () => {
        expect(fastembed.base.specificationVersion).toBe('v4');
        expect(fastembed.base.modelId).toBe('bge-base-en-v1.5');
      });
    });

    describe('Embedding generation', () => {
      it('should generate embeddings', async () => {
        const result = await fastembed.doEmbed({
          values: ['machine learning', 'artificial intelligence'],
        });

        expect(result.embeddings).toBeDefined();
        expect(result.embeddings.length).toBe(2);

        result.embeddings.forEach(embedding => {
          expect(Array.isArray(embedding)).toBe(true);
          expect(embedding.length).toBeGreaterThan(0);
          expect(typeof embedding[0]).toBe('number');
        });
      }, 30000);

      it('should generate consistent embeddings for same input', async () => {
        const text = 'consistent embedding test';

        const result1 = await fastembed.doEmbed({ values: [text] });
        const result2 = await fastembed.doEmbed({ values: [text] });

        expect(result1.embeddings[0]).toEqual(result2.embeddings[0]);
      }, 30000);

      it('should handle multiple values in single call', async () => {
        const values = ['first text', 'second text', 'third text', 'fourth text', 'fifth text'];

        const result = await fastembed.doEmbed({ values });

        expect(result.embeddings.length).toBe(values.length);

        const uniqueEmbeddings = new Set(result.embeddings.map(emb => JSON.stringify(emb)));
        expect(uniqueEmbeddings.size).toBe(values.length);
      }, 30000);
    });

    describe('Integration with @mastra/core patterns', () => {
      it('should work with embed API from ai v7 (core pattern)', async () => {
        const queryText = 'search query for RAG';

        const result = await embed({
          model: fastembed,
          value: queryText,
        });

        expect(result.embedding).toBeDefined();
        expect(Array.isArray(result.embedding)).toBe(true);
        expect(result.embedding.length).toBeGreaterThan(0);
      }, 30000);

      it('should be compatible with ModelRouterEmbeddingModel pattern', () => {
        expect(fastembed).toHaveProperty('specificationVersion', 'v4');
        expect(fastembed).toHaveProperty('provider', 'fastembed');
        expect(fastembed).toHaveProperty('modelId');
        expect(fastembed).toHaveProperty('maxEmbeddingsPerCall');
        expect(fastembed).toHaveProperty('supportsParallelCalls');
        expect(fastembed).toHaveProperty('doEmbed');
        expect(typeof fastembed.doEmbed).toBe('function');
      });
    });
  });
}
