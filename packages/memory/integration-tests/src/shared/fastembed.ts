import type { EmbeddingModelV1 } from '@internal/ai-sdk-v4';
import type { EmbeddingModelV2 } from '@internal/ai-sdk-v5';
import { fastembed } from '@mastra/fastembed';
import { embed as embedV1 } from 'ai';
import { embed as embedV2 } from 'ai-v5';
import { embed as embedV3 } from 'ai-v6';

import { describe, it, expect } from 'vitest';

interface FastembedTestConfig {
  version: 'v1' | 'v2' | 'v3';
}

export function getFastembedTests(config: FastembedTestConfig) {
  const { version } = config;

  describe(`FastEmbed AI SDK ${version} Compatibility`, () => {
    // V3 specification tests (AI SDK v6)

    describe('v3 specification', () => {
      it('should use v3 specification version', () => {
        expect(fastembed.specificationVersion).toBe('v3');
      });

      it('should work with embed function from AI SDK v6', async () => {
        const result = await embedV3({
          model: fastembed,
          value: 'test embedding',
        });

        expect(result).toBeDefined();
        expect(result.embedding).toBeDefined();
        expect(Array.isArray(result.embedding)).toBe(true);
        expect(result.embedding.length).toBeGreaterThan(0);
      }, 30000);

      it('should have required v3 model properties', () => {
        expect(fastembed.specificationVersion).toBe('v3');
        expect(fastembed.provider).toBe('fastembed');
        expect(fastembed.modelId).toBeDefined();
        expect(fastembed.maxEmbeddingsPerCall).toBeDefined();
        expect(fastembed.supportsParallelCalls).toBeDefined();
      });

      it('should support doEmbed with v3 signature', async () => {
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

    // V2 specification tests (AI SDK v5)

    describe('v2 specification', () => {
      it('should use v2 specification version', () => {
        expect(fastembed.smallV2.specificationVersion).toBe('v2');
      });

      it('should be assignable to EmbeddingModelV2 type', () => {
        const model: EmbeddingModelV2<string> = fastembed.smallV2;
        expect(model.specificationVersion).toBe('v2');
        expect(model.provider).toBe('fastembed');
        expect(model.modelId).toBe('bge-small-en-v1.5');
      });

      it('should work with embed function from AI SDK v5', async () => {
        const result = await embedV2({
          model: fastembed.smallV2,
          value: 'test embedding',
        });

        expect(result).toBeDefined();
        expect(result.embedding).toBeDefined();
        expect(Array.isArray(result.embedding)).toBe(true);
        expect(result.embedding.length).toBeGreaterThan(0);
      }, 30000);

      it('should have required v2 model properties', () => {
        expect(fastembed.smallV2.specificationVersion).toBe('v2');
        expect(fastembed.smallV2.provider).toBe('fastembed');
        expect(fastembed.smallV2.modelId).toBeDefined();
        expect(fastembed.smallV2.maxEmbeddingsPerCall).toBeDefined();
        expect(fastembed.smallV2.supportsParallelCalls).toBeDefined();
      });

      it('should support doEmbed with v2 signature', async () => {
        const result = await fastembed.smallV2.doEmbed({
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

    // V1 specification tests (AI SDK v4 legacy)

    describe('v1 specification (legacy)', () => {
      it('should use v1 specification version', () => {
        expect(fastembed.smallLegacy.specificationVersion).toBe('v1');
      });

      it('should be assignable to EmbeddingModelV1 type', () => {
        const model: EmbeddingModelV1<string> = fastembed.smallLegacy;
        expect(model.specificationVersion).toBe('v1');
        expect(model.provider).toBe('fastembed');
        expect(model.modelId).toBe('bge-small-en-v1.5');
      });

      it('should work with embed function from AI SDK v4', async () => {
        const result = await embedV1({
          model: fastembed.smallLegacy,
          value: 'test embedding',
        });

        expect(result).toBeDefined();
        expect(result.embedding).toBeDefined();
        expect(Array.isArray(result.embedding)).toBe(true);
        expect(result.embedding.length).toBeGreaterThan(0);
      }, 30000);

      it('should have required v1 model properties', () => {
        expect(fastembed.smallLegacy.specificationVersion).toBe('v1');
        expect(fastembed.smallLegacy.provider).toBe('fastembed');
        expect(fastembed.smallLegacy.modelId).toBeDefined();
        expect(fastembed.smallLegacy.maxEmbeddingsPerCall).toBeDefined();
        expect(fastembed.smallLegacy.supportsParallelCalls).toBeDefined();
      });

      it('should support doEmbed with v1 signature', async () => {
        const result = await fastembed.smallLegacy.doEmbed({
          values: ['hello world', 'test text'],
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
      it('should export small model with v3 specification', () => {
        expect(fastembed.small.specificationVersion).toBe('v3');
        expect(fastembed.small.modelId).toBe('bge-small-en-v1.5');
      });

      it('should export base model with v3 specification', () => {
        expect(fastembed.base.specificationVersion).toBe('v3');
        expect(fastembed.base.modelId).toBe('bge-base-en-v1.5');
      });

      it('should export small model with v2 specification', () => {
        expect(fastembed.smallV2.specificationVersion).toBe('v2');
        expect(fastembed.smallV2.modelId).toBe('bge-small-en-v1.5');
      });

      it('should export base model with v2 specification', () => {
        expect(fastembed.baseV2.specificationVersion).toBe('v2');
        expect(fastembed.baseV2.modelId).toBe('bge-base-en-v1.5');
      });

      it('should export small model with v1 specification', () => {
        expect(fastembed.smallLegacy.specificationVersion).toBe('v1');
        expect(fastembed.smallLegacy.modelId).toBe('bge-small-en-v1.5');
      });

      it('should export base model with v1 specification', () => {
        expect(fastembed.baseLegacy.specificationVersion).toBe('v1');
        expect(fastembed.baseLegacy.modelId).toBe('bge-base-en-v1.5');
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
      it('should work with embedV3 API from ai-v6 (core pattern)', async () => {
        const queryText = 'search query for RAG';

        const result = await embedV3({
          model: fastembed,
          value: queryText,
        });

        expect(result.embedding).toBeDefined();
        expect(Array.isArray(result.embedding)).toBe(true);
        expect(result.embedding.length).toBeGreaterThan(0);
      }, 30000);

      it('should work with embedV2 API from ai-v5 (core pattern)', async () => {
        const queryText = 'search query for RAG';

        const result = await embedV2({
          model: fastembed.baseV2,
          value: queryText,
        });

        expect(result.embedding).toBeDefined();
        expect(Array.isArray(result.embedding)).toBe(true);
        expect(result.embedding.length).toBeGreaterThan(0);
      }, 30000);

      it('should work with embedV1 API from ai-v4 (core pattern)', async () => {
        const queryText = 'search query for RAG';

        const result = await embedV1({
          model: fastembed.baseLegacy,
          value: queryText,
        });

        expect(result.embedding).toBeDefined();
        expect(Array.isArray(result.embedding)).toBe(true);
        expect(result.embedding.length).toBeGreaterThan(0);
      }, 30000);

      it('should be compatible with ModelRouterEmbeddingModel pattern', () => {
        expect(fastembed).toHaveProperty('specificationVersion', 'v3');
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
