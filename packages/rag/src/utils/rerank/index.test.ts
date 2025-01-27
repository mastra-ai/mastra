import { CohereRelevanceScorer } from '@mastra/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { rerank } from '.';

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

  it('should rerank results with default weights', async () => {
    const results = [
      { id: '1', metadata: { text: 'Test result 1' }, score: 0.5 },
      { id: '2', metadata: { text: 'Test result 2' }, score: 0.4 },
      { id: '3', metadata: { text: 'Test result 3' }, score: 0.9 },
    ];

    const rerankedResults = await rerank(
      results,
      'test query',
      {
        method: 'cohere',
        config: {
          apiKey: 'mock-api-key',
        },
      },
      { topK: 2 },
    );

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

    const rerankedResults = await rerank(
      results,
      'test query',
      {
        method: 'cohere',
        config: {
          apiKey: 'mock-api-key',
        },
      },
      {
        weights: {
          semantic: 0.3,
          vector: 0.2,
          position: 0.1,
        },
        topK: 2,
      },
    );

    expect(rerankedResults).toHaveLength(2);
    expect(rerankedResults[0]).toStrictEqual({
      result: { id: '3', metadata: { text: 'Test result 3' }, score: 0.9 },
      score: 0.5133333333333333,
      details: {
        semantic: 1,
        vector: 0.9,
        position: 0.33333333333333337,
      },
    });
    expect(rerankedResults[1]).toStrictEqual({
      result: { id: '1', metadata: { text: 'Test result 1' }, score: 0.5 },
      score: 0.5,
      details: {
        semantic: 1,
        vector: 0.5,
        position: 1,
      },
    });
    const { scoreSpread1, scoreSpread2 } = getScoreSpreads(results, rerankedResults);
    expect(scoreSpread1).toBe(0.5);
    expect(scoreSpread2).toBe(0.013333333333333308);
  });

  it('should handle query embedding when provided', async () => {
    const results = [
      { id: '1', metadata: { text: 'Test result 1' }, score: 0.8 },
      { id: '2', metadata: { text: 'Test result 2' }, score: 0.6 },
    ];

    const rerankedResults = await rerank(
      results,
      'test query',
      {
        method: 'cohere',
        config: {
          apiKey: 'mock-api-key',
        },
      },
      {
        queryEmbedding: [0.5, 0.3, -0.2, 0.4],
        topK: 2,
      },
    );

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
});
