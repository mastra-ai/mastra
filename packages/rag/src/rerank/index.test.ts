import { cohere } from '@ai-sdk/cohere';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CohereRelevanceScorer } from './relevance';

import { rerank, rerankWithScorer } from '.';

vi.spyOn(CohereRelevanceScorer.prototype, 'getRelevanceScore').mockImplementation(async () => {
  return 1;
});

const getScoreSpreads = (results1: any, results2: any) => {
  const scoreSpread1 = Math.max(...results1.map((r: any) => r.score)) - Math.min(...results1.map((r: any) => r.score));
  const scoreSpread2 = Math.max(...results2.map((r: any) => r.score)) - Math.min(...results2.map((r: any) => r.score));
  return { scoreSpread1, scoreSpread2 };
};

describe('rerank', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw an error if weights do not add up to 1', async () => {
    const results = [
      { id: '1', metadata: { text: 'Test result 1' }, score: 0.5 },
      { id: '2', metadata: { text: 'Test result 2' }, score: 0.4 },
      { id: '3', metadata: { text: 'Test result 3' }, score: 0.9 },
    ];
    await expect(
      rerank(results, 'test query', cohere('rerank-v3.5'), { weights: { semantic: 0.5, vector: 0.3, position: 0.5 } }),
    ).rejects.toThrow('Weights must add up to 1');
  });

  it('should rerank results with default weights', async () => {
    const results = [
      { id: '1', metadata: { text: 'Test result 1' }, score: 0.5 },
      { id: '2', metadata: { text: 'Test result 2' }, score: 0.4 },
      { id: '3', metadata: { text: 'Test result 3' }, score: 0.9 },
    ];

    const rerankedResults = await rerank(results, 'test query', cohere('rerank-v3.5'), { topK: 2 });

    expect(rerankedResults).toHaveLength(2);
    expect(rerankedResults[0]).toStrictEqual({
      result: { id: '3', metadata: { text: 'Test result 3' }, score: 0.9 },
      score: 0.8266666666666667,
      details: {
        semantic: 1,
        vector: 0.9,
        position: 0.33333333333333337,
      },
    });
    expect(rerankedResults[1]).toStrictEqual({
      result: { id: '1', metadata: { text: 'Test result 1' }, score: 0.5 },
      score: 0.8,
      details: {
        semantic: 1,
        vector: 0.5,
        position: 1,
      },
    });

    const { scoreSpread1, scoreSpread2 } = getScoreSpreads(results, rerankedResults);
    expect(scoreSpread1).toBe(0.5);
    expect(scoreSpread2).toBe(0.026666666666666616);
  });

  it('should rerank results with custom weights', async () => {
    const results = [
      { id: '1', metadata: { text: 'Test result 1' }, score: 0.5 },
      { id: '2', metadata: { text: 'Test result 2' }, score: 0.4 },
      { id: '3', metadata: { text: 'Test result 3' }, score: 0.9 },
    ];

    const rerankedResults = await rerank(results, 'test query', cohere('rerank-v3.5'), {
      weights: {
        semantic: 0.5,
        vector: 0.4,
        position: 0.1,
      },
      topK: 2,
    });

    expect(rerankedResults).toHaveLength(2);
    expect(rerankedResults[0]).toStrictEqual({
      result: { id: '3', metadata: { text: 'Test result 3' }, score: 0.9 },
      score: 0.8933333333333334,
      details: {
        semantic: 1,
        vector: 0.9,
        position: 0.33333333333333337,
      },
    });
    expect(rerankedResults[1]).toStrictEqual({
      result: { id: '1', metadata: { text: 'Test result 1' }, score: 0.5 },
      score: 0.7999999999999999,
      details: {
        semantic: 1,
        vector: 0.5,
        position: 1,
      },
    });
    const { scoreSpread1, scoreSpread2 } = getScoreSpreads(results, rerankedResults);
    expect(scoreSpread1).toBe(0.5);
    expect(scoreSpread2).toBe(0.09333333333333349);
  });

  it('should handle query embedding when provided', async () => {
    const results = [
      { id: '1', metadata: { text: 'Test result 1' }, score: 0.8 },
      { id: '2', metadata: { text: 'Test result 2' }, score: 0.6 },
    ];

    const rerankedResults = await rerank(results, 'test query', cohere('rerank-v3.5'), {
      queryEmbedding: [0.5, 0.3, -0.2, 0.4],
      topK: 2,
    });

    // Ensure query embedding analysis is being applied (we don't know exact score without knowing internals)
    expect(rerankedResults).toHaveLength(2);
    expect(rerankedResults[0]).toStrictEqual({
      result: { id: '1', metadata: { text: 'Test result 1' }, score: 0.8 },
      score: 0.9200000000000002,
      details: {
        semantic: 1,
        vector: 0.8,
        position: 1,
        queryAnalysis: {
          magnitude: 0.7348469228349535,
          dominantFeatures: [0, 3, 1, 2],
        },
      },
    });
    expect(rerankedResults[1]).toStrictEqual({
      result: { id: '2', metadata: { text: 'Test result 2' }, score: 0.6 },
      score: 0.74,
      details: {
        semantic: 1,
        vector: 0.6,
        position: 0.5,
        queryAnalysis: {
          magnitude: 0.7348469228349535,
          dominantFeatures: [0, 3, 1, 2],
        },
      },
    });
    const { scoreSpread1, scoreSpread2 } = getScoreSpreads(results, rerankedResults);
    expect(scoreSpread1).toBe(0.20000000000000007);
    expect(scoreSpread2).toBe(0.18000000000000016);
  });

  it('should mark the rerank span as errored when scoring fails', async () => {
    const error = new Error('scorer failed');
    const span = {
      end: vi.fn(),
      error: vi.fn(),
    };
    const currentSpan = {
      createChildSpan: vi.fn(() => span),
    };
    const scorer = {
      getRelevanceScore: vi.fn().mockRejectedValue(error),
    };
    const results = [{ id: '1', metadata: { text: 'Test result 1' }, score: 0.5 }];

    await expect(
      rerankWithScorer({
        results,
        query: 'test query',
        scorer,
        options: {
          topK: 1,
          observabilityContext: {
            tracingContext: {
              currentSpan,
            },
          } as any,
        },
      }),
    ).rejects.toThrow(error);

    expect(span.error).toHaveBeenCalledWith({ error, endSpan: true });
    expect(span.end).not.toHaveBeenCalled();
  });

  describe('weight validation', () => {
    const results = [
      { id: 'a', score: 0.25 },
      { id: 'b', score: 0.75 },
    ];
    const scorer = { getRelevanceScore: async () => 1 };

    it.each([
      { name: 'out-of-range weights that add up to one', weights: { semantic: 2, vector: -1, position: 0 } },
      { name: 'reversed out-of-range weights that add up to one', weights: { semantic: -1, vector: 2, position: 0 } },
      { name: 'negative vector weight', weights: { semantic: 0.4, vector: -1, position: 0.2 } },
      { name: 'vector weight above one', weights: { semantic: 0.4, vector: 2, position: 0.2 } },
      { name: 'NaN weight', weights: { semantic: NaN, vector: 0.4, position: 0.2 } },
      { name: 'infinite weight', weights: { semantic: Infinity, vector: 0.4, position: 0.2 } },
      { name: 'negative infinite weight', weights: { semantic: -Infinity, vector: 0.4, position: 0.2 } },
    ])('rejects $name through both public APIs', async ({ weights }) => {
      await expect(rerankWithScorer({ results, query: 'test', scorer, options: { weights } })).rejects.toThrow(
        'Weights must be finite numbers between 0 and 1',
      );
      await expect(rerank(results, 'test', cohere('rerank-v3.5'), { weights })).rejects.toThrow(
        'Weights must be finite numbers between 0 and 1',
      );
    });

    it('accepts zero and one weights and partial overrides', async () => {
      // With position-only weighting, the first result must outrank the higher vector score.
      const ranked = await rerankWithScorer({
        results,
        query: 'test',
        scorer,
        options: { weights: { semantic: 0, vector: 0, position: 1 } },
      });
      expect(ranked.map(item => item.result.id)).toEqual(['a', 'b']);

      const partial = await rerankWithScorer({
        results,
        query: 'test',
        scorer,
        options: { weights: { semantic: 0.7, vector: 0.1 } },
      });
      expect(partial).toHaveLength(2);
      expect(partial.map(item => item.result.id)).toEqual(['a', 'b']);
      expect(partial[0]?.score).toBeCloseTo(0.225);
    });

    it('marks the rerank span as errored for invalid weights', async () => {
      const span = { end: vi.fn(), error: vi.fn() };
      const currentSpan = { createChildSpan: vi.fn(() => span) };

      await expect(
        rerankWithScorer({
          results,
          query: 'test',
          scorer,
          options: {
            weights: { semantic: 2, vector: -1, position: 0 },
            observabilityContext: { tracingContext: { currentSpan } } as any,
          },
        }),
      ).rejects.toThrow('Weights must be finite numbers between 0 and 1');

      expect(span.error).toHaveBeenCalledWith({ error: expect.any(Error), endSpan: true });
      expect(span.end).not.toHaveBeenCalled();
    });
  });

  describe('topK validation', () => {
    const results = [
      { id: '1', metadata: { text: 'Test result 1' }, score: 0.5 },
      { id: '2', metadata: { text: 'Test result 2' }, score: 0.4 },
      { id: '3', metadata: { text: 'Test result 3' }, score: 0.9 },
    ];

    it.each([-1, 1.5, NaN, Infinity, -Infinity])('rejects topK %s before scoring', async topK => {
      const scorer = { getRelevanceScore: vi.fn(async () => 1) };

      await expect(rerankWithScorer({ results, query: 'test query', scorer, options: { topK } })).rejects.toThrow(
        'topK must be a nonnegative integer',
      );
      expect(scorer.getRelevanceScore).not.toHaveBeenCalled();
    });

    it('rejects invalid topK through rerank', async () => {
      await expect(rerank(results, 'test query', cohere('rerank-v3.5'), { topK: -1 })).rejects.toThrow(
        'topK must be a nonnegative integer',
      );
      expect(CohereRelevanceScorer.prototype.getRelevanceScore).not.toHaveBeenCalled();
    });

    it('marks the rerank span as errored for invalid topK', async () => {
      const span = { end: vi.fn(), error: vi.fn() };
      const currentSpan = { createChildSpan: vi.fn(() => span) };
      const scorer = { getRelevanceScore: vi.fn(async () => 1) };

      await expect(
        rerankWithScorer({
          results,
          query: 'test query',
          scorer,
          options: { topK: -1, observabilityContext: { tracingContext: { currentSpan } } as any },
        }),
      ).rejects.toThrow('topK must be a nonnegative integer');

      expect(span.error).toHaveBeenCalledWith({ error: expect.any(Error), endSpan: true });
      expect(span.end).not.toHaveBeenCalled();
    });

    it.each([
      [0, 0],
      [2, 2],
    ])('returns at most topK results for topK %s', async (topK, expected) => {
      const scorer = { getRelevanceScore: vi.fn(async () => 1) };
      const ranked = await rerankWithScorer({ results, query: 'test query', scorer, options: { topK } });
      expect(ranked).toHaveLength(expected);
    });
  });
});
