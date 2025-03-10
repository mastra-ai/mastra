import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

import { DefaultVectorDB } from './index.js';

describe('DefaultVectorDB', () => {
  let vectorDB: DefaultVectorDB;
  const testIndexName = 'test_vectors';
  const testIndexName2 = 'test_vectors1';

  beforeAll(async () => {
    vectorDB = new DefaultVectorDB({
      connectionUrl: 'file::memory:?cache=shared',
    });
  });

  afterAll(async () => {
    // Clean up test tables
    await vectorDB.deleteIndex(testIndexName);
  });

  // Index Management Tests
  describe('Index Management', () => {
    describe('createIndex', () => {
      afterAll(async () => {
        await vectorDB.deleteIndex(testIndexName2);
      });

      it('should create a new vector table with specified dimensions', async () => {
        await vectorDB.createIndex({ indexName: testIndexName, dimension: 3 });

        const stats = await vectorDB.describeIndex(testIndexName);
        expect(stats?.dimension).toBe(3);
        expect(stats?.count).toBe(0);
      });

      // it('should create index with specified metric', async () => {
      //   await vectorDB.createIndex(testIndexName2, 3, 'euclidean');
      //
      //   const stats = await vectorDB.describeIndex(testIndexName2);
      //
      //   expect(stats.metric).toBe('euclidean');
      // });

      it('should throw error if dimension is invalid', async () => {
        await expect(vectorDB.createIndex({ indexName: `testIndexNameFail`, dimension: 0 })).rejects.toThrow();
      });
    });

    describe('listIndexes', () => {
      const indexName = 'test_query_3';
      beforeAll(async () => {
        await vectorDB.createIndex({ indexName, dimension: 3 });
      });

      afterAll(async () => {
        await vectorDB.deleteIndex(indexName);
      });

      it('should list all vector tables', async () => {
        const indexes = await vectorDB.listIndexes();
        expect(indexes).toContain(indexName);
      });

      it('should not return created index in list if it is deleted', async () => {
        await vectorDB.deleteIndex(indexName);
        const indexes = await vectorDB.listIndexes();
        expect(indexes).not.toContain(indexName);
      });
    });

    describe('describeIndex', () => {
      const indexName = 'test_query_4';
      beforeAll(async () => {
        await vectorDB.createIndex({ indexName, dimension: 3 });
      });

      afterAll(async () => {
        await vectorDB.deleteIndex(indexName);
      });

      it('should return correct index stats', async () => {
        await vectorDB.createIndex({ indexName, dimension: 3, metric: 'cosine' });
        const vectors = [
          [1, 2, 3],
          [4, 5, 6],
        ];
        await vectorDB.upsert({ indexName, vectors });

        const stats = await vectorDB.describeIndex(indexName);
        expect(stats).toEqual({
          dimension: 3,
          count: 2,
          metric: 'cosine',
        });
      });

      it('should throw error for non-existent index', async () => {
        await expect(vectorDB.describeIndex('non_existent')).rejects.toThrow();
      });
    });
  });

  // Vector Operations Tests
  describe('Vector Operations', () => {
    describe('upsert', () => {
      beforeEach(async () => {
        await vectorDB.createIndex({ indexName: testIndexName, dimension: 3 });
      });

      afterEach(async () => {
        await vectorDB.deleteIndex(testIndexName);
      });

      it('should insert new vectors', async () => {
        const vectors = [
          [1, 2, 3],
          [4, 5, 6],
        ];
        const ids = await vectorDB.upsert({ indexName: testIndexName, vectors });

        expect(ids).toHaveLength(2);
        const stats = await vectorDB.describeIndex(testIndexName);
        expect(stats.count).toBe(2);
      });

      it('should update existing vectors', async () => {
        const vectors = [[1, 2, 3]];
        const metadata = [{ test: 'initial' }];
        const [id] = await vectorDB.upsert({ indexName: testIndexName, vectors, metadata });

        const updatedVectors = [[4, 5, 6]];
        const updatedMetadata = [{ test: 'updated' }];
        await vectorDB.upsert({
          indexName: testIndexName,
          vectors: updatedVectors,
          metadata: updatedMetadata,
          ids: [id!],
        });

        const results = await vectorDB.query({ indexName: testIndexName, queryVector: [4, 5, 6], topK: 1 });
        expect(results[0]?.id).toBe(id);
        expect(results[0]?.metadata).toEqual({ test: 'updated' });
      });

      it('should handle metadata correctly', async () => {
        const vectors = [[1, 2, 3]];
        const metadata = [{ test: 'value', num: 123 }];

        await vectorDB.upsert({ indexName: testIndexName, vectors, metadata });
        const results = await vectorDB.query({ indexName: testIndexName, queryVector: [1, 2, 3], topK: 1 });

        expect(results[0]?.metadata).toEqual(metadata[0]);
      });

      it('should throw error if vector dimensions dont match', async () => {
        const vectors = [[1, 2, 3, 4]]; // 4D vector for 3D index
        await expect(vectorDB.upsert({ indexName: testIndexName, vectors })).rejects.toThrow();
      });

      it('should delete the vector by id', async () => {
        const vectors = [
          [1, 2, 3],
          [4, 5, 6],
        ];
        const ids = await vectorDB.upsert(testIndexName, vectors);
        expect(ids).toHaveLength(2);
        const id = ids[1];

        await vectorDB.deleteIndexById(testIndexName, ids[0]);

        const results = await vectorDB.query(testIndexName, [1, 2, 3]);
        expect(results).toHaveLength(1);
        expect(results[0]?.id).toBe(id);
      });

      it('should update the vector by id', async () => {
        const vectors = [[1, 2, 3]];
        const metadata = [{ test: 'initial' }];
        const [id] = await vectorDB.upsert(testIndexName, vectors, metadata);

        const update = {
          vector: [4, 5, 6],
          metadata: { test: 'updated' },
        };
        await vectorDB.updateIndexById(testIndexName, id, update);

        const results = await vectorDB.query(testIndexName, [4, 5, 6], 1, [], true);
        expect(results[0]?.id).toBe(id);
        expect(results[0]?.metadata).toEqual({ test: 'updated' });
        expect(results[0]?.vector).toEqual([4, 5, 6]);
      });

      it('should update only metadata by id', async () => {
        const vectors = [[1, 2, 3]];
        const metadata = [{ test: 'initial' }];
        const [id] = await vectorDB.upsert(testIndexName, vectors, metadata);

        const update = {
          metadata: { test: 'updated' },
        };
        await vectorDB.updateIndexById(testIndexName, id, update);

        const results = await vectorDB.query(testIndexName, [1, 2, 3], 1);
        expect(results[0]?.id).toBe(id);
        expect(results[0]?.metadata).toEqual({ test: 'updated' });
        expect(results[0]?.vector).toBeUndefined();
      });

      it('should update only vector by id', async () => {
        const vectors = [[1, 2, 3]];
        const metadata = [{ test: 'initial' }];
        const [id] = await vectorDB.upsert(testIndexName, vectors, metadata);

        const update = {
          vector: [4, 5, 6],
        };
        await vectorDB.updateIndexById(testIndexName, id, update);

        const results = await vectorDB.query(testIndexName, [4, 5, 6], 1, [], true);
        expect(results[0]?.id).toBe(id);
        expect(results[0]?.metadata).toEqual({ test: 'initial' });
        expect(results[0]?.vector).toEqual([4, 5, 6]);
      });

      it('should throw error if no updates are provided', async () => {
        const vectors = [[1, 2, 3]];
        const metadata = [{ test: 'initial' }];
        const [id] = await vectorDB.upsert(testIndexName, vectors, metadata);

        await expect(vectorDB.updateIndexById(testIndexName, id, {})).rejects.toThrow('No updates provided');
      });
    });

    describe('Basic Query Operations', () => {
      const indexName = 'test_query_2';
      beforeEach(async () => {
        await vectorDB.createIndex({ indexName, dimension: 3 });
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
        await vectorDB.upsert({ indexName, vectors, metadata });
      });

      afterEach(async () => {
        await vectorDB.deleteIndex(indexName);
      });

      it('should return closest vectors', async () => {
        const results = await vectorDB.query({ indexName, queryVector: [1, 0, 0], topK: 1 });
        expect(results).toHaveLength(1);
        expect(results[0]?.vector).toBe(undefined);
        expect(results[0]?.score).toBeCloseTo(1, 5);
      });

      it('should return vector with result', async () => {
        const results = await vectorDB.query({ indexName, queryVector: [1, 0, 0], topK: 1, includeVector: true });
        expect(results).toHaveLength(1);
        expect(results[0]?.vector).toStrictEqual([1, 0, 0]);
      });

      it('should respect topK parameter', async () => {
        const results = await vectorDB.query({ indexName, queryVector: [1, 0, 0], topK: 2 });
        expect(results).toHaveLength(2);
      });

      it('should handle filters correctly', async () => {
        const results = await vectorDB.query({ indexName, queryVector: [1, 0, 0], topK: 10, filter: { type: 'a' } });

        expect(results).toHaveLength(1);
        results.forEach(result => {
          expect(result?.metadata?.type).toBe('a');
        });
      });
    });
  });

  // Advanced Query and Filter Tests
  describe('Advanced Query and Filter Operations', () => {
    const indexName = 'test_query_filters';

    beforeEach(async () => {
      await vectorDB.createIndex({ indexName, dimension: 3 });
      const vectors = [
        [1, 0.1, 0],
        [0.9, 0.2, 0],
        [0.95, 0.1, 0],
        [0.85, 0.2, 0],
        [0.9, 0.1, 0],
      ];

      const metadata = [
        {
          category: 'electronics',
          price: 100,
          tags: ['new', 'premium'],
          active: true,
          ratings: [4.5, 4.8, 4.2], // Array of numbers
          stock: [
            { location: 'A', count: 25 },
            { location: 'B', count: 15 },
          ], // Array of objects
          reviews: [
            { user: 'alice', score: 5, verified: true },
            { user: 'bob', score: 4, verified: true },
            { user: 'charlie', score: 3, verified: false },
          ], // Complex array objects
        },
        {
          category: 'books',
          price: 50,
          tags: ['used'],
          active: true,
          ratings: [3.8, 4.0, 4.1],
          stock: [
            { location: 'A', count: 10 },
            { location: 'C', count: 30 },
          ],
          reviews: [
            { user: 'dave', score: 4, verified: true },
            { user: 'eve', score: 5, verified: false },
          ],
        },
        { category: 'electronics', price: 75, tags: ['refurbished'], active: false },
        { category: 'books', price: 25, tags: ['used', 'sale'], active: true },
        { category: 'clothing', price: 60, tags: ['new'], active: true },
      ];

      await vectorDB.upsert({ indexName, vectors, metadata });
    });

    afterEach(async () => {
      await vectorDB.deleteIndex(indexName);
    });

    // Numeric Comparison Tests
    describe('Comparison Operators', () => {
      it('should handle numeric string comparisons', async () => {
        // Insert a record with numeric string
        await vectorDB.upsert({ indexName, vectors: [[1, 0.1, 0]], metadata: [{ numericString: '123' }] });

        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { numericString: { $gt: '100' } }, // Compare strings numerically
        });
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]?.metadata?.numericString).toBe('123');
      });

      it('should filter with $gt operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $gt: 75 } },
        });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.price).toBe(100);
      });

      it('should filter with $lte operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $lte: 50 } },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.price).toBeLessThanOrEqual(50);
        });
      });

      it('should filter with lt operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $lt: 60 } },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.price).toBeLessThan(60);
        });
      });

      it('should filter with gte operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $gte: 75 } },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.price).toBeGreaterThanOrEqual(75);
        });
      });

      it('should filter with ne operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $ne: 'electronics' } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).not.toBe('electronics');
        });
      });

      it('should filter with $gt and $lte operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $gt: 70, $lte: 100 } },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.price).toBeGreaterThan(70);
          expect(result.metadata?.price).toBeLessThanOrEqual(100);
        });
      });
    });

    // Array Operator Tests
    describe('Array Operators', () => {
      it('should filter with $in operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $in: ['electronics', 'clothing'] } },
        });
        expect(results).toHaveLength(3);
        results.forEach(result => {
          expect(['electronics', 'clothing']).toContain(result.metadata?.category);
        });
      });

      it('should filter with $nin operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $nin: ['electronics', 'books'] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).not.toContain(result.metadata?.category);
        });
      });

      it('should handle empty arrays in in/nin operators', async () => {
        // Should return no results for empty IN
        const resultsIn = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $in: [] } },
        });
        expect(resultsIn).toHaveLength(0);

        // Should return all results for empty NIN
        const resultsNin = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $nin: [] } },
        });
        expect(resultsNin.length).toBeGreaterThan(0);
      });

      it('should filter with array $contains operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0.1, 0],
          filter: { tags: { $contains: ['new'] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.tags).toContain('new');
        });
      });

      it('should filter with $elemMatch operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {
            tags: {
              $elemMatch: {
                $in: ['new', 'premium'],
              },
            },
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.tags.some(tag => ['new', 'premium'].includes(tag))).toBe(true);
        });
      });

      it('should filter with $elemMatch using equality', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {
            tags: {
              $elemMatch: {
                $eq: 'sale',
              },
            },
          },
        });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.tags).toContain('sale');
      });

      it('should filter with $elemMatch using multiple conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {
            ratings: {
              $elemMatch: {
                $gt: 4,
                $lt: 4.5,
              },
            },
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Array.isArray(result.metadata?.ratings)).toBe(true);
          expect(result.metadata?.ratings.some(rating => rating > 4 && rating < 4.5)).toBe(true);
        });
      });

      it('should handle complex $elemMatch conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {
            stock: {
              $elemMatch: {
                location: 'A',
                count: { $gt: 20 },
              },
            },
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          const matchingStock = result.metadata?.stock.find(s => s.location === 'A' && s.count > 20);
          expect(matchingStock).toBeDefined();
        });
      });

      it('should filter with $elemMatch on nested numeric fields', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {
            reviews: {
              $elemMatch: {
                score: { $gt: 4 },
              },
            },
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.reviews.some(r => r.score > 4)).toBe(true);
        });
      });

      it('should filter with $elemMatch on multiple nested fields', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {
            reviews: {
              $elemMatch: {
                score: { $gte: 4 },
                verified: true,
              },
            },
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.reviews.some(r => r.score >= 4 && r.verified)).toBe(true);
        });
      });

      it('should filter with $elemMatch on exact string match', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {
            reviews: {
              $elemMatch: {
                user: 'alice',
              },
            },
          },
        });
        expect(results).toHaveLength(1);
        expect(results[0].metadata?.reviews.some(r => r.user === 'alice')).toBe(true);
      });

      it('should handle $elemMatch with no matches', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {
            reviews: {
              $elemMatch: {
                score: 10, // No review has score 10
              },
            },
          },
        });
        expect(results).toHaveLength(0);
      });

      it('should filter with $all operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $all: ['used', 'sale'] } },
        });
        expect(results).toHaveLength(1);
        results.forEach(result => {
          expect(result.metadata?.tags).toContain('used');
          expect(result.metadata?.tags).toContain('sale');
        });
      });

      it('should filter with $all using single value', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $all: ['new'] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.tags).toContain('new');
        });
      });

      it('should handle empty array for $all', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $all: [] } },
        });
        expect(results).toHaveLength(0);
      });

      it('should handle non-array field $all', async () => {
        // First insert a record with non-array field
        await vectorDB.upsert({
          indexName,
          vectors: [[1, 0.1, 0]],
          metadata: [{ tags: 'not-an-array' }],
        });

        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $all: ['value'] } },
        });
        expect(results).toHaveLength(0);
      });

      // Contains Operator Tests
      it('should filter with contains operator for exact field match', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0.1, 0],
          filter: { category: { $contains: 'electronics' } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
        });
      });

      it('should filter with $contains operator for nested objects', async () => {
        // First insert a record with nested object
        await vectorDB.upsert({
          indexName,
          vectors: [[1, 0.1, 0]],
          metadata: [
            {
              details: { color: 'red', size: 'large' },
              category: 'clothing',
            },
          ],
        });

        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0.1, 0],
          filter: { details: { $contains: { color: 'red' } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.details.color).toBe('red');
        });
      });

      // String Pattern Tests
      it('should handle exact string matches', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: 'electronics' },
        });
        expect(results).toHaveLength(2);
      });

      it('should handle case-sensitive string matches', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: 'ELECTRONICS' },
        });
        expect(results).toHaveLength(0);
      });
      it('should filter arrays by size', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { ratings: { $size: 3 } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.ratings).toHaveLength(3);
        });

        const noResults = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { ratings: { $size: 10 } },
        });
        expect(noResults).toHaveLength(0);
      });

      it('should handle $size with nested arrays', async () => {
        await vectorDB.upsert({
          indexName,
          vectors: [[1, 0.1, 0]],
          metadata: [{ nested: { array: [1, 2, 3, 4] } }],
        });
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { 'nested.array': { $size: 4 } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.nested.array).toHaveLength(4);
        });
      });
    });

    // Logical Operator Tests
    describe('Logical Operators', () => {
      it('should handle AND filter conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $and: [{ category: { $eq: 'electronics' } }, { price: { $gt: 75 } }] },
        });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.category).toBe('electronics');
        expect(results[0]?.metadata?.price).toBeGreaterThan(75);
      });

      it('should handle OR filter conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $or: [{ category: { $eq: 'electronics' } }, { category: { $eq: 'books' } }] },
        });
        expect(results.length).toBeGreaterThan(1);
        results.forEach(result => {
          expect(['electronics', 'books']).toContain(result?.metadata?.category);
        });
      });

      it('should handle $not operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $not: { category: 'electronics' } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).not.toBe('electronics');
        });
      });

      it('should handle $nor operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $nor: [{ category: 'electronics' }, { category: 'books' }] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).not.toContain(result.metadata?.category);
        });
      });

      it('should handle nested $not with $or', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $not: { $or: [{ category: 'electronics' }, { category: 'books' }] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).not.toContain(result.metadata?.category);
        });
      });

      it('should handle $not with comparison operators', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $not: { $gt: 100 } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeLessThanOrEqual(100);
        });
      });

      it('should handle $not with $in operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $not: { $in: ['electronics', 'books'] } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).not.toContain(result.metadata?.category);
        });
      });

      it('should handle $not with multiple nested conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $not: { $and: [{ category: 'electronics' }, { price: { $gt: 50 } }] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category !== 'electronics' || result.metadata?.price <= 50).toBe(true);
        });
      });

      it('should handle $not with $exists operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $not: { $exists: true } } },
        });
        expect(results.length).toBe(0); // All test data has tags
      });

      it('should handle $not with array operators', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $not: { $all: ['new', 'premium'] } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(!result.metadata?.tags.includes('new') || !result.metadata?.tags.includes('premium')).toBe(true);
        });
      });

      it('should handle $not with complex nested conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {
            $not: {
              $or: [
                { $and: [{ category: 'electronics' }, { price: { $gt: 90 } }] },
                { $and: [{ category: 'books' }, { price: { $lt: 30 } }] },
              ],
            },
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          const notExpensiveElectronics = !(result.metadata?.category === 'electronics' && result.metadata?.price > 90);
          const notCheapBooks = !(result.metadata?.category === 'books' && result.metadata?.price < 30);
          expect(notExpensiveElectronics && notCheapBooks).toBe(true);
        });
      });

      it('should handle $not with empty arrays', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $not: { $in: [] } } },
        });
        expect(results.length).toBeGreaterThan(0); // Should match all records
      });

      it('should handle $not with null values', async () => {
        // First insert a record with null value
        await vectorDB.upsert({
          indexName,
          vectors: [[1, 0.1, 0]],
          metadata: [{ category: null, price: 0 }],
        });

        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $not: { $eq: null } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).not.toBeNull();
        });
      });

      it('should handle $not with boolean values', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { active: { $not: { $eq: true } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.active).not.toBe(true);
        });
      });

      it('should handle $not with multiple conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $not: { category: 'electronics', price: { $gt: 50 } } },
        });
        expect(results.length).toBeGreaterThan(0);
      });

      it('should handle $not with $not operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $not: { $not: { category: 'electronics' } } },
        });
        expect(results.length).toBeGreaterThan(0);
      });

      it('should handle $not in nested fields', async () => {
        await vectorDB.upsert({
          indexName,
          vectors: [[1, 0.1, 0]],
          metadata: [{ user: { profile: { price: 10 } } }],
        });
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { 'user.profile.price': { $not: { $gt: 25 } } },
        });
        expect(results.length).toBe(1);
      });

      it('should handle $not with multiple operators', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $not: { $gte: 30, $lte: 70 } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          const price = Number(result.metadata?.price);
          expect(price < 30 || price > 70).toBe(true);
        });
      });

      it('should handle $not with comparison operators', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $not: { $gt: 100 } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeLessThanOrEqual(100);
        });
      });

      it('should handle $not with $and', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $not: { $and: [{ category: 'electronics' }, { price: { $gt: 50 } }] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category !== 'electronics' || result.metadata?.price <= 50).toBe(true);
        });
      });

      it('should handle $nor with $or', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $nor: [{ $or: [{ category: 'electronics' }, { category: 'books' }] }, { price: { $gt: 75 } }] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).not.toContain(result.metadata?.category);
          expect(result.metadata?.price).toBeLessThanOrEqual(75);
        });
      });

      it('should handle $nor with nested $and conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {
            $nor: [
              { $and: [{ category: 'electronics' }, { active: true }] },
              { $and: [{ category: 'books' }, { price: { $lt: 30 } }] },
            ],
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          const notElectronicsActive = !(
            result.metadata?.category === 'electronics' && result.metadata?.active === true
          );
          const notBooksLowPrice = !(result.metadata?.category === 'books' && result.metadata?.price < 30);
          expect(notElectronicsActive && notBooksLowPrice).toBe(true);
        });
      });

      it('should handle nested $and with $or and $not', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {
            $and: [{ $or: [{ category: 'electronics' }, { category: 'books' }] }, { $not: { price: { $lt: 50 } } }],
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).toContain(result.metadata?.category);
          expect(result.metadata?.price).toBeGreaterThanOrEqual(50);
        });
      });

      it('should handle $or with multiple $not conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $or: [{ $not: { category: 'electronics' } }, { $not: { price: { $gt: 50 } } }] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category !== 'electronics' || result.metadata?.price <= 50).toBe(true);
        });
      });
    });

    // Edge Cases and Special Values
    describe('Edge Cases and Special Values', () => {
      it('should handle empty result sets with valid filters', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $gt: 1000 } },
        });
        expect(results).toHaveLength(0);
      });

      it('should throw error for invalid operator', async () => {
        await expect(
          vectorDB.query({
            indexName,
            queryVector: [1, 0, 0],
            filter: { price: { $invalid: 100 } },
          }),
        ).rejects.toThrow('Unsupported operator: $invalid');
      });

      it('should handle empty filter object', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {},
        });
        expect(results.length).toBeGreaterThan(0);
      });

      it('should handle numeric string comparisons', async () => {
        await vectorDB.upsert({
          indexName,
          vectors: [[1, 0.1, 0]],
          metadata: [{ numericString: '123' }],
        });
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { numericString: { $gt: '100' } },
        });
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]?.metadata?.numericString).toBe('123');
      });
    });

    // Score Threshold Tests
    describe('Score Threshold', () => {
      it('should respect minimum score threshold', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: 'electronics' },
          includeVector: false,
          minScore: 0.9,
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.score).toBeGreaterThan(0.9);
        });
      });
    });

    describe('Edge Cases and Special Values', () => {
      // Additional Edge Cases
      it('should handle empty result sets with valid filters', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $gt: 1000 } },
        });
        expect(results).toHaveLength(0);
      });

      it('should handle empty filter object', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {},
        });
        expect(results.length).toBeGreaterThan(0);
      });

      it('should handle non-existent field', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { nonexistent: { $elemMatch: { $eq: 'value' } } },
        });
        expect(results).toHaveLength(0);
      });

      it('should handle non-existent values', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $elemMatch: { $eq: 'nonexistent-tag' } } },
        });
        expect(results).toHaveLength(0);
      });
      // Empty Conditions Tests
      it('should handle empty conditions in logical operators', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $and: [], category: 'electronics' },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
        });
      });

      it('should handle empty $and conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $and: [], category: 'electronics' },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
        });
      });

      it('should handle empty $or conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $or: [], category: 'electronics' },
        });
        expect(results).toHaveLength(0);
      });

      it('should handle empty $nor conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $nor: [], category: 'electronics' },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
        });
      });

      it('should handle empty $not conditions', async () => {
        await expect(
          vectorDB.query({
            indexName,
            queryVector: [1, 0, 0],
            filter: { $not: {}, category: 'electronics' },
          }),
        ).rejects.toThrow('$not operator cannot be empty');
      });

      it('should handle multiple empty logical operators', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $and: [], $or: [], $nor: [], category: 'electronics' },
        });
        expect(results).toHaveLength(0);
      });

      // Nested Field Tests
      it('should handle deeply nested metadata paths', async () => {
        await vectorDB.upsert({
          indexName,
          vectors: [[1, 0.1, 0]],
          metadata: [
            {
              level1: {
                level2: {
                  level3: 'deep value',
                },
              },
            },
          ],
        });

        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { 'level1.level2.level3': 'deep value' },
        });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.level1?.level2?.level3).toBe('deep value');
      });

      it('should handle non-existent nested paths', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { 'nonexistent.path': 'value' },
        });
        expect(results).toHaveLength(0);
      });

      // Score Threshold Tests
      it('should respect minimum score threshold', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: 'electronics' },
          includeVector: false,
          minScore: 0.9,
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.score).toBeGreaterThan(0.9);
        });
      });

      // Complex Nested Operators Test
      it('should handle deeply nested logical operators', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {
            $and: [
              { $or: [{ category: 'electronics' }, { $and: [{ category: 'books' }, { price: { $lt: 30 } }] }] },
              { $not: { $or: [{ active: false }, { price: { $gt: 100 } }] } },
            ],
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          // First condition: electronics OR (books AND price < 30)
          const firstCondition =
            result.metadata?.category === 'electronics' ||
            (result.metadata?.category === 'books' && result.metadata?.price < 30);

          // Second condition: NOT (active = false OR price > 100)
          const secondCondition = result.metadata?.active !== false && result.metadata?.price <= 100;

          expect(firstCondition && secondCondition).toBe(true);
        });
      });

      it('should throw error for invalid operator', async () => {
        await expect(
          vectorDB.query({
            indexName,
            queryVector: [1, 0, 0],
            filter: { price: { $invalid: 100 } },
          }),
        ).rejects.toThrow('Unsupported operator: $invalid');
      });

      it('should handle multiple logical operators at root level', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {
            $and: [{ category: 'electronics' }],
            $or: [{ price: { $lt: 100 } }, { price: { $gt: 20 } }],
            $nor: [],
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
          expect(result.metadata?.price < 100 || result.metadata?.price > 20).toBe(true);
        });
      });

      it('should handle non-array field with $elemMatch', async () => {
        // First insert a record with non-array field
        await vectorDB.upsert({
          indexName,
          vectors: [[1, 0.1, 0]],
          metadata: [{ tags: 'not-an-array' }],
        });

        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $elemMatch: { $eq: 'value' } } },
        });
        expect(results).toHaveLength(0); // Should return no results for non-array field
      });
      it('should handle undefined filter', async () => {
        const results1 = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: undefined,
        });
        const results2 = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
        });
        expect(results1).toEqual(results2);
        expect(results1.length).toBeGreaterThan(0);
      });

      it('should handle empty object filter', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {},
        });
        const results2 = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
        });
        expect(results).toEqual(results2);
        expect(results.length).toBeGreaterThan(0);
      });

      it('should handle null filter', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: null,
        });
        const results2 = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
        });
        expect(results).toEqual(results2);
        expect(results.length).toBeGreaterThan(0);
      });
    });

    // Regex Operator Tests
    // describe('Regex Operators', () => {
    //   //   // it('should handle $not with regex', async () => {
    //   //   //   const results = await vectorDB.query(indexName, [1, 0, 0], 10, {
    //   //   //     category: { $not: { $regex: '^elect' } },
    //   //   //   });
    //   //   //   expect(results.length).toBeGreaterThan(0);
    //   //   //   results.forEach(result => {
    //   //   //     expect(result.metadata?.category).not.toMatch(/^elect/);
    //   //   //   });
    //   //   // });
    //   // Regex operator tests
    //   // it('should handle basic regex patterns', async () => {
    //   //   const results = await vectorDB.query(indexName, [1, 0, 0], 10, {
    //   //     category: { $regex: 'elect.*' },
    //   //   });
    //   //   expect(results).toHaveLength(2);
    //   // });
    //   // it('should handle case sensitivity', async () => {
    //   //   const results = await vectorDB.query(indexName, [1, 0, 0], 10, {
    //   //     category: { $regex: 'ELECTRONICS' },
    //   //   });
    //   //   expect(results).toHaveLength(0); // Case sensitive by default
    //   //   const iResults = await vectorDB.query(indexName, [1, 0, 0], 10, {
    //   //     category: { $regex: 'ELECTRONICS', $options: 'i' },
    //   //   });
    //   //   expect(iResults).toHaveLength(2); // Case insensitive
    //   // });
    //   // it('should handle start/end anchors', async () => {
    //   //   const startResults = await vectorDB.query(indexName, [1, 0, 0], 10, {
    //   //     category: { $regex: '^elect' },
    //   //   });
    //   //   expect(startResults).toHaveLength(2);
    //   //   const endResults = await vectorDB.query(indexName, [1, 0, 0], 10, {
    //   //     category: { $regex: 'nics$' },
    //   //   });
    //   //   expect(endResults).toHaveLength(2);
    //   // });
    //   // it('should handle multiline flag', async () => {
    //   //   // First insert a record with multiline text
    //   //   await vectorDB.upsert(
    //   //   //     indexName,
    //   //   //     [[1, 0.1, 0]],
    //   //   //     [
    //   //   //       {
    //   //   //         description: 'First line\nSecond line\nThird line',
    //   //   //       },
    //   //   //     ],
    //   //   //   );
    //   //   //   const results = await vectorDB.query(indexName, [1, 0, 0], 10, {
    //   //   //     description: { $regex: '^Second', $options: 'm' },
    //   //   //   });
    //   //   //   expect(results).toHaveLength(1);
    //   //   // });
    //   // it('should handle multiline regex patterns', async () => {
    //   //   await vectorDB.upsert(
    //   //   //     indexName,
    //   //   //     [[1, 0.1, 0]],
    //   //   //     [
    //   //   //       {
    //   //   //         description: 'First line\nSecond line\nThird line',
    //   //   //       },
    //   //   //     ],
    //   //   //   );
    //   //   //   // Test without multiline flag
    //   //   //   const withoutM = await vectorDB.query(indexName, [1, 0, 0], 10, {
    //   //   //     description: { $regex: '^Second' },
    //   //   //   });
    //   //   //   expect(withoutM).toHaveLength(0); // Won't match "Second" at start of line
    //   //   // Test with multiline flag
    //   //   //   const withM = await vectorDB.query(indexName, [1, 0, 0], 10, {
    //   //   //     description: { $regex: '^Second', $options: 'm' },
    //   //   //   });
    //   //   //   expect(withM).toHaveLength(1); // Will match "Second" at start of any line
    //   //   // });
    //   // });
    //   // it('should handle dotall flag', async () => {
    //   //   await vectorDB.upsert(
    //   //     indexName,
    //   //     [[1, 0.1, 0]],
    //   //     [
    //   //       {
    //   //         description: 'First\nSecond\nThird',
    //   //       },
    //   //     ],
    //   //   );
    //   //   // Test with a more complex pattern that demonstrates s flag behavior
    //   //   const withoutS = await vectorDB.query(indexName, [1, 0, 0], 10, {
    //   //   //     description: { $regex: 'First[^\\n]*Third' },
    //   //   //   });
    //   //   //   expect(withoutS).toHaveLength(0); // Won't match across lines without s flag
    //   //   //   const withS = await vectorDB.query(indexName, [1, 0, 0], 10, {
    //   //   //     description: { $regex: 'First.*Third', $options: 's' },
    //   //   //   });
    //   //   //   expect(withS).toHaveLength(1); // Matches across lines with s flag
    //   //   // });
    //   // });
    //   // it('should handle extended flag', async () => {
    //   //   const results = await vectorDB.query(indexName, [1, 0, 0], 10, {
    //   //     category: { $regex: 'elect # start\nronics # end', $options: 'x' },
    //   //   });
    //   //   expect(results).toHaveLength(2); // x flag allows comments and whitespace
    //   // });
    //   // it('should handle flag combinations', async () => {
    //   //   await vectorDB.upsert(
    //   //     indexName,
    //   //     [[1, 0.1, 0]],
    //   //     [
    //   //       {
    //   //         description: 'FIRST line\nSECOND line',
    //   //       },
    //   //     ],
    //   //   );
    //   //   // Test case-insensitive and multiline flags together
    //   //   const results = await vectorDB.query(indexName, [1, 0, 0], 10, {
    //   //   //     description: {
    //   //   //       $regex: '^first',
    //   //   //       $options: 'im', // Case-insensitive and multiline
    //   //   //     },
    //   //   //   });
    //   //   //   expect(results).toHaveLength(1);
    //   //   // Test with second line
    //   //   const secondResults = await vectorDB.query(indexName, [1, 0, 0], 10, {
    //   //   //     description: {
    //   //   //       $regex: '^second',
    //   //   //       $options: 'im',
    //   //   //     },
    //   //   //   });
    //   //   //   expect(secondResults).toHaveLength(1);
    //   //   // });
    // it('should handle case insensitive flag (i)', async () => {
    //   const results = await vectorDB.query(indexName, [1, 0, 0], 10, {
    //     category: { $regex: 'ELECTRONICS', $options: 'i' },
    //   });
    //   expect(results.length).toBeGreaterThan(0);
    // });

    // it('should handle multiline flag (m)', async () => {
    //   const results = await vectorDB.query(indexName, [1, 0, 0], 10, {
    //     description: { $regex: '^start', $options: 'm' },
    //   });
    //   expect(results.length).toBeGreaterThan(0);
    // });

    // it('should handle extended flag (x)', async () => {
    //   const results = await vectorDB.query(indexName, [1, 0, 0], 10, {
    //     category: {
    //       $regex: 'elect # match electronics\nronics',
    //       $options: 'x',
    //     },
    //   });
    //   expect(results.length).toBeGreaterThan(0);
    // });

    // it('should handle multiple flags', async () => {
    //   const results = await vectorDB.query(indexName, [1, 0, 0], 10, {
    //     category: {
    //       $regex: 'ELECTRONICS\nITEM',
    //       $options: 'im',
    //     },
    //   });
    //   expect(results.length).toBeGreaterThan(0);
    // });
    // it('should handle special regex characters as literals', async () => {
    //   await vectorDB.upsert(
    //     indexName,
    //     [[1, 0.1, 0]],
    //     [
    //       {
    //         special: 'text.with*special(chars)',
    //       },
    //     ],
    //   );

    //   const results = await vectorDB.query(indexName, [1, 0, 0], 10, {
    //     special: 'text.with*special(chars)',
    //   });
    //   expect(results).toHaveLength(1); // Exact match, not regex
    // });
    // it('should handle $not with $regex operator', async () => {
    //   const results = await vectorDB.query(indexName, [1, 0, 0], 10, {
    //     category: { $not: { $regex: '^elect' } },
    //   });
    //   expect(results.length).toBeGreaterThan(0);
    //   results.forEach(result => {
    //     expect(result.metadata?.category).not.toMatch(/^elect/);
    //   });
    // });

    // });
  });

  describe('Deprecation Warnings', () => {
    const indexName = 'testdeprecationwarnings';

    const indexName2 = 'testdeprecationwarnings2';

    let warnSpy;

    beforeAll(async () => {
      await vectorDB.createIndex({ indexName: indexName, dimension: 3 });
    });

    afterAll(async () => {
      await vectorDB.deleteIndex(indexName);
      await vectorDB.deleteIndex(indexName2);
    });

    beforeEach(async () => {
      warnSpy = vi.spyOn(vectorDB['logger'], 'warn');
    });

    afterEach(async () => {
      warnSpy.mockRestore();
      await vectorDB.deleteIndex(indexName2);
    });

    it('should show deprecation warning when using individual args for createIndex', async () => {
      await vectorDB.createIndex(indexName2, 3, 'cosine');

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Deprecation Warning: Passing individual arguments to createIndex() is deprecated'),
      );
    });

    it('should show deprecation warning when using individual args for upsert', async () => {
      await vectorDB.upsert(indexName, [[1, 2, 3]], [{ test: 'data' }]);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Deprecation Warning: Passing individual arguments to upsert() is deprecated'),
      );
    });

    it('should show deprecation warning when using individual args for query', async () => {
      await vectorDB.query(indexName, [1, 2, 3], 5);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Deprecation Warning: Passing individual arguments to query() is deprecated'),
      );
    });

    it('should not show deprecation warning when using object param for query', async () => {
      await vectorDB.query({
        indexName,
        queryVector: [1, 2, 3],
        topK: 5,
      });

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should not show deprecation warning when using object param for createIndex', async () => {
      await vectorDB.createIndex({
        indexName: indexName2,
        dimension: 3,
        metric: 'cosine',
      });

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should not show deprecation warning when using object param for upsert', async () => {
      await vectorDB.upsert({
        indexName,
        vectors: [[1, 2, 3]],
        metadata: [{ test: 'data' }],
      });

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should maintain backward compatibility with individual args', async () => {
      // Query
      const queryResults = await vectorDB.query(indexName, [1, 2, 3], 5);
      expect(Array.isArray(queryResults)).toBe(true);

      // CreateIndex
      await expect(vectorDB.createIndex(indexName2, 3, 'cosine')).resolves.not.toThrow();

      // Upsert
      const upsertResults = await vectorDB.upsert({
        indexName,
        vectors: [[1, 2, 3]],
        metadata: [{ test: 'data' }],
      });
      expect(Array.isArray(upsertResults)).toBe(true);
      expect(upsertResults).toHaveLength(1);
    });
  });
});
