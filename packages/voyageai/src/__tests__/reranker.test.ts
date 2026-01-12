import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VoyageRelevanceScorer, createVoyageReranker, voyageReranker } from '../reranker';

// Mock function for rerank
const mockRerank = vi.fn();

// Mock the voyageai module
vi.mock('voyageai', () => {
  return {
    VoyageAIClient: class MockVoyageAIClient {
      constructor() {}
      rerank = mockRerank;
    },
  };
});

describe('VoyageRelevanceScorer', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, VOYAGE_API_KEY: 'test-api-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should create scorer with default config', () => {
    const scorer = new VoyageRelevanceScorer({ model: 'rerank-2.5' });

    expect(scorer.modelId).toBe('rerank-2.5');
  });

  it('should use API key from config over environment', () => {
    const scorer = new VoyageRelevanceScorer({
      model: 'rerank-2.5',
      apiKey: 'custom-key',
    });

    expect(scorer.modelId).toBe('rerank-2.5');
  });

  it('should throw error if no API key is available', () => {
    delete process.env.VOYAGE_API_KEY;

    expect(() => new VoyageRelevanceScorer({ model: 'rerank-2.5' })).toThrow(
      'VoyageAI API key is required',
    );
  });

  describe('getRelevanceScore', () => {
    it('should return relevance score for a single document', async () => {
      mockRerank.mockResolvedValue({
        data: [{ index: 0, relevanceScore: 0.85 }],
      });

      const scorer = new VoyageRelevanceScorer({ model: 'rerank-2.5' });
      const score = await scorer.getRelevanceScore(
        'What is machine learning?',
        'Machine learning is a subset of artificial intelligence.',
      );

      expect(score).toBe(0.85);
      expect(mockRerank).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'What is machine learning?',
          documents: ['Machine learning is a subset of artificial intelligence.'],
          model: 'rerank-2.5',
          topK: 1,
          truncation: true,
        }),
      );
    });

    it('should throw error if no score in response', async () => {
      mockRerank.mockResolvedValue({
        data: [],
      });

      const scorer = new VoyageRelevanceScorer({ model: 'rerank-2.5' });

      await expect(scorer.getRelevanceScore('query', 'document')).rejects.toThrow(
        'No relevance score found',
      );
    });

    it('should respect truncation config', async () => {
      mockRerank.mockResolvedValue({
        data: [{ index: 0, relevanceScore: 0.5 }],
      });

      const scorer = new VoyageRelevanceScorer({
        model: 'rerank-2.5',
        truncation: false,
      });
      await scorer.getRelevanceScore('query', 'document');

      expect(mockRerank).toHaveBeenCalledWith(
        expect.objectContaining({
          truncation: false,
        }),
      );
    });
  });

  describe('rerankDocuments', () => {
    it('should rerank multiple documents', async () => {
      mockRerank.mockResolvedValue({
        data: [
          { index: 0, relevanceScore: 0.95 },
          { index: 2, relevanceScore: 0.32 },
        ],
      });

      const scorer = new VoyageRelevanceScorer({ model: 'rerank-2.5' });
      const results = await scorer.rerankDocuments(
        'What is the capital of France?',
        ['Paris is the capital of France.', 'London is in England.', 'Berlin is in Germany.'],
        2,
      );

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        document: 'Paris is the capital of France.',
        index: 0,
        score: 0.95,
      });
      expect(results[1]).toEqual({
        document: 'Berlin is in Germany.',
        index: 2,
        score: 0.32,
      });
    });

    it('should pass topK to API', async () => {
      mockRerank.mockResolvedValue({
        data: [{ index: 0, relevanceScore: 0.9 }],
      });

      const scorer = new VoyageRelevanceScorer({ model: 'rerank-2.5' });
      await scorer.rerankDocuments('query', ['doc1', 'doc2'], 1);

      expect(mockRerank).toHaveBeenCalledWith(
        expect.objectContaining({
          topK: 1,
        }),
      );
    });

    it('should handle empty response', async () => {
      mockRerank.mockResolvedValue({
        data: null,
      });

      const scorer = new VoyageRelevanceScorer({ model: 'rerank-2.5' });
      const results = await scorer.rerankDocuments('query', ['doc1']);

      expect(results).toEqual([]);
    });

    it('should handle undefined values in response', async () => {
      mockRerank.mockResolvedValue({
        data: [{ relevanceScore: 0.5 }], // Missing index
      });

      const scorer = new VoyageRelevanceScorer({ model: 'rerank-2.5' });
      const results = await scorer.rerankDocuments('query', ['doc1', 'doc2']);

      expect(results[0]).toEqual({
        document: 'doc1',
        index: 0,
        score: 0.5,
      });
    });
  });
});

describe('Factory functions', () => {
  beforeEach(() => {
    process.env.VOYAGE_API_KEY = 'test-api-key';
  });

  it('createVoyageReranker should create scorer from string', () => {
    const scorer = createVoyageReranker('rerank-2.5-lite');

    expect(scorer.modelId).toBe('rerank-2.5-lite');
  });

  it('createVoyageReranker should create scorer from config', () => {
    const scorer = createVoyageReranker({
      model: 'rerank-2',
      truncation: false,
    });

    expect(scorer.modelId).toBe('rerank-2');
  });

  it('voyageReranker should be an alias for createVoyageReranker', () => {
    expect(voyageReranker).toBe(createVoyageReranker);
  });
});

describe('All reranker models', () => {
  beforeEach(() => {
    process.env.VOYAGE_API_KEY = 'test-api-key';
  });

  const models = [
    'rerank-2.5',
    'rerank-2.5-lite',
    'rerank-2',
    'rerank-2-lite',
    'rerank-1',
    'rerank-lite-1',
  ] as const;

  it.each(models)('should create scorer for %s', model => {
    const scorer = createVoyageReranker(model);
    expect(scorer.modelId).toBe(model);
  });
});
