import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

import { PgVector } from '.';

describe('PgVector', () => {
  let pgVector: PgVector;
  const testIndexName = 'test_vectors';
  const testIndexName2 = 'test_vectors1';
  const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5433/mastra';

  beforeAll(async () => {
    // Initialize PgVector
    pgVector = new PgVector(connectionString);
  });

  afterAll(async () => {
    // Clean up test tables
    await pgVector.deleteIndex(testIndexName);
    await pgVector.disconnect();
  });

  // Index Management Tests
  describe('Index Management', () => {
    describe('createIndex', () => {
      afterAll(async () => {
        await pgVector.deleteIndex(testIndexName2);
      });

      it('should create a new vector table with specified dimensions', async () => {
        await pgVector.createIndex(testIndexName, 3);
        const stats = await pgVector.describeIndex(testIndexName);
        expect(stats?.dimension).toBe(3);
        expect(stats?.count).toBe(0);
      });

      it('should create index with specified metric', async () => {
        await pgVector.createIndex(testIndexName2, 3, 'euclidean');
        const stats = await pgVector.describeIndex(testIndexName2);
        expect(stats.metric).toBe('euclidean');
      });

      it('should throw error if dimension is invalid', async () => {
        await expect(pgVector.createIndex(`testIndexNameFail`, 0)).rejects.toThrow();
      });
    });

    describe('listIndexes', () => {
      const indexName = 'test_query_3';
      beforeAll(async () => {
        await pgVector.createIndex(indexName, 3);
      });

      afterAll(async () => {
        await pgVector.deleteIndex(indexName);
      });

      it('should list all vector tables', async () => {
        const indexes = await pgVector.listIndexes();
        expect(indexes).toContain(indexName);
      });

      it('should not return created index in list if it is deleted', async () => {
        await pgVector.deleteIndex(indexName);
        const indexes = await pgVector.listIndexes();
        expect(indexes).not.toContain(indexName);
      });
    });

    describe('describeIndex', () => {
      const indexName = 'test_query_4';
      beforeAll(async () => {
        await pgVector.createIndex(indexName, 3);
      });

      afterAll(async () => {
        await pgVector.deleteIndex(indexName);
      });

      it('should return correct index stats', async () => {
        await pgVector.createIndex(indexName, 3, 'cosine');
        const vectors = [
          [1, 2, 3],
          [4, 5, 6],
        ];
        await pgVector.upsert(indexName, vectors);

        const stats = await pgVector.describeIndex(indexName);
        expect(stats).toEqual({
          dimension: 3,
          count: 2,
          metric: 'cosine',
        });
      });

      it('should throw error for non-existent index', async () => {
        await expect(pgVector.describeIndex('non_existent')).rejects.toThrow();
      });
    });
  });

  // Vector Operations Tests
  describe('Vector Operations', () => {
    describe('upsert', () => {
      beforeEach(async () => {
        await pgVector.createIndex(testIndexName, 3);
      });

      afterEach(async () => {
        await pgVector.deleteIndex(testIndexName);
      });

      it('should insert new vectors', async () => {
        const vectors = [
          [1, 2, 3],
          [4, 5, 6],
        ];
        const ids = await pgVector.upsert(testIndexName, vectors);

        expect(ids).toHaveLength(2);
        const stats = await pgVector.describeIndex(testIndexName);
        expect(stats.count).toBe(2);
      });

      it('should update existing vectors', async () => {
        const vectors = [[1, 2, 3]];
        const metadata = [{ test: 'initial' }];
        const [id] = await pgVector.upsert(testIndexName, vectors, metadata);

        const updatedVectors = [[4, 5, 6]];
        const updatedMetadata = [{ test: 'updated' }];
        await pgVector.upsert(testIndexName, updatedVectors, updatedMetadata, [id!]);

        const results = await pgVector.query(testIndexName, [4, 5, 6], 1);
        expect(results[0]?.id).toBe(id);
        expect(results[0]?.metadata).toEqual({ test: 'updated' });
      });

      it('should handle metadata correctly', async () => {
        const vectors = [[1, 2, 3]];
        const metadata = [{ test: 'value', num: 123 }];

        await pgVector.upsert(testIndexName, vectors, metadata);
        const results = await pgVector.query(testIndexName, [1, 2, 3], 1);

        expect(results[0]?.metadata).toEqual(metadata[0]);
      });

      it('should throw error if vector dimensions dont match', async () => {
        const vectors = [[1, 2, 3, 4]]; // 4D vector for 3D index
        await expect(pgVector.upsert(testIndexName, vectors)).rejects.toThrow();
      });
    });

    describe('Basic Query Operations', () => {
      const indexName = 'test_query_2';
      beforeAll(async () => {
        try {
          await pgVector.deleteIndex(indexName);
        } catch (e) {
          // Ignore if doesn't exist
        }
        await pgVector.createIndex(indexName, 3);
      });

      beforeEach(async () => {
        await pgVector.truncateIndex(indexName);
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
        await pgVector.upsert(indexName, vectors, metadata);
      });

      afterAll(async () => {
        await pgVector.deleteIndex(indexName);
      });

      it('should return closest vectors', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 1);
        expect(results).toHaveLength(1);
        expect(results[0]?.vector).toBe(undefined);
        expect(results[0]?.score).toBeCloseTo(1, 5);
      });

      it('should return vector with result', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 1, undefined, true);
        expect(results).toHaveLength(1);
        expect(results[0]?.vector).toStrictEqual([1, 0, 0]);
      });

      it('should respect topK parameter', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 2);
        expect(results).toHaveLength(2);
      });

      it('should handle filters correctly', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, { type: 'a' });
        expect(results).toHaveLength(1);
        results.forEach(result => {
          expect(result?.metadata?.type).toBe('a');
        });
      });
    });
  });

  // Advanced Query Tests
  describe('Advanced Query Operations', () => {
    const indexName = 'test_query_filters';
    beforeAll(async () => {
      try {
        await pgVector.deleteIndex(indexName);
      } catch (e) {
        // Ignore if doesn't exist
      }
      await pgVector.createIndex(indexName, 3);
    });

    beforeEach(async () => {
      await pgVector.truncateIndex(indexName);
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
      await pgVector.upsert(indexName, vectors, metadata);
    });

    afterAll(async () => {
      await pgVector.deleteIndex(indexName);
    });

    // Comparison Operator Tests
    describe('Comparison Operators', () => {
      it('should filter with $gt operator', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          price: { $gt: 75 },
        });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.price).toBe(100);
      });

      it('should filter with $lte operator', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          price: { $lte: 50 },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.price).toBeLessThanOrEqual(50);
        });
      });

      it('should filter with lt operator', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          price: { $lt: 60 },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.price).toBeLessThan(60);
        });
      });

      it('should filter with gte operator', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          price: { $gte: 75 },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.price).toBeGreaterThanOrEqual(75);
        });
      });

      it('should filter with ne operator', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          category: { $ne: 'electronics' },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).not.toBe('electronics');
        });
      });
    });

    // Array Operator Tests
    describe('Array Operators', () => {
      it('should filter with $in operator', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          category: { $in: ['electronics', 'clothing'] },
        });
        expect(results).toHaveLength(3);
        results.forEach(result => {
          expect(['electronics', 'clothing']).toContain(result.metadata?.category);
        });
      });

      it('should filter with array $contains operator', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          tags: { $contains: ['new'] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.tags).toContain('new');
        });
      });

      it('should filter with $elemMatch operator', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          tags: { $elemMatch: ['new', 'premium'] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.tags.some(tag => ['new', 'premium'].includes(tag))).toBe(true);
        });
      });

      it('should filter with $all operator', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          tags: { $all: ['used', 'sale'] },
        });
        expect(results).toHaveLength(1);
        results.forEach(result => {
          expect(result.metadata?.tags).toContain('used');
          expect(result.metadata?.tags).toContain('sale');
        });
      });

      it('should filter with $nin operator', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          category: { $nin: ['electronics', 'books'] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).not.toContain(result.metadata?.category);
        });
      });

      it('should handle empty arrays in $in/$nin operators', async () => {
        const resultsIn = await pgVector.query(indexName, [1, 0, 0], 10, {
          category: { $in: [] },
        });
        expect(resultsIn).toHaveLength(0);

        const resultsNin = await pgVector.query(indexName, [1, 0, 0], 10, {
          category: { $nin: [] },
        });
        expect(resultsNin.length).toBeGreaterThan(0);
      });
    });

    // Regex Operator Tests
    describe('Regex Operators', () => {
      it('should handle $regex with case sensitivity', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          category: { $regex: 'ELECTRONICS' },
        });
        expect(results).toHaveLength(0);
      });

      it('should handle $regex with case insensitivity', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          category: { $regex: 'ELECTRONICS', $options: 'i' },
        });
        expect(results).toHaveLength(2);
      });

      it('should handle $regex with start anchor', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          category: { $regex: '^elect' },
        });
        expect(results).toHaveLength(2);
      });

      it('should handle $regex with end anchor', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          category: { $regex: 'nics$' },
        });
        expect(results).toHaveLength(2);
      });

      it('should handle multiline flag', async () => {
        await pgVector.upsert(indexName, [[1, 0.1, 0]], [{ description: 'First line\nSecond line\nThird line' }]);

        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          description: { $regex: '^Second', $options: 'm' },
        });
        expect(results).toHaveLength(1);
      });

      it('should handle dotall flag', async () => {
        await pgVector.upsert(indexName, [[1, 0.1, 0]], [{ description: 'First\nSecond\nThird' }]);

        const withoutS = await pgVector.query(indexName, [1, 0, 0], 10, {
          description: { $regex: 'First[^\\n]*Third' },
        });
        expect(withoutS).toHaveLength(0);

        const withS = await pgVector.query(indexName, [1, 0, 0], 10, {
          description: { $regex: 'First.*Third', $options: 's' },
        });
        expect(withS).toHaveLength(1);
      });
    });

    // Logical Operator Tests
    describe('Logical Operators', () => {
      it('should handle AND filter conditions', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          $and: [{ category: { $eq: 'electronics' } }, { price: { $gt: 75 } }],
        });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.category).toBe('electronics');
        expect(results[0]?.metadata?.price).toBeGreaterThan(75);
      });

      it('should handle OR filter conditions', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          $or: [{ category: { $eq: 'electronics' } }, { category: { $eq: 'books' } }],
        });
        expect(results.length).toBeGreaterThan(1);
        results.forEach(result => {
          expect(['electronics', 'books']).toContain(result?.metadata?.category);
        });
      });

      it('should handle $not operator', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          $not: { category: 'electronics' },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).not.toBe('electronics');
        });
      });

      it('should handle $nor operator', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          $nor: [{ category: 'electronics' }, { category: 'books' }],
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).not.toContain(result.metadata?.category);
        });
      });

      it('should handle nested $not with $or', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          $not: { $or: [{ category: 'electronics' }, { category: 'books' }] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).not.toContain(result.metadata?.category);
        });
      });

      // Additional $not operator tests
      it('should handle $not with comparison operators', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          price: { $not: { $gt: 75 } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.price).toBeLessThanOrEqual(75);
        });
      });

      it('should handle $not with $in operator', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          category: { $not: { $in: ['electronics', 'books'] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).not.toContain(result.metadata?.category);
        });
      });

      it('should handle $not with $regex operator', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          category: { $not: { $regex: '^elect' } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).not.toMatch(/^elect/);
        });
      });

      it('should handle $not with multiple nested conditions', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          $not: { $and: [{ category: 'electronics' }, { price: { $gt: 50 } }] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category !== 'electronics' || result.metadata?.price <= 50).toBe(true);
        });
      });

      it('should handle $not with $exists operator', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          tags: { $not: { $exists: true } },
        });
        expect(results.length).toBe(0); // All test data has tags
      });

      it('should handle $not with array operators', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          tags: { $not: { $all: ['new', 'premium'] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(!result.metadata?.tags.includes('new') || !result.metadata?.tags.includes('premium')).toBe(true);
        });
      });

      it('should handle $not with complex nested conditions', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          $not: {
            $or: [
              {
                $and: [{ category: 'electronics' }, { price: { $gt: 90 } }],
              },
              {
                $and: [{ category: 'books' }, { price: { $lt: 30 } }],
              },
            ],
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
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          tags: { $not: { $in: [] } },
        });
        expect(results.length).toBeGreaterThan(0); // Should match all records
      });

      it('should handle $not with null values', async () => {
        // First insert a record with null value
        await pgVector.upsert(indexName, [[1, 0.1, 0]], [{ category: null, price: 0 }]);

        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          category: { $not: { $eq: null } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).not.toBeNull();
        });
      });

      it('should handle $not with boolean values', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          active: { $not: { $eq: true } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.active).not.toBe(true);
        });
      });

      it('should handle $not with multiple conditions', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          $not: { category: 'electronics', price: { $gt: 50 } },
        });
        expect(results.length).toBeGreaterThan(0);
      });

      it('should handle $not with $not operator', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          $not: { $not: { category: 'electronics' } },
        });
        expect(results.length).toBeGreaterThan(0);
      });

      it('should handle $not in nested fields', async () => {
        await pgVector.upsert(indexName, [[1, 0.1, 0]], [{ user: { profile: { price: 10 } } }]);
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          'user.profile.price': { $not: { $gt: 25 } },
        });
        expect(results.length).toBe(1);
      });
    });

    // Edge Cases and Special Values
    describe('Edge Cases and Special Values', () => {
      it('should handle empty result sets with valid filters', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          price: { $gt: 1000 },
        });
        expect(results).toHaveLength(0);
      });

      it('should throw error for invalid operator', async () => {
        await expect(
          pgVector.query(indexName, [1, 0, 0], 10, {
            price: { $invalid: 100 },
          }),
        ).rejects.toThrow('Unsupported operator: $invalid');
      });

      it('should handle empty filter object', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {});
        expect(results.length).toBeGreaterThan(0);
      });

      it('should handle numeric string comparisons', async () => {
        await pgVector.upsert(indexName, [[1, 0.1, 0]], [{ numericString: '123' }]);
        const results = await pgVector.query(indexName, [1, 0, 0], 10, {
          numericString: { $gt: '100' },
        });
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]?.metadata?.numericString).toBe('123');
      });
    });

    // Score Threshold Tests
    describe('Score Threshold', () => {
      it('should respect minimum score threshold', async () => {
        const results = await pgVector.query(indexName, [1, 0, 0], 10, { category: 'electronics' }, false, 0.9);
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.score).toBeGreaterThan(0.9);
        });
      });
    });
  });
});
