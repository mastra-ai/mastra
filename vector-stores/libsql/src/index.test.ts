import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

import { LibSQLVector } from './index.js';

describe('LibSQLVector', () => {
  let libsqlVector: LibSQLVector;
  const testIndexName = 'test_vectors';
  const testIndexName2 = 'test_vectors1';

  beforeAll(async () => {
    libsqlVector = new LibSQLVector({
      connectionUrl: 'file::memory:?cache=shared',
    });
  });

  afterAll(async () => {
    // Clean up test tables
    await libsqlVector.deleteIndex(testIndexName);
  });

  describe('createIndex', () => {
    afterAll(async () => {
      await libsqlVector.deleteIndex(testIndexName2);
    });

    it('should create a new vector table with specified dimensions', async () => {
      await libsqlVector.createIndex(testIndexName, 3);

      const stats = await libsqlVector.describeIndex(testIndexName);
      expect(stats?.dimension).toBe(3);
      expect(stats?.count).toBe(0);
    });

    // it('should create index with specified metric', async () => {
    //   await libsqlVector.createIndex(testIndexName2, 3, 'euclidean');
    //
    //   const stats = await libsqlVector.describeIndex(testIndexName2);
    //
    //   expect(stats.metric).toBe('euclidean');
    // });

    it('should throw error if dimension is invalid', async () => {
      await expect(libsqlVector.createIndex(`testIndexNameFail`, 0)).rejects.toThrow();
    });
  });

  describe('upsert', () => {
    beforeEach(async () => {
      await libsqlVector.createIndex(testIndexName, 3);
    });

    afterEach(async () => {
      await libsqlVector.deleteIndex(testIndexName);
    });

    it('should insert new vectors', async () => {
      const vectors = [
        [1, 2, 3],
        [4, 5, 6],
      ];
      const ids = await libsqlVector.upsert(testIndexName, vectors);

      expect(ids).toHaveLength(2);
      const stats = await libsqlVector.describeIndex(testIndexName);
      expect(stats.count).toBe(2);
    });

    it('should update existing vectors', async () => {
      const vectors = [[1, 2, 3]];
      const metadata = [{ test: 'initial' }];
      const [id] = await libsqlVector.upsert(testIndexName, vectors, metadata);

      // Update the same vector
      const updatedVectors = [[4, 5, 6]];
      const updatedMetadata = [{ test: 'updated' }];
      await libsqlVector.upsert(testIndexName, updatedVectors, updatedMetadata, [id!]);

      const results = await libsqlVector.query(testIndexName, [4, 5, 6], 1);
      expect(results[0]?.id).toBe(id);
      expect(results[0]?.metadata).toEqual({ test: 'updated' });
    });

    it('should handle metadata correctly', async () => {
      const vectors = [[1, 2, 3]];
      const metadata = [{ test: 'value', num: 123 }];

      await libsqlVector.upsert(testIndexName, vectors, metadata);
      const results = await libsqlVector.query(testIndexName, [1, 2, 3], 1);

      expect(results[0]?.metadata).toEqual(metadata[0]);
    });

    it('should throw error if vector dimensions dont match', async () => {
      const vectors = [[1, 2, 3, 4]]; // 4D vector for 3D index
      await expect(libsqlVector.upsert(testIndexName, vectors)).rejects.toThrow();
    });
  });

  describe('query', () => {
    const indexName = 'test_query_2';

    beforeEach(async () => {
      await libsqlVector.createIndex(indexName, 3);

      const vectors = [
        [1, 0, 0],
        [0.8, 0.2, 0],
        [0, 1, 0],
      ];
      const metadata = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 },
      ];
      await libsqlVector.upsert(indexName, vectors, metadata);
    });

    afterEach(async () => {
      await libsqlVector.deleteIndex(indexName);
    });

    it('should return closest vectors', async () => {
      const results = await libsqlVector.query(indexName, [1, 0, 0], 1);
      expect(results).toHaveLength(1);
      expect(results[0]?.vector).toBe(undefined);
      expect(results[0]?.score).toBeCloseTo(1, 5);
    });

    it('should return vector with result', async () => {
      const results = await libsqlVector.query(indexName, [1, 0, 0], 1, undefined, true);
      expect(results).toHaveLength(1);
      expect(results[0]?.vector).toStrictEqual([1, 0, 0]);
    });

    it('should respect topK parameter', async () => {
      const results = await libsqlVector.query(indexName, [1, 0, 0], 2);
      expect(results).toHaveLength(2);
    });

    it('should handle filters correctly', async () => {
      const results = await libsqlVector.query(indexName, [1, 0, 0], 10, { type: 'a' });

      expect(results).toHaveLength(1);
      results.forEach(result => {
        expect(result?.metadata?.type).toBe('a');
      });
    });
  });

  describe('query with advanced filters', () => {
    const indexName = 'test_query_filters';

    beforeEach(async () => {
      await libsqlVector.createIndex(indexName, 3);
      const vectors = [
        [1, 0.1, 0],
        [0.9, 0.2, 0],
        [0.95, 0.1, 0],
        [0.85, 0.2, 0],
        [0.9, 0.1, 0],
      ];

      const metadata = [
        { category: 'electronics', price: 100, tags: ['new', 'premium'], active: true },
        { category: 'books', price: 50, tags: ['used'], active: true },
        { category: 'electronics', price: 75, tags: ['refurbished'], active: false },
        { category: 'books', price: 25, tags: ['used', 'sale'], active: true },
        { category: 'clothing', price: 60, tags: ['new'], active: true },
      ];

      await libsqlVector.upsert(indexName, vectors, metadata);
    });

    afterEach(async () => {
      await libsqlVector.deleteIndex(indexName);
    });

    // Test numeric comparisons
    it('should filter with gt operator', async () => {
      const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
        price: { gt: 75 },
      });
      expect(results).toHaveLength(1);
      expect(results[0]?.metadata?.price).toBe(100);
    });

    it('should filter with lte operator', async () => {
      const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
        price: { lte: 50 },
      });
      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.metadata?.price).toBeLessThanOrEqual(50);
      });
    });

    // Test string operations
    it('should filter with like operator', async () => {
      const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
        category: { like: 'elect%' },
      });
      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.metadata?.category).toBe('electronics');
      });
    });

    it('should filter with ilike operator for case-insensitive search', async () => {
      const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
        category: { ilike: 'BOOKS' },
      });
      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.metadata?.category.toLowerCase()).toBe('books');
      });
    });

    // Test array operations
    it('should filter with in operator', async () => {
      const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
        category: { in: ['electronics', 'clothing'] },
      });
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(['electronics', 'clothing']).toContain(result.metadata?.category);
      });
    });

    // Test contains operator with different types
    it('should filter with contains operator for array values', async () => {
      const results = await libsqlVector.query(indexName, [1, 0.1, 0], 10, {
        tags: { contains: ['new'] },
      });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.metadata?.tags).toContain('new');
      });
    });

    it('should filter with contains operator for exact field match', async () => {
      const results = await libsqlVector.query(indexName, [1, 0.1, 0], 10, {
        category: { contains: 'electronics' },
      });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.metadata?.category).toBe('electronics');
      });
    });

    it('should filter with contains operator for nested objects', async () => {
      // First insert a record with nested object
      await libsqlVector.upsert(
        indexName,
        [[1, 0.1, 0]],
        [
          {
            details: { color: 'red', size: 'large' },
            category: 'clothing',
          },
        ],
      );

      const results = await libsqlVector.query(indexName, [1, 0.1, 0], 10, {
        details: { contains: { color: 'red' } },
      });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.metadata?.details.color).toBe('red');
      });
    });

    // Test exists operator
    it('should filter with exists operator', async () => {
      const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
        active: { exists: null },
      });
      expect(results).toHaveLength(5);
    });

    // Test multiple conditions
    it('should handle multiple filter conditions', async () => {
      const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
        category: 'electronics',
        price: { gt: 75 },
        active: true,
      });
      expect(results).toHaveLength(1);
      expect(results[0]?.metadata).toEqual(
        expect.objectContaining({
          category: 'electronics',
          price: 100,
          active: true,
        }),
      );
    });

    // Test edge cases
    it('should handle empty result sets with valid filters', async () => {
      const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
        price: { gt: 1000 },
      });
      expect(results).toHaveLength(0);
    });

    it('should throw error for invalid operator', async () => {
      await expect(
        libsqlVector.query(indexName, [1, 0, 0], 10, {
          price: { invalid: 100 },
        }),
      ).rejects.toThrow('Unsupported operator: invalid');
    });

    // Test score threshold
    it('should respect minimum score threshold', async () => {
      const results = await libsqlVector.query(
        indexName,
        [1, 0, 0],
        10,
        { category: 'electronics' },
        false,
        0.9, // minScore
      );
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.score).toBeGreaterThan(0.9);
      });
    });
  });

  describe('listIndexes', () => {
    const indexName = 'test_query_3';
    beforeAll(async () => {
      await libsqlVector.createIndex(indexName, 3);
    });

    afterAll(async () => {
      await libsqlVector.deleteIndex(indexName);
    });

    it('should list all vector tables', async () => {
      const indexes = await libsqlVector.listIndexes();
      expect(indexes).toContain(indexName);
    });

    it('should not return created index in list if it is deleted', async () => {
      await libsqlVector.deleteIndex(indexName);
      const indexes = await libsqlVector.listIndexes();
      expect(indexes).not.toContain(indexName);
    });
  });

  describe('describeIndex', () => {
    const indexName = 'test_query_4';
    beforeAll(async () => {
      await libsqlVector.createIndex(indexName, 3);
    });

    afterAll(async () => {
      await libsqlVector.deleteIndex(indexName);
    });
    it('should return correct index stats', async () => {
      await libsqlVector.createIndex(indexName, 3, 'cosine');
      const vectors = [
        [1, 2, 3],
        [4, 5, 6],
      ];
      await libsqlVector.upsert(indexName, vectors);

      const stats = await libsqlVector.describeIndex(indexName);
      expect(stats).toEqual({
        dimension: 3,
        count: 2,
        metric: 'cosine',
      });
    });

    it('should throw error for non-existent index', async () => {
      await expect(libsqlVector.describeIndex('non_existent')).rejects.toThrow();
    });
  });
});
