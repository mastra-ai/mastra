import { QueryResult, IndexStats } from '@mastra/core/vector';
import { describe, expect, beforeEach, afterEach, it, beforeAll, afterAll } from 'vitest';

import { ChromaVector } from './';

describe('ChromaVector Integration Tests', () => {
  let vectorDB = new ChromaVector({
    path: 'http://localhost:8000',
  });

  const testIndexName = 'test-index';
  const testIndexName2 = 'test-index-2';
  const dimension = 3;

  beforeEach(async () => {
    // Clean up any existing test index
    try {
      await vectorDB.deleteIndex(testIndexName);
    } catch (error) {
      // Ignore errors if index doesn't exist
    }
    await vectorDB.createIndex(testIndexName, dimension);
  }, 5000);

  afterEach(async () => {
    // Cleanup after tests
    try {
      await vectorDB.deleteIndex(testIndexName);
    } catch (error) {
      // Ignore cleanup errors
    }
  }, 5000);

  describe('Index Management', () => {
    it('should create and list indexes', async () => {
      const indexes = await vectorDB.listIndexes();
      expect(indexes).toContain(testIndexName);
    });

    it('should describe index correctly', async () => {
      const stats: IndexStats = await vectorDB.describeIndex(testIndexName);
      expect(stats.dimension).toBe(dimension);
      expect(stats.count).toBe(0);
      expect(stats.metric).toBe('cosine');
    });

    it('should delete index', async () => {
      await vectorDB.deleteIndex(testIndexName);
      const indexes = await vectorDB.listIndexes();
      expect(indexes).not.toContain(testIndexName);
    });

    it('should create index with different metrics', async () => {
      const metricsToTest: Array<'cosine' | 'euclidean' | 'dotproduct'> = ['euclidean', 'dotproduct'];

      for (const metric of metricsToTest) {
        const testIndex = `test-index-${metric}`;
        await vectorDB.createIndex(testIndex, dimension, metric);

        const stats = await vectorDB.describeIndex(testIndex);
        expect(stats.metric).toBe(metric);

        await vectorDB.deleteIndex(testIndex);
      }
    });
  });

  describe('Vector Operations', () => {
    const testVectors = [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0],
    ];
    const testMetadata = [{ label: 'x-axis' }, { label: 'y-axis' }, { label: 'z-axis' }];
    const testIds = ['vec1', 'vec2', 'vec3'];

    it('should upsert vectors with generated ids', async () => {
      const ids = await vectorDB.upsert(testIndexName, testVectors);
      expect(ids).toHaveLength(testVectors.length);
      ids.forEach(id => expect(typeof id).toBe('string'));

      const stats = await vectorDB.describeIndex(testIndexName);
      expect(stats.count).toBe(testVectors.length);
    });

    it('should upsert vectors with provided ids and metadata', async () => {
      await vectorDB.upsert(testIndexName, testVectors, testMetadata, testIds);

      const stats = await vectorDB.describeIndex(testIndexName);
      expect(stats.count).toBe(testVectors.length);

      // Query each vector to verify metadata
      for (let i = 0; i < testVectors.length; i++) {
        const results = await vectorDB.query(testIndexName, testVectors?.[i]!, 1);
        expect(results?.[0]?.id).toBe(testIds[i]);
        expect(results?.[0]?.metadata).toEqual(testMetadata[i]);
      }
    });

    it('should perform vector search with topK', async () => {
      await vectorDB.upsert(testIndexName, testVectors, testMetadata, testIds);

      const queryVector = [1.0, 0.1, 0.1];
      const topK = 2;

      const results: QueryResult[] = await vectorDB.query(testIndexName, queryVector, topK);

      expect(results).toHaveLength(topK);
      expect(results?.[0]?.id).toBe(testIds[0]); // Should match x-axis vector most closely
    });

    it('should filter query results', async () => {
      await vectorDB.upsert(testIndexName, testVectors, testMetadata, testIds);

      const queryVector = [1.0, 1.0, 1.0];
      const filter = { label: 'x-axis' };

      const results = await vectorDB.query(testIndexName, queryVector, 3, filter);

      expect(results).toHaveLength(1);
      expect(results?.[0]?.metadata?.label).toBe('x-axis');
    });

    it('should include vector in query results', async () => {
      await vectorDB.upsert(testIndexName, testVectors, testMetadata, testIds);

      const queryVector = [1.0, 0.1, 0.1];
      const topK = 1;

      const results = await vectorDB.query(testIndexName, queryVector, topK, undefined, true);

      expect(results).toHaveLength(topK);
      expect(results?.[0]?.vector).toEqual(testVectors[0]);
    });

    it('should update existing vectors', async () => {
      // Initial upsert
      await vectorDB.upsert(testIndexName, testVectors, testMetadata, testIds);

      // Update first vector
      const updatedVector = [[0.5, 0.5, 0.0]];
      const updatedMetadata = [{ label: 'updated-x-axis' }];
      await vectorDB.upsert(testIndexName, updatedVector, updatedMetadata, [testIds?.[0]!]);

      // Verify update
      const results = await vectorDB.query(testIndexName, updatedVector?.[0]!, 1);
      expect(results?.[0]?.id).toBe(testIds[0]);
      expect(results?.[0]?.metadata).toEqual(updatedMetadata[0]);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent index queries', async () => {
      await expect(vectorDB.query('non-existent-index-yu', [1, 2, 3])).rejects.toThrow();
    });

    it('should handle invalid dimension vectors', async () => {
      const invalidVector = [1, 2, 3, 4]; // 4D vector for 3D index
      await expect(vectorDB.upsert(testIndexName, [invalidVector])).rejects.toThrow();
    });

    it('should handle mismatched metadata and vectors length', async () => {
      const vectors = [[1, 2, 3]];
      const metadata = [{}, {}]; // More metadata than vectors
      await expect(vectorDB.upsert(testIndexName, vectors, metadata)).rejects.toThrow();
    });
  });

  describe('Filter Validation in Queries', () => {
    it('rejects queries with null values', async () => {
      await expect(
        vectorDB.query(testIndexName, [1, 0, 0], 10, {
          field: null,
        }),
      ).rejects.toThrow();

      await expect(
        vectorDB.query(testIndexName, [1, 0, 0], 10, {
          other: { $eq: null },
        }),
      ).rejects.toThrow();
    });

    it('rejects invalid operator values', async () => {
      await expect(
        vectorDB.query(testIndexName, [1, 0, 0], 10, {
          tags: { $all: 'not-an-array' },
        }),
      ).rejects.toThrow();
    });

    it('validates array operator values', async () => {
      await expect(
        vectorDB.query(testIndexName, [1, 0, 0], 10, {
          tags: { $in: null },
        }),
      ).rejects.toThrow();

      await expect(
        vectorDB.query(testIndexName, [1, 0, 0], 10, {
          tags: { $all: 'not-an-array' },
        }),
      ).rejects.toThrow();
    });

    it('validates numeric values for comparison operators', async () => {
      await expect(
        vectorDB.query(testIndexName, [1, 0, 0], 10, {
          price: { $gt: 'not-a-number' },
        }),
      ).rejects.toThrow();
    });

    it('validates value types', async () => {
      await expect(
        vectorDB.query(testIndexName, [1, 0, 0], 10, {
          date: { $gt: 'not-a-date' },
        }),
      ).rejects.toThrow();

      await expect(
        vectorDB.query(testIndexName, [1, 0, 0], 10, {
          number: { $lt: 'not-a-number' },
        }),
      ).rejects.toThrow();
    });

    it('validates array operators', async () => {
      const invalidValues = [123, 'string', true, { key: 'value' }, null, undefined];
      for (const op of ['$in', '$nin', '$all']) {
        for (const val of invalidValues) {
          await expect(
            vectorDB.query(testIndexName, [1, 0, 0], 10, {
              field: { [op]: val },
            }),
          ).rejects.toThrow();
        }
      }
    });

    it('rejects invalid array operator values', async () => {
      // Test non-undefined values
      const invalidValues = [123, 'string', true, { key: 'value' }, null];
      for (const op of ['$in', '$nin']) {
        for (const val of invalidValues) {
          await expect(
            vectorDB.query(testIndexName, [1, 0, 0], 10, {
              field: { [op]: val },
            }),
          ).rejects.toThrow();
        }
      }
    });

    it('validates comparison operators', async () => {
      // Basic equality can accept any non-undefined value
      for (const op of ['$eq', '$ne']) {
        await expect(
          vectorDB.query(testIndexName, [1, 0, 0], 10, {
            field: { [op]: undefined },
          }),
        ).rejects.toThrow();
      }

      // Numeric comparisons require numbers
      const numOps = ['$gt', '$gte', '$lt', '$lte'];
      const invalidNumericValues = ['not-a-number', true, [], {}, null, undefined];
      for (const op of numOps) {
        for (const val of invalidNumericValues) {
          await expect(
            vectorDB.query(testIndexName, [1, 0, 0], 10, {
              field: { [op]: val },
            }),
          ).rejects.toThrow();
        }
      }
    });

    it('validates multiple invalid values', async () => {
      await expect(
        vectorDB.query(testIndexName, [1, 0, 0], 10, {
          field1: { $in: 'not-array' },
          field2: { $exists: 'not-boolean' },
          field3: { $gt: 'not-number' },
        }),
      ).rejects.toThrow();
    });

    it('rejects invalid array values', async () => {
      await expect(
        vectorDB.query(testIndexName, [1, 0, 0], 10, {
          field: { $in: [null] },
        }),
      ).rejects.toThrow();

      await expect(
        vectorDB.query(testIndexName, [1, 0, 0], 10, {
          field: { $in: [undefined] },
        }),
      ).rejects.toThrow();

      await expect(
        vectorDB.query(testIndexName, [1, 0, 0], 10, {
          field: { $all: 'not-an-array' },
        }),
      ).rejects.toThrow('A non-empty array is required for the $all operator');
    });

    it('handles empty object filters', async () => {
      // Test empty object at top level
      await expect(vectorDB.query(testIndexName, [1, 0, 0], 10, { field: { $eq: {} } })).rejects.toThrow();
    });

    it('handles empty/undefined filters by returning all results', async () => {
      const noFilterCases = [{ field: {} }, { field: undefined }, { field: { $in: undefined } }];

      for (const filter of noFilterCases) {
        await expect(vectorDB.query(testIndexName, [1, 0, 0], 10, filter)).rejects.toThrow();
      }
    });
    it('handles empty object filters', async () => {
      // Test empty object at top level
      await expect(vectorDB.query(testIndexName, [1, 0, 0], 10, {})).rejects.toThrow();
    });
  });

  describe('Metadata Filter Tests', () => {
    // Set up test vectors and metadata
    beforeAll(async () => {
      try {
        await vectorDB.deleteIndex(testIndexName2);
      } catch (error) {
        // Ignore errors if index doesn't exist
      }
      await vectorDB.createIndex(testIndexName2, dimension);

      const vectors = [
        [1, 0, 0], // Electronics
        [0, 1, 0], // Books
        [0, 0, 1], // Electronics
        [0, 0, 0.1], // Books
      ];

      const metadata = [
        {
          category: 'electronics',
          price: 1000,
          rating: 4.8,
          tags: ['premium', 'new'],
          inStock: true,
          specs: {
            color: 'black',
            weight: 2.5,
          },
        },
        {
          category: 'books',
          price: 25,
          rating: 4.2,
          tags: ['bestseller'],
          inStock: true,
          author: {
            name: 'John Doe',
            country: 'USA',
          },
        },
        {
          category: 'electronics',
          price: 500,
          rating: 4.5,
          tags: ['refurbished', 'premium'],
          inStock: false,
          specs: {
            color: 'silver',
            weight: 1.8,
          },
        },
        {
          category: 'books',
          price: 15,
          rating: 4.9,
          tags: ['bestseller', 'new'],
          inStock: true,
          author: {
            name: 'Jane Smith',
            country: 'UK',
          },
        },
      ];

      await vectorDB.upsert(testIndexName2, vectors, metadata);
      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 2000));
    });

    afterAll(async () => {
      // Cleanup after tests
      try {
        await vectorDB.deleteIndex(testIndexName);
      } catch (error) {
        // Ignore cleanup errors
      }
    }, 5000);

    describe('Basic Comparison Operators', () => {
      it.only('filters with $eq operator', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          category: { $eq: 'electronics' },
        });
        expect(results.length).toBe(2);
        console.log(results);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
        });
      });

      it('filters with $gt operator', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          price: { $gt: 500 },
        });
        expect(results.length).toBe(1);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeGreaterThan(500);
        });
      });

      it('should filter with $gte operator', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          price: { $gte: 500 },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeGreaterThanOrEqual(500);
        });
      });

      it('should filter with $lt operator', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          price: { $lt: 100 },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeLessThan(100);
        });
      });

      it('should filter with $lte operator', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          price: { $lte: 50 },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeLessThanOrEqual(50);
        });
      });

      it('filters with $gte, $lt, $lte operators', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          price: { $gte: 25, $lte: 500 },
        });
        expect(results.length).toBe(2);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeLessThanOrEqual(500);
          expect(Number(result.metadata?.price)).toBeGreaterThanOrEqual(25);
        });
      });

      it('filters with $ne operator', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          category: { $ne: 'books' },
        });
        expect(results.length).toBe(2);
        results.forEach(result => {
          expect(result.metadata?.category).not.toBe('books');
        });
      });
    });

    describe('Array Operators', () => {
      it('filters with $in operator', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          tags: { $in: ['premium'] },
        });
        expect(results.length).toBe(2);
        results.forEach(result => {
          expect(result.metadata?.tags).toContain('premium');
        });
      });

      it('should filter with $in operator for strings', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          category: { $in: ['electronics', 'books'] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).toContain(result.metadata?.category);
        });
      });

      it('should filter with $in operator for numbers', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          price: { $in: [50, 75, 1000] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect([50, 75, 1000]).toContain(result.metadata?.price);
        });
      });

      it('filters with $nin operator', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          tags: { $nin: ['bestseller'] },
        });
        expect(results.length).toBe(2);
        results.forEach(result => {
          expect(result.metadata?.tags).not.toContain('bestseller');
        });
      });

      it('should filter with $nin operator', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          category: { $nin: ['electronics', 'books'] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).not.toContain(result.metadata?.category);
        });
      });

      it('filters with $all operator', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          tags: { $all: ['premium', 'new'] },
        });
        expect(results.length).toBe(1);
        results.forEach(result => {
          expect(result.metadata?.tags).toContain('premium');
          expect(result.metadata?.tags).toContain('new');
        });
      });
    });

    describe('Logical Operators', () => {
      it('filters with $and operator', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          $and: [{ category: 'electronics' }, { price: { $gt: 500 } }],
        });
        expect(results.length).toBe(1);
        expect(results[0]?.metadata?.category).toBe('electronics');
        expect(Number(results[0]?.metadata?.price)).toBeGreaterThan(500);
      });

      it('should filter with $and operator', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          $and: [{ category: 'electronics' }, { price: { $gt: 700 } }, { inStock: true }],
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
          expect(Number(result.metadata?.price)).toBeGreaterThan(700);
          expect(result.metadata?.inStock).toBe(true);
        });
      });

      it('filters with $or operator', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          $or: [{ price: { $gt: 900 } }, { rating: { $gt: 4.8 } }],
        });
        expect(results.length).toBe(2);
        results.forEach(result => {
          expect(Number(result.metadata?.price) > 900 || Number(result.metadata?.rating) > 4.8).toBe(true);
        });
      });

      it('should filter with $or operator', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          $or: [{ price: { $gt: 900 } }, { tags: { $all: ['bestseller'] } }],
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          const condition1 = Number(result.metadata?.price) > 900;
          const condition2 = result.metadata?.tags?.includes('bestseller');
          expect(condition1 || condition2).toBe(true);
        });
      });

      it('filters with multiple fields', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          $not: {
            category: 'electronics',
            price: 100,
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category === 'electronics' && result.metadata?.price === 100).toBe(false);
        });
      });

      it('should handle nested logical operators', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          $and: [
            {
              $or: [{ category: 'electronics' }, { category: 'books' }],
            },
            { price: { $lt: 100 } },
            { inStock: true },
          ],
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).toContain(result.metadata?.category);
          expect(Number(result.metadata?.price)).toBeLessThan(100);
          expect(result.metadata?.inStock).toBe(true);
        });
      });

      it('uses implicit $eq within $or', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          $or: [{ category: 'electronics' }, { price: { $gt: 100 } }],
        });
        expect(results.length).toBeGreaterThan(0);
      });

      it('implicit $eq inside of $and', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          $and: [{ category: 'special' }],
        });
        expect(results.length).toBe(1);
        expect(results[0]!.metadata!.category).toBe('special');
      });

      it('filters with nested logical operators', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          $and: [
            { category: 'electronics' },
            {
              $or: [{ price: { $gt: 900 } }, { tags: { $all: ['refurbished'] } }],
            },
          ],
        });
        expect(results.length).toBe(2);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
          expect(Number(result.metadata?.price) > 900 || result.metadata?.tags?.includes('refurbished')).toBe(true);
        });
      });
    });

    describe('Nested Field Queries', () => {
      it('filters on nested object fields', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          'specs.color': 'black',
        });
        expect(results.length).toBe(1);
        expect(results[0]?.metadata?.specs?.color).toBe('black');
      });

      it('combines nested field queries with logical operators', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          $or: [{ 'specs.weight': { $lt: 2.0 } }, { 'author.country': 'UK' }],
        });
        expect(results.length).toBe(2);
        results.forEach(result => {
          expect(result.metadata?.specs?.weight < 2.0 || result.metadata?.author?.country === 'UK').toBe(true);
        });
      });
    });

    describe('Complex Filter Combinations', () => {
      it('combines multiple operators and conditions', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          $and: [
            { price: { $gt: 20 } },
            { inStock: true },
            {
              $or: [{ tags: { $in: ['premium'] } }, { rating: { $gt: 4.5 } }],
            },
          ],
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeGreaterThan(20);
          expect(result.metadata?.inStock).toBe(true);
          expect(result.metadata?.tags?.includes('premium') || Number(result.metadata?.rating) > 4.5).toBe(true);
        });
      });

      it('handles complex nested conditions', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          $or: [
            {
              $and: [{ category: 'electronics' }, { 'specs.weight': { $lt: 2.0 } }, { tags: { $in: ['premium'] } }],
            },
            {
              $and: [{ category: 'books' }, { price: { $lt: 20 } }, { 'author.country': 'UK' }],
            },
          ],
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          if (result.metadata?.category === 'electronics') {
            expect(result.metadata?.specs?.weight).toBeLessThan(2.0);
            expect(result.metadata?.tags).toContain('premium');
          } else {
            expect(Number(result.metadata?.price)).toBeLessThan(20);
            expect(result.metadata?.author?.country).toBe('UK');
          }
        });
      });

      it('should combine comparison and array operators', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          $and: [{ price: { $gte: 500 } }, { tags: { $in: ['premium', 'refurbished'] } }],
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeGreaterThanOrEqual(500);
          expect(result.metadata?.tags?.some(tag => ['premium', 'refurbished'].includes(tag))).toBe(true);
        });
      });

      it('should handle multiple conditions on same field', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          $and: [{ price: { $gte: 30 } }, { price: { $lte: 800 } }],
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          const price = Number(result.metadata?.price);
          expect(price).toBeGreaterThanOrEqual(30);
          expect(price).toBeLessThanOrEqual(800);
        });
      });

      it('should handle complex nested conditions', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          $or: [
            {
              $and: [{ category: 'electronics' }, { price: { $gt: 700 } }, { tags: { $all: ['premium'] } }],
            },
            {
              $and: [{ category: 'books' }, { price: { $lt: 50 } }, { tags: { $in: ['paperback'] } }],
            },
          ],
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          const isExpensiveElectronics =
            result.metadata?.category === 'electronics' &&
            Number(result.metadata?.price) > 700 &&
            result.metadata?.tags?.includes('premium');

          const isCheapBook =
            result.metadata?.category === 'books' &&
            Number(result.metadata?.price) < 50 &&
            result.metadata?.tags?.includes('paperback');

          expect(isExpensiveElectronics || isCheapBook).toBe(true);
        });
      });
    });

    describe('Field Existence and Null Checks', () => {
      beforeAll(async () => {
        // Add some vectors with special metadata cases
        const vectors = [
          [0.5, 0.5, 0.5],
          [0.3, 0.3, 0.3],
        ];

        const metadata = [
          {
            category: 'special',
            optionalField: null,
            emptyArray: [],
            nested: {
              existingField: 'value',
              nullField: null,
            },
          },
          {
            category: 'special',
            // optionalField intentionally missing
            emptyArray: ['single'],
            nested: {
              // existingField intentionally missing
              otherField: 'value',
            },
          },
        ];

        await vectorDB.upsert(testIndexName2, vectors, metadata);
        await new Promise(resolve => setTimeout(resolve, 2000));
      });

      it('filters for null values', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          'nested.nullField': null,
        });
        expect(results.length).toBe(1);
        expect(results[0]!.metadata!.nested.nullField).toBeNull();
      });
    });

    describe('Date and Numeric Edge Cases', () => {
      beforeAll(async () => {
        const vectors = [
          [0.1, 0.1, 0.1],
          [0.2, 0.2, 0.2],
        ];

        const metadata = [
          {
            numericFields: {
              zero: 0,
              negativeZero: -0,
              infinity: Infinity,
              negativeInfinity: -Infinity,
              decimal: 0.1,
              negativeDecimal: -0.1,
            },
            dateFields: {
              current: new Date().toISOString(),
              epoch: new Date(0).toISOString(),
              future: new Date('2100-01-01').toISOString(),
            },
          },
          {
            numericFields: {
              maxInt: Number.MAX_SAFE_INTEGER,
              minInt: Number.MIN_SAFE_INTEGER,
              maxFloat: Number.MAX_VALUE,
              minFloat: Number.MIN_VALUE,
            },
            dateFields: {
              past: new Date('1900-01-01').toISOString(),
              current: new Date().toISOString(),
            },
          },
        ];

        await vectorDB.upsert(testIndexName2, vectors, metadata);
        await new Promise(resolve => setTimeout(resolve, 2000));
      });

      it('handles special numeric values', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          $or: [{ 'numericFields.zero': 0 }, { 'numericFields.negativeZero': 0 }],
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          const value = result.metadata?.numericFields?.zero ?? result.metadata?.numericFields?.negativeZero;
          expect(value).toBe(0);
        });
      });

      it('compares dates correctly', async () => {
        const now = new Date().toISOString();
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          $and: [{ 'dateFields.current': { $lte: now } }, { 'dateFields.current': { $gt: new Date(0).toISOString() } }],
        });
        expect(results.length).toBeGreaterThan(0);
      });

      it('handles extreme numeric values', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          $or: [
            { 'numericFields.maxInt': { $gte: Number.MAX_SAFE_INTEGER } },
            { 'numericFields.minInt': { $lte: Number.MIN_SAFE_INTEGER } },
          ],
        });
        expect(results.length).toBe(1);
      });

      it('should handle numeric comparisons with decimals', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          rating: { $gt: 4.5 },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.rating)).toBeGreaterThan(4.5);
        });
      });

      it('should handle boolean values', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          inStock: { $eq: false },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.inStock).toBe(false);
        });
      });

      it('should handle empty array in $in operator', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          category: { $in: [] },
        });
        expect(results).toHaveLength(0);
      });

      it('should handle single value in $all operator', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          tags: { $all: ['premium'] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.tags).toContain('premium');
        });
      });
    });

    describe('Advanced Array Operations', () => {
      beforeAll(async () => {
        const vectors = [
          [0.7, 0.7, 0.7],
          [0.8, 0.8, 0.8],
          [0.9, 0.9, 0.9],
        ];

        const metadata = [
          {
            arrays: {
              empty: [],
              single: ['one'],
              multiple: ['one', 'two', 'three'],
              nested: [['inner']],
            },
          },
          {
            arrays: {
              empty: [],
              single: ['two'],
              multiple: ['two', 'three'],
              nested: [['inner'], ['outer']],
            },
          },
          {
            arrays: {
              single: ['three'],
              multiple: ['three', 'four', 'five'],
              nested: [],
            },
          },
        ];

        await vectorDB.upsert(testIndexName2, vectors, metadata);
        await new Promise(resolve => setTimeout(resolve, 2000));
      });

      it('handles $in with empty array input', async () => {
        const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          'arrays.single': { $in: [] },
        });
        expect(results.length).toBe(0);
      });
    });
  });

  describe('Additional Validation Tests', () => {
    it('should reject non-numeric values in numeric comparisons', async () => {
      await expect(
        vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          price: { $gt: '500' }, // string instead of number
        }),
      ).rejects.toThrow('the $gt operator must be followed by a number');
    });

    it('should reject invalid types in $in operator', async () => {
      await expect(
        vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          price: { $in: [true, false] }, // booleans instead of numbers
        }),
      ).rejects.toThrow('the $in operator must be followed by a list of strings or a list of numbers');
    });

    it('should reject mixed types in $in operator', async () => {
      await expect(
        vectorDB.query(testIndexName2, [1, 0, 0], 10, {
          field: { $in: ['string', 123] }, // mixed string and number
        }),
      ).rejects.toThrow();
    });
  });

  describe('Additional Edge Cases', () => {
    it('should handle exact boundary conditions', async () => {
      // Test exact boundary values from our test data
      const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
        $and: [
          { price: { $gte: 25 } }, // lowest price in our data
          { price: { $lte: 1000 } }, // highest price in our data
        ],
      });
      expect(results.length).toBeGreaterThan(0);
      // Should include both boundary values
      expect(results.some(r => r.metadata?.price === 25)).toBe(true);
      expect(results.some(r => r.metadata?.price === 1000)).toBe(true);
    });

    it('should handle multiple $all conditions on same array field', async () => {
      const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
        $and: [{ tags: { $all: ['premium'] } }, { tags: { $all: ['new'] } }],
      });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.metadata?.tags).toContain('premium');
        expect(result.metadata?.tags).toContain('new');
      });
    });

    it('should handle multiple array operator combinations', async () => {
      const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
        $and: [{ tags: { $all: ['premium'] } }, { tags: { $in: ['new', 'refurbished'] } }],
      });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.metadata?.tags).toContain('premium');
        expect(result.metadata?.tags?.some(tag => ['new', 'refurbished'].includes(tag))).toBe(true);
      });
    });
  });

  describe('Additional Complex Logical Combinations', () => {
    it('should handle deeply nested $or conditions', async () => {
      const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
        $or: [
          {
            $and: [{ category: 'electronics' }, { $or: [{ price: { $gt: 900 } }, { tags: { $all: ['premium'] } }] }],
          },
          {
            $and: [{ category: 'books' }, { $or: [{ price: { $lt: 30 } }, { tags: { $all: ['bestseller'] } }] }],
          },
        ],
      });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        if (result.metadata?.category === 'electronics') {
          expect(Number(result.metadata?.price) > 900 || result.metadata?.tags?.includes('premium')).toBe(true);
        } else if (result.metadata?.category === 'books') {
          expect(Number(result.metadata?.price) < 30 || result.metadata?.tags?.includes('bestseller')).toBe(true);
        }
      });
    });

    it('should handle multiple field comparisons with same value', async () => {
      const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
        $or: [{ price: { $gt: 500 } }, { rating: { $gt: 4.5 } }],
      });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(Number(result.metadata?.price) > 500 || Number(result.metadata?.rating) > 4.5).toBe(true);
      });
    });

    it('should handle combination of array and numeric comparisons', async () => {
      const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
        $and: [
          { tags: { $in: ['premium', 'bestseller'] } },
          { $or: [{ price: { $gt: 500 } }, { rating: { $gt: 4.5 } }] },
        ],
      });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(['premium', 'bestseller'].some(tag => result.metadata?.tags?.includes(tag))).toBe(true);
        expect(Number(result.metadata?.price) > 500 || Number(result.metadata?.rating) > 4.5).toBe(true);
      });
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle filters with many conditions', async () => {
      const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
        $and: Array(10)
          .fill(null)
          .map(() => ({
            $or: [{ price: { $gt: 100 } }, { rating: { $gt: 4.0 } }],
          })),
      });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(Number(result.metadata?.price) > 100 || Number(result.metadata?.rating) > 4.0).toBe(true);
      });
    });

    it('should handle deeply nested conditions efficiently', async () => {
      const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
        $or: Array(5)
          .fill(null)
          .map(() => ({
            $and: [{ category: { $in: ['electronics', 'books'] } }, { price: { $gt: 50 } }, { rating: { $gt: 4.0 } }],
          })),
      });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(['electronics', 'books']).toContain(result.metadata?.category);
        expect(Number(result.metadata?.price)).toBeGreaterThan(50);
        expect(Number(result.metadata?.rating)).toBeGreaterThan(4.0);
      });
    });

    it('should handle large number of $or conditions', async () => {
      const results = await vectorDB.query(testIndexName2, [1, 0, 0], 10, {
        $or: [
          ...Array(5)
            .fill(null)
            .map((_, i) => ({
              price: { $gt: i * 100 },
            })),
          ...Array(5)
            .fill(null)
            .map((_, i) => ({
              rating: { $gt: 4.0 + i * 0.1 },
            })),
        ],
      });
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
