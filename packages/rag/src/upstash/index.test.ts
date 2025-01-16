import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { UpstashVector } from './';

describe('UpstashVector', () => {
  let vectorStore: UpstashVector;
  const VECTOR_DIMENSION = 1536;
  const testIndexName = 'default';

  beforeAll(() => {
    // Load from environment variables for CI/CD
    const url = process.env.UPSTASH_VECTOR_URL;
    const token = process.env.UPSTASH_VECTOR_TOKEN;

    if (!url || !token) {
      throw new Error('Missing required environment variables: UPSTASH_VECTOR_URL, UPSTASH_VECTOR_TOKEN');
    }

    vectorStore = new UpstashVector({ url, token });
  });

  afterAll(async () => {
    // Cleanup: delete test index
    try {
      await vectorStore.deleteIndex(testIndexName);
    } catch (error) {
      console.warn('Failed to delete test index:', error);
    }
  });

  describe('Vector Operations', () => {
    // Helper function to create a normalized vector
    const createVector = (primaryDimension: number, value: number = 1.0): number[] => {
      const vector = new Array(VECTOR_DIMENSION).fill(0);
      vector[primaryDimension] = value;
      // Normalize the vector for cosine similarity
      const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      return vector.map(val => val / magnitude);
    };

    let vectorIds: string[];

    it('should upsert vectors and query them', async () => {
      // Create and log test vectors
      const testVectors = [createVector(0, 1.0), createVector(1, 1.0), createVector(2, 1.0)];

      const testMetadata = [{ label: 'first-dimension' }, { label: 'second-dimension' }, { label: 'third-dimension' }];

      // Upsert vectors
      vectorIds = await vectorStore.upsert('default', testVectors, testMetadata);

      expect(vectorIds).toHaveLength(3);

      const stats = await vectorStore.describeIndex(testIndexName);
      console.log('After upsert stats:', stats);

      await new Promise(resolve => setTimeout(resolve, 10000));

      const results = await vectorStore.query(testIndexName, createVector(0, 0.9), 3);
      console.log('Query results:', results);

      expect(results).toHaveLength(3);
      if (results.length > 0) {
        expect(results?.[0]?.metadata).toEqual({ label: 'first-dimension' });
      }
    }, 5000000);

    it('should query vectors and return vector in results', async () => {
      const results = await vectorStore.query(testIndexName, createVector(0, 0.9), 3, undefined, true);
      expect(results).toHaveLength(3);
      expect(results?.[0]?.vector).toBeDefined();
      expect(results?.[0]?.vector).toHaveLength(VECTOR_DIMENSION);
      expect(results?.[1]?.vector).toBeDefined();
      expect(results?.[1]?.vector).toHaveLength(VECTOR_DIMENSION);
      expect(results?.[2]?.vector).toBeDefined();
      expect(results?.[2]?.vector).toHaveLength(VECTOR_DIMENSION);
    });
  });
  describe('Index Operations', () => {
    it('should create and list an index', async () => {
      await vectorStore.createIndex(testIndexName, 3, 'cosine');
      const indexes = await vectorStore.listIndexes();
      expect(indexes).toEqual([testIndexName]);
    });

    it('should describe an index correctly', async () => {
      const stats = await vectorStore.describeIndex('mastra_default');
      expect(stats).toEqual({
        dimension: 1536,
        metric: 'cosine',
        count: 0,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid dimension vectors', async () => {
      await expect(
        vectorStore.upsert(testIndexName, [[1.0, 0.0]]), // Wrong dimensions
      ).rejects.toThrow();
    });

    it('should handle querying with wrong dimensions', async () => {
      await expect(
        vectorStore.query(testIndexName, [1.0, 0.0]), // Wrong dimensions
      ).rejects.toThrow();
    });
  });
});
