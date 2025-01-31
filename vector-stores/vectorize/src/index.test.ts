import { randomUUID } from 'crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { CloudflareVector } from './';

describe('CloudflareVector', () => {
  let vectorStore: CloudflareVector;
  const VECTOR_DIMENSION = 1536;
  const testIndexName = `default-${randomUUID()}`;

  // Helper function to create a normalized vector
  const createVector = (primaryDimension: number, value: number = 1.0): number[] => {
    const vector = new Array(VECTOR_DIMENSION).fill(0);
    vector[primaryDimension] = value;
    // Normalize the vector for cosine similarity
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map(val => val / magnitude);
  };

  beforeAll(() => {
    // Load from environment variables for CI/CD
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      throw new Error(
        'Missing required environment variables: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_VECTORIZE_ID',
      );
    }

    vectorStore = new CloudflareVector({ accountId, apiToken });
  });

  afterAll(async () => {
    try {
      await vectorStore.deleteIndex(testIndexName);
    } catch (error) {
      console.warn('Failed to delete test index:', error);
    }
  });

  describe('Index Operations', () => {
    const tempIndexName = 'test_temp_index';

    it('should create and list indexes', async () => {
      await vectorStore.createIndex(tempIndexName, VECTOR_DIMENSION, 'cosine');
      const indexes = await vectorStore.listIndexes();
      expect(indexes).toContain(tempIndexName);
    });

    it('should describe an index correctly', async () => {
      const stats = await vectorStore.describeIndex(tempIndexName);
      expect(stats).toEqual({
        dimension: VECTOR_DIMENSION,
        metric: 'cosine',
        count: 0,
      });
    });

    it('should delete an index', async () => {
      await vectorStore.deleteIndex(tempIndexName);
      const indexes = await vectorStore.listIndexes();
      expect(indexes).not.toContain(tempIndexName);
    });
  });

  describe('Vector Operations', () => {
    let vectorIds: string[];
    it('should create index before operations', async () => {
      await vectorStore.createIndex(testIndexName, VECTOR_DIMENSION, 'cosine');
      const indexes = await vectorStore.listIndexes();
      expect(indexes).toContain(testIndexName);
    });

    it('should insert vectors and query them', async () => {
      const testVectors = [createVector(0, 1.0), createVector(1, 1.0), createVector(2, 1.0)];

      const testMetadata = [{ label: 'first-dimension' }, { label: 'second-dimension' }, { label: 'third-dimension' }];

      vectorIds = await vectorStore.upsert(testIndexName, testVectors, testMetadata);
      expect(vectorIds).toHaveLength(3);

      // Wait for vectors to be indexed
      await new Promise(resolve => setTimeout(resolve, 10000));
      const stats = await vectorStore.describeIndex(testIndexName);
      expect(stats.count).toBeGreaterThan(0);

      const results = await vectorStore.query(testIndexName, createVector(0, 0.9), 3);
      expect(results).toHaveLength(3);

      if (results.length > 0) {
        expect(results[0].metadata).toEqual({ label: 'first-dimension' });
      }
    }, 30000);

    it('should query vectors and return vector in results', async () => {
      const results = await vectorStore.query(testIndexName, createVector(0, 0.9), 3, undefined, true);

      expect(results).toHaveLength(3);

      for (const result of results) {
        expect(result.vector).toBeDefined();
        expect(result.vector).toHaveLength(VECTOR_DIMENSION);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid dimension vectors', async () => {
      await expect(vectorStore.upsert(testIndexName, [[1.0, 0.0]])).rejects.toThrow();
    });

    it('should handle querying with wrong dimensions', async () => {
      await expect(vectorStore.query(testIndexName, [1.0, 0.0])).rejects.toThrow();
    });

    it('should handle non-existent index operations', async () => {
      const nonExistentIndex = 'non_existent_index';
      await expect(vectorStore.query(nonExistentIndex, createVector(0, 1.0))).rejects.toThrow();
    });

    // it('throws error for filter keys longer than 512 characters', () => {
    //   const longKey = 'a'.repeat(513);
    //   const filter = { [longKey]: 'value' };

    //   expect(() => translator.translate(filter)).toThrow('Filter keys cannot be longer than 512 characters');
    // });

    // it('throws error for filter keys containing invalid characters', () => {
    //   const invalidFilters = [
    //     { 'field"name': 'value' }, // Contains "
    //     { 'field|name': 'value' }, // Contains |
    //   ];

    //   invalidFilters.forEach(filter => {
    //     expect(() => translator.translate(filter)).toThrow('Filter keys cannot contain " or |');
    //   });
    // });

    // it('throws error for invalid operator combinations', () => {
    //   const invalidFilters = [
    //     { field: { $gt: 5, $eq: 10 } }, // Range with equality
    //     { field: { $lt: 100, $in: [1, 2] } }, // Range with array operator
    //     { field: { $gte: 0, $ne: 5 } }, // Range with not equals
    //   ];

    //   invalidFilters.forEach(filter => {
    //     expect(() => translator.translate(filter)).toThrow('Range operators cannot be combined with other operators');
    //   });
    // });

    // it('allows valid range operator combinations', () => {
    //   const validFilters = [
    //     { field: { $gt: 5, $lt: 10 } },
    //     { field: { $gte: 0, $lte: 100 } },
    //     { field: { $gt: 5, $lte: 10 } },
    //   ];

    //   validFilters.forEach(filter => {
    //     expect(() => translator.translate(filter)).not.toThrow();
    //   });
    // });

    // it('throws error for empty object field values', () => {
    //   const emptyFilters = { field: {} };
    //   expect(() => translator.translate(emptyFilters)).toThrow(/Filter (must be a non-empty object|cannot be empty)/);
    // });

    // it('throws error for oversized filters', () => {
    //   // Create a filter that exceeds 2048 bytes when stringified
    //   const largeFilter = {
    //     field1: { $in: Array(1000).fill('test') }, // Large array of strings
    //     field2: { $in: Array(1000).fill(123) }, // Large array of numbers
    //   };

    //   expect(() => translator.translate(largeFilter)).toThrow(
    //     'Filter JSON representation must be less than 2048 bytes',
    //   );
    // });

    // it('handles array values in comparison operators', () => {
    //   // Some vector stores might allow comparing against arrays
    //   expect(() =>
    //     translator.translate({
    //       field: { $gt: [] },
    //     }),
    //   ).toThrow();

    //   expect(() =>
    //     translator.translate({
    //       field: { $lt: [1, 2, 3] },
    //     }),
    //   ).toThrow();
    // });

    // it('validates value types', () => {
    //   const invalidFilters = [
    //     { field: { $gt: 'not a number' } },
    //     { field: { $lt: true } },
    //     { field: { $in: 'not an array' } },
    //   ];

    //   invalidFilters.forEach(filter => {
    //     expect(() => translator.translate(filter)).toThrow();
    //   });
    // });
  });
});
