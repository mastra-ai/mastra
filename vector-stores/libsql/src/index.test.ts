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

  // Index Management Tests
  describe('Index Management', () => {
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

  // Vector Operations Tests
  describe('Vector Operations', () => {
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

    describe('Basic Query Operations', () => {
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
  });

  // Advanced Query and Filter Tests
  describe('Advanced Query and Filter Operations', () => {
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

      // Numeric Comparison Tests
      it('should filter with $gt operator', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          price: { $gt: 75 },
        });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.price).toBe(100);
      });

      it('should filter with $lte operator', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          price: { $lte: 50 },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.price).toBeLessThanOrEqual(50);
        });
      });

      it('should filter with lt operator', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          price: { $lt: 60 },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.price).toBeLessThan(60);
        });
      });

      it('should filter with gte operator', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          price: { $gte: 75 },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.price).toBeGreaterThanOrEqual(75);
        });
      });

      it('should filter with ne operator', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          category: { $ne: 'electronics' },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).not.toBe('electronics');
        });
      });

      // Array Operation Tests
      it('should filter with $in operator', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          category: { $in: ['electronics', 'clothing'] },
        });
        expect(results).toHaveLength(3);
        results.forEach(result => {
          expect(['electronics', 'clothing']).toContain(result.metadata?.category);
        });
      });

      it('should filter with $nin operator', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          category: { $nin: ['electronics', 'books'] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).not.toContain(result.metadata?.category);
        });
      });

      it('should handle empty arrays in in/nin operators', async () => {
        // Should return no results for empty IN
        const resultsIn = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          category: { $in: [] },
        });
        expect(resultsIn).toHaveLength(0);

        // Should return all results for empty NIN
        const resultsNin = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          category: { $nin: [] },
        });
        expect(resultsNin.length).toBeGreaterThan(0);
      });

      it('should filter with array $contains operator', async () => {
        const results = await libsqlVector.query(indexName, [1, 0.1, 0], 10, {
          tags: { $contains: ['new'] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.tags).toContain('new');
        });
      });

      it('should filter with $elemMatch operator', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          tags: { $elemMatch: ['new', 'premium'] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.tags.some(tag => ['new', 'premium'].includes(tag))).toBe(true);
        });
      });

      it('should filter with $elemMatch using single value', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          tags: { $elemMatch: 'sale' },
        });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.tags).toContain('sale');
      });

      it('should filter with $elemMatch using multiple values', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          tags: { $elemMatch: ['sale', 'new'] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.tags.some(tag => ['sale', 'new'].includes(tag))).toBe(true);
        });
      });

      it('should handle empty array for $elemMatch', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          tags: { $elemMatch: [] },
        });
        expect(results).toHaveLength(0);
      });

      it('should handle non-array field $elemMatch', async () => {
        // First insert a record with non-array field
        await libsqlVector.upsert(indexName, [[1, 0.1, 0]], [{ tags: 'not-an-array' }]);

        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          tags: { $elemMatch: ['value'] },
        });
        expect(results).toHaveLength(0);
      });

      it('should handle null values in array', async () => {
        // First insert a record with null in array
        await libsqlVector.upsert(indexName, [[1, 0.1, 0]], [{ tags: ['valid', null] }]);

        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          tags: { $elemMatch: ['valid'] },
        });
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]?.metadata?.tags).toContain('valid');
      });

      it('should filter with $all operator', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          tags: { $all: ['used', 'sale'] },
        });
        expect(results).toHaveLength(1);
        results.forEach(result => {
          expect(result.metadata?.tags).toContain('used');
          expect(result.metadata?.tags).toContain('sale');
        });
      });

      it('should filter with $all using single value', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          tags: { $all: ['new'] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.tags).toContain('new');
        });
      });

      it('should handle empty array for $all', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          tags: { $all: [] },
        });
        expect(results).toHaveLength(0);
      });

      it('should handle non-array field $all', async () => {
        // First insert a record with non-array field
        await libsqlVector.upsert(indexName, [[1, 0.1, 0]], [{ tags: 'not-an-array' }]);

        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          tags: { $all: ['value'] },
        });
        expect(results).toHaveLength(0);
      });

      // Contains Operator Tests
      it('should filter with contains operator for exact field match', async () => {
        const results = await libsqlVector.query(indexName, [1, 0.1, 0], 10, {
          category: { $contains: 'electronics' },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
        });
      });

      it('should filter with $contains operator for nested objects', async () => {
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
          details: { $contains: { color: 'red' } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.details.color).toBe('red');
        });
      });

      // String Pattern Tests
      it('should handle exact string matches', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          category: 'electronics',
        });
        expect(results).toHaveLength(2);
      });

      it('should handle case-sensitive string matches', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          category: 'ELECTRONICS',
        });
        expect(results).toHaveLength(0);
      });

      it('should handle numeric string comparisons', async () => {
        // Insert a record with numeric string
        await libsqlVector.upsert(indexName, [[1, 0.1, 0]], [{ numericString: '123' }]);

        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          numericString: { $gt: '100' }, // Compare strings numerically
        });
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]?.metadata?.numericString).toBe('123');
      });

      // Additional Logical Operator Tests
      it('should handle $not operator', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          $not: { category: 'electronics' },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).not.toBe('electronics');
        });
      });

      it('should handle $not with comparison operators', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          price: { $not: { $gt: 100 } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeLessThanOrEqual(100);
        });
      });

      it('should handle $not with $in operator', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          category: { $not: { $in: ['electronics', 'books'] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).not.toContain(result.metadata?.category);
        });
      });

      it('should handle nested $not with $or', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          $not: {
            $or: [{ category: 'electronics' }, { category: 'books' }],
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).not.toContain(result.metadata?.category);
        });
      });

      it('should handle $not with $and', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          $not: {
            $and: [{ category: 'electronics' }, { price: { $gt: 50 } }],
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category !== 'electronics' || result.metadata?.price <= 50).toBe(true);
        });
      });

      it('should handle $nor operator', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          $nor: [{ category: 'electronics' }, { category: 'books' }],
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).not.toContain(result.metadata?.category);
        });
      });

      it('should handle $nor with $or', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          $nor: [{ $or: [{ category: 'electronics' }, { category: 'books' }] }, { price: { $gt: 75 } }],
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).not.toContain(result.metadata?.category);
          expect(result.metadata?.price).toBeLessThanOrEqual(75);
        });
      });

      it('should handle $nor with nested $and conditions', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          $nor: [
            { $and: [{ category: 'electronics' }, { active: true }] },
            { $and: [{ category: 'books' }, { price: { $lt: 30 } }] },
          ],
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
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          $and: [{ $or: [{ category: 'electronics' }, { category: 'books' }] }, { $not: { price: { $lt: 50 } } }],
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).toContain(result.metadata?.category);
          expect(result.metadata?.price).toBeGreaterThanOrEqual(50);
        });
      });

      it('should handle $or with multiple $not conditions', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          $or: [{ $not: { category: 'electronics' } }, { $not: { price: { $gt: 50 } } }],
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category !== 'electronics' || result.metadata?.price <= 50).toBe(true);
        });
      });

      // Additional Edge Cases
      it('should handle empty result sets with valid filters', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          price: { $gt: 1000 },
        });
        expect(results).toHaveLength(0);
      });

      it('should handle empty filter object', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {});
        expect(results.length).toBeGreaterThan(0);
      });

      it('should handle non-existent field', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          nonexistent: { $elemMatch: ['value'] },
        });
        expect(results).toHaveLength(0);
      });

      it('should handle non-existent values', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          tags: { $elemMatch: ['nonexistent'] },
        });
        expect(results).toHaveLength(0);
      });

      // Empty Conditions Tests
      it('should handle empty conditions in logical operators', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          $and: [],
          category: 'electronics',
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
        });
      });

      it('should handle empty $and conditions', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          $and: [],
          category: 'electronics',
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
        });
      });

      it('should handle empty $or conditions', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          $or: [],
          category: 'electronics',
        });
        expect(results).toHaveLength(0);
      });

      it('should handle empty $nor conditions', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          $nor: [],
          category: 'electronics',
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
        });
      });

      it('should handle empty $not conditions', async () => {
        await expect(
          libsqlVector.query(indexName, [1, 0, 0], 10, {
            $not: {},
            category: 'electronics',
          }),
        ).rejects.toThrow('$not operator cannot be empty');
      });

      it('should handle multiple empty logical operators', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          $and: [],
          $or: [],
          $nor: [],
          category: 'electronics',
        });
        expect(results).toHaveLength(0);
      });

      // Nested Field Tests
      it('should handle deeply nested metadata paths', async () => {
        await libsqlVector.upsert(
          indexName,
          [[1, 0.1, 0]],
          [
            {
              level1: {
                level2: {
                  level3: 'deep value',
                },
              },
            },
          ],
        );

        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          'level1.level2.level3': 'deep value',
        });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.level1?.level2?.level3).toBe('deep value');
      });

      it('should handle non-existent nested paths', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          'nonexistent.path': 'value',
        });
        expect(results).toHaveLength(0);
      });

      // Score Threshold Tests
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

      // Complex Nested Operators Test
      it('should handle deeply nested logical operators', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          $and: [
            {
              $or: [{ category: 'electronics' }, { $and: [{ category: 'books' }, { price: { $lt: 30 } }] }],
            },
            {
              $not: {
                $or: [{ active: false }, { price: { $gt: 100 } }],
              },
            },
          ],
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
          libsqlVector.query(indexName, [1, 0, 0], 10, {
            price: { $invalid: 100 },
          }),
        ).rejects.toThrow('Unsupported operator: $invalid');
      });

      it('should handle multiple logical operators at root level', async () => {
        const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
          $and: [{ category: 'electronics' }],
          $or: [{ price: { $lt: 100 } }, { price: { $gt: 20 } }],
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
          expect(result.metadata?.price < 100 || result.metadata?.price > 20).toBe(true);
        });
      });
    });
  });

  describe('$not operator', () => {
    const indexName = 'test_query_5';
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

    it('should handle $not with comparison operators', async () => {
      const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
        price: { $not: { $gt: 100 } },
      });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(Number(result.metadata?.price)).toBeLessThanOrEqual(100);
      });
    });

    it('should handle $not with $in operator', async () => {
      const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
        category: { $not: { $in: ['electronics', 'books'] } },
      });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(['electronics', 'books']).not.toContain(result.metadata?.category);
      });
    });
    it('should handle $not with multiple operators', async () => {
      const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
        price: { $not: { $gte: 30, $lte: 70 } },
      });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        const price = Number(result.metadata?.price);
        expect(price < 30 || price > 70).toBe(true);
      });
    });
  });

  // Commented out tests preserved at the bottom
  // describe('regex tests', () => {
  //   //   // it('should handle $not with regex', async () => {
  //   //   //   const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
  //   //   //     category: { $not: { $regex: '^elect' } },
  //   //   //   });
  //   //   //   expect(results.length).toBeGreaterThan(0);
  //   //   //   results.forEach(result => {
  //   //   //     expect(result.metadata?.category).not.toMatch(/^elect/);
  //   //   //   });
  //   //   // });
  //   // Regex operator tests
  //   // it('should handle basic regex patterns', async () => {
  //   //   const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
  //   //     category: { $regex: 'elect.*' },
  //   //   });
  //   //   expect(results).toHaveLength(2);
  //   // });
  //   // it('should handle case sensitivity', async () => {
  //   //   const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
  //   //     category: { $regex: 'ELECTRONICS' },
  //   //   });
  //   //   expect(results).toHaveLength(0); // Case sensitive by default
  //   //   const iResults = await libsqlVector.query(indexName, [1, 0, 0], 10, {
  //   //     category: { $regex: 'ELECTRONICS', $options: 'i' },
  //   //   });
  //   //   expect(iResults).toHaveLength(2); // Case insensitive
  //   // });
  //   // it('should handle start/end anchors', async () => {
  //   //   const startResults = await libsqlVector.query(indexName, [1, 0, 0], 10, {
  //   //     category: { $regex: '^elect' },
  //   //   });
  //   //   expect(startResults).toHaveLength(2);
  //   //   const endResults = await libsqlVector.query(indexName, [1, 0, 0], 10, {
  //   //     category: { $regex: 'nics$' },
  //   //   });
  //   //   expect(endResults).toHaveLength(2);
  //   // });
  //   // it('should handle multiline flag', async () => {
  //   //   // First insert a record with multiline text
  //   //   await libsqlVector.upsert(
  //   //     indexName,
  //   //     [[1, 0.1, 0]],
  //   //     [
  //   //       {
  //   //         description: 'First line\nSecond line\nThird line',
  //   //       },
  //   //     ],
  //   //   );
  //   //   const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
  //   //     description: { $regex: '^Second', $options: 'm' },
  //   //   });
  //   //   expect(results).toHaveLength(1);
  //   // });
  //   // it('should handle multiline regex patterns', async () => {
  //   //   await libsqlVector.upsert(
  //   //     indexName,
  //   //     [[1, 0.1, 0]],
  //   //     [
  //   //       {
  //   //         description: 'First line\nSecond line\nThird line',
  //   //       },
  //   //     ],
  //   //   );
  //   //   // Test without multiline flag
  //   //   const withoutM = await libsqlVector.query(indexName, [1, 0, 0], 10, {
  //   //     description: { $regex: '^Second' },
  //   //   });
  //   //   expect(withoutM).toHaveLength(0); // Won't match "Second" at start of line
  //   //   // Test with multiline flag
  //   //   const withM = await libsqlVector.query(indexName, [1, 0, 0], 10, {
  //   //     description: { $regex: '^Second', $options: 'm' },
  //   //   });
  //   //   expect(withM).toHaveLength(1); // Will match "Second" at start of any line
  //   // });
  //   // it('should handle dotall flag', async () => {
  //   //   await libsqlVector.upsert(
  //   //     indexName,
  //   //     [[1, 0.1, 0]],
  //   //     [
  //   //       {
  //   //         description: 'First\nSecond\nThird',
  //   //       },
  //   //     ],
  //   //   );
  //   //   // Test with a more complex pattern that demonstrates s flag behavior
  //   //   const withoutS = await libsqlVector.query(indexName, [1, 0, 0], 10, {
  //   //     description: { $regex: 'First[^\\n]*Third' },
  //   //   });
  //   //   expect(withoutS).toHaveLength(0); // Won't match across lines without s flag
  //   //   const withS = await libsqlVector.query(indexName, [1, 0, 0], 10, {
  //   //     description: { $regex: 'First.*Third', $options: 's' },
  //   //   });
  //   //   expect(withS).toHaveLength(1); // Matches across lines with s flag
  //   // });
  //   // it('should handle extended flag', async () => {
  //   //   const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
  //   //     category: { $regex: 'elect # start\nronics # end', $options: 'x' },
  //   //   });
  //   //   expect(results).toHaveLength(2); // x flag allows comments and whitespace
  //   // });
  //   // it('should handle flag combinations', async () => {
  //   //   await libsqlVector.upsert(
  //   //     indexName,
  //   //     [[1, 0.1, 0]],
  //   //     [
  //   //       {
  //   //         description: 'FIRST line\nSECOND line',
  //   //       },
  //   //     ],
  //   //   );
  //   //   // Test case-insensitive and multiline flags together
  //   //   const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
  //   //     description: {
  //   //       $regex: '^first',
  //   //       $options: 'im', // Case-insensitive and multiline
  //   //     },
  //   //   });
  //   //   expect(results).toHaveLength(1);
  //   //   // Test with second line
  //   //   const secondResults = await libsqlVector.query(indexName, [1, 0, 0], 10, {
  //   //     description: {
  //   //       $regex: '^second',
  //   //       $options: 'im',
  //   //     },
  //   //   });
  //   //   expect(secondResults).toHaveLength(1);
  //   // });
  // it('should handle case insensitive flag (i)', async () => {
  //   const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
  //     category: { $regex: 'ELECTRONICS', $options: 'i' },
  //   });
  //   expect(results.length).toBeGreaterThan(0);
  // });

  // it('should handle multiline flag (m)', async () => {
  //   const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
  //     description: { $regex: '^start', $options: 'm' },
  //   });
  //   expect(results.length).toBeGreaterThan(0);
  // });

  // it('should handle extended flag (x)', async () => {
  //   const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
  //     category: {
  //       $regex: 'elect # match electronics\nronics',
  //       $options: 'x',
  //     },
  //   });
  //   expect(results.length).toBeGreaterThan(0);
  // });

  // it('should handle multiple flags', async () => {
  //   const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
  //     category: {
  //       $regex: 'ELECTRONICS\nITEM',
  //       $options: 'im',
  //     },
  //   });
  //   expect(results.length).toBeGreaterThan(0);
  // });
  // it('should handle special regex characters as literals', async () => {
  //   await libsqlVector.upsert(
  //     indexName,
  //     [[1, 0.1, 0]],
  //     [
  //       {
  //         special: 'text.with*special(chars)',
  //       },
  //     ],
  //   );

  //   const results = await libsqlVector.query(indexName, [1, 0, 0], 10, {
  //     special: 'text.with*special(chars)',
  //   });
  //   expect(results).toHaveLength(1); // Exact match, not regex
  // });

  // });
});
