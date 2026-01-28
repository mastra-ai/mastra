import { describe, it, expect, beforeAll } from 'vitest';
import { ModelRouterEmbeddingModel } from './embedding-router.js';

/**
 * Google Gemini embedding integration tests.
 *
 * These tests are isolated from the main test suite because they
 * tend to be flaky due to API rate limits, model availability issues,
 * and other transient failures from the Google Generative AI API.
 *
 * Run these tests separately with: pnpm test:gemini
 */
describe('ModelRouterEmbeddingModel - Google Gemini Integration', () => {
  beforeAll(() => {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is required for Google embedding integration tests');
    }
  });

  describe('Google embedding (with real API)', () => {
    it('should successfully embed text using Google', async () => {
      if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is required for this test');
      }

      const model = new ModelRouterEmbeddingModel('google/text-embedding-004');
      const result = await model.doEmbed({ values: ['hello world'] });

      expect(result.embeddings).toBeDefined();
      expect(result.embeddings.length).toBe(1);
      expect(result.embeddings[0].length).toBeGreaterThan(0);
    });

    it('should work with different Google models', async () => {
      if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is required for this test');
      }

      const model = new ModelRouterEmbeddingModel('google/gemini-embedding-001');
      const result = await model.doEmbed({ values: ['test'] });

      expect(result.embeddings).toBeDefined();
      expect(result.embeddings.length).toBe(1);
    });
  });
});
