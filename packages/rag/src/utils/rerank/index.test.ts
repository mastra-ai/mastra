import { CohereRelevanceScorer } from '@mastra/core';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

import { Reranker } from '.';

vi.spyOn(CohereRelevanceScorer.prototype, 'getRelevanceScore').mockImplementation(async () => {
  return 1;
});

const getScoreSpreads = (results1: any, results2: any) => {
  const scoreSpread1 = Math.max(...results1.map((r: any) => r.score)) - Math.min(...results1.map((r: any) => r.score));

  const scoreSpread2 = Math.max(...results2.map((r: any) => r.score)) - Math.min(...results2.map((r: any) => r.score));

  return {
    scoreSpread1,
    scoreSpread2,
  };
};

describe('Reranker', () => {
  beforeEach(() => {
    vi.clearAllMocks(); // Clear any mock state before each test
  });

  describe('constructor', () => {
    it('should throw an error if cohere API key is missing', () => {
      expect(
        () =>
          new Reranker({
            semanticProvider: 'cohere',
          }),
      ).toThrow('Cohere API key required when using Cohere provider');
    });

    it('should throw an error if agent provider is missing for agent provider', () => {
      expect(
        () =>
          new Reranker({
            semanticProvider: 'agent',
            agentProvider: undefined,
          }),
      ).toThrow('Agent provider options required when using Agent provider');
    });

    it('should initialize with default weights', () => {
      const reranker = new Reranker({
        semanticProvider: 'cohere',
        cohereApiKey: 'mock-api-key',
      });
      expect(reranker['weights']).toEqual({
        semantic: 0.4,
        vector: 0.4,
        position: 0.2,
      });
    });

    it('should initialize with custom weights', () => {
      const reranker = new Reranker({
        semanticProvider: 'cohere',
        cohereApiKey: 'mock-api-key',
        weights: {
          semantic: 0.5,
          vector: 0.3,
          position: 0.2,
        },
      });
      expect(reranker['weights']).toEqual({
        semantic: 0.5,
        vector: 0.3,
        position: 0.2,
      });
    });
  });

  describe('rerank', () => {
    it('should rerank results based on semantic, vector, and position scores', async () => {
      const reranker = new Reranker({
        semanticProvider: 'cohere',
        cohereApiKey: 'mock-api-key',
      });

      const query = 'test query';
      const vectorStoreResults = [
        { id: '1', metadata: { text: 'Test result 1' }, score: 0.5 },
        { id: '2', metadata: { text: 'Test result 2' }, score: 0.4 },
        { id: '3', metadata: { text: 'Test result 3' }, score: 0.9 },
      ];

      const rerankedResults = await reranker.rerank({
        query,
        vectorStoreResults,
        topK: 2,
      });

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

      const { scoreSpread1, scoreSpread2 } = getScoreSpreads(vectorStoreResults, rerankedResults);
      expect(scoreSpread1).toBe(0.5);
      expect(scoreSpread2).toBe(0.026666666666666616);
    });

    it('should rerank results based on semantic, vector, and position scores with weighted values', async () => {
      const reranker = new Reranker({
        semanticProvider: 'cohere',
        cohereApiKey: 'mock-api-key',
        weights: {
          semantic: 0.3,
          vector: 0.2,
          position: 0.1,
        },
      });

      const query = 'test query';
      const vectorStoreResults = [
        { id: '1', metadata: { text: 'Test result 1' }, score: 0.5 },
        { id: '2', metadata: { text: 'Test result 2' }, score: 0.4 },
        { id: '3', metadata: { text: 'Test result 3' }, score: 0.9 },
      ];

      const rerankedResults = await reranker.rerank({
        query,
        vectorStoreResults,
        topK: 2,
      });

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
      const { scoreSpread1, scoreSpread2 } = getScoreSpreads(vectorStoreResults, rerankedResults);
      expect(scoreSpread1).toBe(0.5);
      expect(scoreSpread2).toBe(0.013333333333333308);
    });

    it('should handle the case where query embedding is provided', async () => {
      const reranker = new Reranker({
        semanticProvider: 'cohere',
        cohereApiKey: 'mock-api-key',
      });

      const query = 'test query';
      const queryEmbedding = [0.5, 0.3, -0.2, 0.4]; // Mock embedding
      const vectorStoreResults = [
        { id: '1', metadata: { text: 'Test result 1' }, score: 0.8 },
        { id: '2', metadata: { text: 'Test result 2' }, score: 0.6 },
      ];

      const rerankedResults = await reranker.rerank({
        query,
        vectorStoreResults,
        queryEmbedding,
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
      const { scoreSpread1, scoreSpread2 } = getScoreSpreads(vectorStoreResults, rerankedResults);
      expect(scoreSpread1).toBe(0.20000000000000007);
      expect(scoreSpread2).toBe(0.18000000000000016);
    });
  });
});
