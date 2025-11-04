import type { EmbeddingModelV2 } from '@ai-sdk/provider';
import { fastembed } from '@mastra/fastembed';
import { embed as embedV2 } from 'ai';
import { describe, it, expect } from 'vitest';

describe('FastEmbed AI SDK v2 Compatibility', () => {
  describe('v2 specification', () => {
    it('should use v2 specification version', () => {
      expect(fastembed.specificationVersion).toBe('v2');
    });

    it('should be assignable to EmbeddingModelV2 type', () => {
      const model: EmbeddingModelV2<string> = fastembed;
      expect(model.specificationVersion).toBe('v2');
      expect(model.provider).toBe('fastembed');
      expect(model.modelId).toBe('bge-small-en-v1.5');
    });

    it('should work with embed function from AI SDK v5', async () => {
      const result = await embedV2({
        model: fastembed,
        value: 'test embedding',
      });

      expect(result).toBeDefined();
      expect(result.embedding).toBeDefined();
      expect(Array.isArray(result.embedding)).toBe(true);
      expect(result.embedding.length).toBeGreaterThan(0);
    }, 30000);

    it('should have required v2 model properties', () => {
      expect(fastembed.specificationVersion).toBe('v2');
      expect(fastembed.provider).toBe('fastembed');
      expect(fastembed.modelId).toBeDefined();
      expect(fastembed.maxEmbeddingsPerCall).toBeDefined();
      expect(fastembed.supportsParallelCalls).toBeDefined();
    });

    it('should support doEmbed with v2 signature', async () => {
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
    it('should export small model with v2 specification', () => {
      expect(fastembed.small.specificationVersion).toBe('v2');
      expect(fastembed.small.modelId).toBe('bge-small-en-v1.5');
    });

    it('should export base model with v2 specification', () => {
      expect(fastembed.base.specificationVersion).toBe('v2');
      expect(fastembed.base.modelId).toBe('bge-base-en-v1.5');
    });
  });

  describe('Legacy v1 models', () => {
    it('should export smallLegacy model with v1 specification', () => {
      expect(fastembed.smallLegacy.specificationVersion).toBe('v1');
      expect(fastembed.smallLegacy.modelId).toBe('bge-small-en-v1.5');
    });

    it('should export baseLegacy model with v1 specification', () => {
      expect(fastembed.baseLegacy.specificationVersion).toBe('v1');
      expect(fastembed.baseLegacy.modelId).toBe('bge-base-en-v1.5');
    });

    it('should not be assignable to EmbeddingModelV2 type', () => {
      // @ts-expect-error - legacy models are v1, cannot assign to v2 type
      const _model: EmbeddingModelV2<string> = fastembed.smallLegacy;
    });

    it('should fail when used with AI SDK v5 embed function', async () => {
      try {
        await embedV2({
          model: fastembed.smallLegacy as any,
          value: 'test embedding',
        });
        expect.fail('Expected embedV2 to reject v1 model specification');
      } catch (error) {
        expect(error).toBeDefined();
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(errorMessage.toLowerCase()).toMatch(/unsupported.*model.*version/i);
      }
    }, 30000);
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
    it('should work with embedV2 API from ai-v5 (core pattern)', async () => {
      const queryText = 'search query for RAG';

      const result = await embedV2({
        model: fastembed,
        value: queryText,
      });

      expect(result.embedding).toBeDefined();
      expect(Array.isArray(result.embedding)).toBe(true);
      expect(result.embedding.length).toBeGreaterThan(0);
    }, 30000);

    it('should be compatible with ModelRouterEmbeddingModel pattern', () => {
      expect(fastembed).toHaveProperty('specificationVersion', 'v2');
      expect(fastembed).toHaveProperty('provider', 'fastembed');
      expect(fastembed).toHaveProperty('modelId');
      expect(fastembed).toHaveProperty('maxEmbeddingsPerCall');
      expect(fastembed).toHaveProperty('supportsParallelCalls');
      expect(fastembed).toHaveProperty('doEmbed');
      expect(typeof fastembed.doEmbed).toBe('function');
    });
  });
});
