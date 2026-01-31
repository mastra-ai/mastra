import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';
import { ModelRouterEmbeddingModel } from './embedding-router.js';

// Mock the @ai-sdk/openai-compatible-v5 module for custom URL tests
vi.mock('@ai-sdk/openai-compatible-v5', async () => {
  const actual = await vi.importActual('@ai-sdk/openai-compatible-v5');
  return {
    ...actual,
    createOpenAICompatible: vi.fn(),
  };
});

const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible-v5');

describe('ModelRouterEmbeddingModel Integration', () => {
  beforeAll(() => {
    if (!process.env.OPENAI_API_KEY || !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      throw new Error('OPENAI_API_KEY and GOOGLE_GENERATIVE_AI_API_KEY are required for integration tests');
    }
  });

  describe('constructor', () => {
    it('should parse provider/model string correctly', () => {
      const model = new ModelRouterEmbeddingModel('openai/text-embedding-3-small');
      expect(model.provider).toBe('openai');
      expect(model.modelId).toBe('text-embedding-3-small');
    });

    it('should throw error for invalid model string format', () => {
      expect(() => new ModelRouterEmbeddingModel('invalid-format')).toThrow(
        'Invalid model string format: "invalid-format". Expected format: "provider/model"',
      );
    });

    it('should throw error for empty model string', () => {
      expect(() => new ModelRouterEmbeddingModel('')).toThrow('Invalid model string format');
    });

    it('should throw error for unknown provider', () => {
      expect(() => new ModelRouterEmbeddingModel('unknown-provider/some-model')).toThrow(
        'Unknown provider: unknown-provider',
      );
    });
  });

  describe('properties', () => {
    it('should have expected properties', () => {
      const model = new ModelRouterEmbeddingModel('openai/text-embedding-3-small');
      expect(model.specificationVersion).toBe('v2');
      expect(model.provider).toBe('openai');
      expect(model.modelId).toBe('text-embedding-3-small');
      expect(typeof model.maxEmbeddingsPerCall).toBe('number');
      expect(typeof model.supportsParallelCalls).toBe('boolean');
    });
  });

  describe('OpenAI embedding (with real API)', () => {
    it('should successfully embed text using OpenAI', async () => {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is required for this test');
      }

      const model = new ModelRouterEmbeddingModel('openai/text-embedding-3-small');
      const result = await model.doEmbed({ values: ['hello world'] });

      expect(result.embeddings).toBeDefined();
      expect(result.embeddings.length).toBe(1);
      expect(result.embeddings[0].length).toBeGreaterThan(0);
    });

    it('should work with different OpenAI models', async () => {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is required for this test');
      }

      const model = new ModelRouterEmbeddingModel('openai/text-embedding-ada-002');
      const result = await model.doEmbed({ values: ['test'] });

      expect(result.embeddings).toBeDefined();
      expect(result.embeddings.length).toBe(1);
    });

    it('should handle unknown model IDs for known providers', async () => {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is required for this test');
      }

      // This should not throw during construction, only during embedding
      const model = new ModelRouterEmbeddingModel('openai/text-embedding-future-model');
      expect(model.provider).toBe('openai');
      expect(model.modelId).toBe('text-embedding-future-model');
    });
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

  describe('Custom URL Support', () => {
    beforeEach(() => {
      // Setup mock implementation to return a mock embedding model
      vi.mocked(createOpenAICompatible).mockReturnValue({
        textEmbeddingModel: vi.fn((_modelId: string) => {
          // Return a mock EmbeddingModelV2 instance
          return {
            specificationVersion: 'v2',
            modelId: _modelId,
            maxEmbeddingsPerCall: 2048,
            supportsParallelCalls: true,
            doEmbed: vi.fn(async ({ values }: { values: string[] }) => {
              // Return mock embeddings (768 dimensions)
              return {
                embeddings: values.map(() => new Array(768).fill(0.1)),
              };
            }),
          };
        }),
      } as any);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should allow custom provider with custom URL', async () => {
      const model = new ModelRouterEmbeddingModel({
        providerId: 'my-custom-provider',
        modelId: 'my-embedding-model',
        url: 'http://localhost:8080/v1',
        apiKey: 'test-key',
      });

      expect(model).toBeDefined();
      expect(model.provider).toBe('my-custom-provider');
      expect(model.modelId).toBe('my-embedding-model');

      // Verify createOpenAICompatible was called with correct parameters
      expect(createOpenAICompatible).toHaveBeenCalledWith({
        name: 'my-custom-provider',
        apiKey: 'test-key',
        baseURL: 'http://localhost:8080/v1',
        headers: undefined,
      });

      // Verify textEmbeddingModel was called with the modelId
      const mockInstance = vi.mocked(createOpenAICompatible).mock.results[0].value;
      expect(mockInstance.textEmbeddingModel).toHaveBeenCalledWith('my-embedding-model');
    });

    it('should work with custom URL in id format', async () => {
      const model = new ModelRouterEmbeddingModel({
        id: 'ollama/nomic-embed-text',
        url: 'http://localhost:11434/v1',
        apiKey: 'not-needed',
      });

      expect(model).toBeDefined();
      expect(model.provider).toBe('ollama');
      expect(model.modelId).toBe('nomic-embed-text');
    });

    it('should handle custom headers with custom provider', async () => {
      const model = new ModelRouterEmbeddingModel({
        providerId: 'custom-ai',
        modelId: 'embed-v1',
        url: 'http://localhost:9000/v1',
        apiKey: 'test-key',
        headers: {
          'X-Custom-Header': 'custom-value',
        },
      });

      expect(model).toBeDefined();

      // Verify headers were passed
      expect(createOpenAICompatible).toHaveBeenCalledWith({
        name: 'custom-ai',
        apiKey: 'test-key',
        baseURL: 'http://localhost:9000/v1',
        headers: {
          'X-Custom-Header': 'custom-value',
        },
      });
    });

    it('should successfully embed with custom provider', async () => {
      const model = new ModelRouterEmbeddingModel({
        providerId: 'local-llm',
        modelId: 'custom-embedder',
        url: 'http://localhost:8080/v1',
        apiKey: 'test-key',
      });

      const result = await model.doEmbed({
        values: ['test text'],
      });

      expect(result).toBeDefined();
      expect(result.embeddings).toBeDefined();
      expect(result.embeddings.length).toBe(1);
      expect(result.embeddings[0].length).toBe(768);
    });
  });
});
