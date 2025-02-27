import type { QueryResult, IndexStats } from '@mastra/core/vector';
import { describe, expect, beforeEach, afterEach, it, beforeAll, afterAll, vi } from 'vitest';

import { ChromaVector } from './';

describe('ChromaVector Integration Tests', () => {
  let vectorDB = new ChromaVector({
    path: 'http://localhost:8000',
  });

  const testIndexName = 'test-index';
  const testIndexName2 = 'test-index-2';
  const testIndexName3 = 'test-index-3';
  const dimension = 3;

  beforeEach(async () => {
    // Clean up any existing test index
    try {
      await vectorDB.deleteIndex(testIndexName);
    } catch {
      // Ignore errors if index doesn't exist
    }
    await vectorDB.createIndex({ indexName: testIndexName, dimension });
  }, 5000);

  afterEach(async () => {
    // Cleanup after tests
    try {
      await vectorDB.deleteIndex(testIndexName);
    } catch {
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
        await vectorDB.createIndex({ indexName: testIndex, dimension, metric });

        const stats = await vectorDB.describeIndex(testIndex);
        expect(stats.metric).toBe(metric);

        await vectorDB.deleteIndex(testIndex);
      }
    });
  });

  describe('Basic Vector Operations', () => {
    const testVectors = [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0],
    ];
    const testMetadata = [{ label: 'x-axis' }, { label: 'y-axis' }, { label: 'z-axis' }];
    const testIds = ['vec1', 'vec2', 'vec3'];

    it('should upsert vectors with generated ids', async () => {
      const ids = await vectorDB.upsert({ indexName: testIndexName, vectors: testVectors });
      expect(ids).toHaveLength(testVectors.length);
      ids.forEach(id => expect(typeof id).toBe('string'));

      const stats = await vectorDB.describeIndex(testIndexName);
      expect(stats.count).toBe(testVectors.length);
    });

    it('should upsert vectors with provided ids and metadata', async () => {
      await vectorDB.upsert({ indexName: testIndexName, vectors: testVectors, metadata: testMetadata, ids: testIds });

      const stats = await vectorDB.describeIndex(testIndexName);
      expect(stats.count).toBe(testVectors.length);

      // Query each vector to verify metadata
      for (let i = 0; i < testVectors.length; i++) {
        const results = await vectorDB.query({ indexName: testIndexName, queryVector: testVectors?.[i]!, topK: 1 });
        expect(results?.[0]?.id).toBe(testIds[i]);
        expect(results?.[0]?.metadata).toEqual(testMetadata[i]);
      }
    });

    it('should update existing vectors', async () => {
      // Initial upsert
      await vectorDB.upsert({ indexName: testIndexName, vectors: testVectors, metadata: testMetadata, ids: testIds });

      // Update first vector
      const updatedVector = [[0.5, 0.5, 0.0]];
      const updatedMetadata = [{ label: 'updated-x-axis' }];
      await vectorDB.upsert({
        indexName: testIndexName,
        vectors: updatedVector,
        metadata: updatedMetadata,
        ids: [testIds?.[0]!],
      });

      // Verify update
      const results = await vectorDB.query({ indexName: testIndexName, queryVector: updatedVector?.[0]!, topK: 1 });
      expect(results?.[0]?.id).toBe(testIds[0]);
      expect(results?.[0]?.metadata).toEqual(updatedMetadata[0]);
    });
  });

  describe('Query Operations', () => {
    const testVectors = [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0],
    ];
    const testMetadata = [{ label: 'x-axis' }, { label: 'y-axis' }, { label: 'z-axis' }];
    const testIds = ['vec1', 'vec2', 'vec3'];

    beforeEach(async () => {
      await vectorDB.upsert({ indexName: testIndexName, vectors: testVectors, metadata: testMetadata, ids: testIds });
    });

    describe('Basic Queries', () => {
      it('should perform vector search with topK', async () => {
        const queryVector = [1.0, 0.1, 0.1];
        const topK = 2;

        const results: QueryResult[] = await vectorDB.query({ indexName: testIndexName, queryVector, topK });

        expect(results).toHaveLength(topK);
        expect(results?.[0]?.id).toBe(testIds[0]); // Should match x-axis vector most closely
      });
    });

    describe('Filter Queries', () => {
      it('should filter query results', async () => {
        const queryVector = [1.0, 1.0, 1.0];
        const filter = { label: 'x-axis' };

        const results = await vectorDB.query({ indexName: testIndexName, queryVector, topK: 3, filter });

        expect(results).toHaveLength(1);
        expect(results?.[0]?.metadata?.label).toBe('x-axis');
      });
    });

    describe('Vector Inclusion', () => {
      it('should include vector in query results', async () => {
        const queryVector = [1.0, 0.1, 0.1];
        const topK = 1;

        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector,
          topK,
          includeVector: true,
        });

        expect(results).toHaveLength(topK);
        expect(results?.[0]?.vector).toEqual(testVectors[0]);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent index queries', async () => {
      await expect(vectorDB.query({ indexName: 'non-existent-index-yu', queryVector: [1, 2, 3] })).rejects.toThrow();
    });

    it('should handle invalid dimension vectors', async () => {
      const invalidVector = [1, 2, 3, 4]; // 4D vector for 3D index
      await expect(vectorDB.upsert({ indexName: testIndexName, vectors: [invalidVector] })).rejects.toThrow();
    });

    it('should handle mismatched metadata and vectors length', async () => {
      const vectors = [[1, 2, 3]];
      const metadata = [{}, {}]; // More metadata than vectors
      await expect(vectorDB.upsert({ indexName: testIndexName, vectors, metadata })).rejects.toThrow();
    });
  });

  describe('Filter Validation in Queries', () => {
    it('rejects queries with null values', async () => {
      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: {
            field: null,
          },
        }),
      ).rejects.toThrow();

      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: {
            other: { $eq: null },
          },
        }),
      ).rejects.toThrow();
    });

    it('validates array operator values', async () => {
      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: {
            tags: { $in: null },
          },
        }),
      ).rejects.toThrow();
    });

    it('validates numeric values for comparison operators', async () => {
      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: {
            price: { $gt: 'not-a-number' },
          },
        }),
      ).rejects.toThrow();
    });

    it('validates value types', async () => {
      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { date: { $gt: 'not-a-date' } },
        }),
      ).rejects.toThrow();

      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { number: { $lt: 'not-a-number' } },
        }),
      ).rejects.toThrow();
    });

    it('validates array operators', async () => {
      const invalidValues = [123, 'string', true, { key: 'value' }, null];
      for (const op of ['$in', '$nin']) {
        for (const val of invalidValues) {
          await expect(
            vectorDB.query({
              indexName: testIndexName,
              queryVector: [1, 0, 0],
              filter: { field: { [op]: val } },
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
            vectorDB.query({
              indexName: testIndexName,
              queryVector: [1, 0, 0],
              filter: { field: { [op]: val } },
            }),
          ).rejects.toThrow();
        }
      }
    });

    it('validates comparison operators', async () => {
      // Basic equality can accept any non-undefined value
      for (const op of ['$eq', '$ne']) {
        await expect(
          vectorDB.query({
            indexName: testIndexName,
            queryVector: [1, 0, 0],
            filter: { field: { [op]: undefined } },
          }),
        ).rejects.toThrow();
      }

      // Numeric comparisons require numbers
      const numOps = ['$gt', '$gte', '$lt', '$lte'];
      const invalidNumericValues = ['not-a-number', true, [], {}, null, undefined];
      for (const op of numOps) {
        for (const val of invalidNumericValues) {
          await expect(
            vectorDB.query({
              indexName: testIndexName,
              queryVector: [1, 0, 0],
              filter: { field: { [op]: val } },
            }),
          ).rejects.toThrow();
        }
      }
    });

    it('validates multiple invalid values', async () => {
      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: {
            field1: { $in: 'not-array' },
            field2: { $exists: 'not-boolean' },
            field3: { $gt: 'not-number' },
          },
        }),
      ).rejects.toThrow();
    });

    it('handles empty object filters', async () => {
      // Test empty object at top level
      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { field: { $eq: {} } },
        }),
      ).rejects.toThrow();
    });

    it('handles empty/undefined filters by returning all results', async () => {
      const noFilterCases = [{ field: {} }, { field: undefined }, { field: { $in: undefined } }];

      for (const filter of noFilterCases) {
        await expect(vectorDB.query({ indexName: testIndexName, queryVector: [1, 0, 0], filter })).rejects.toThrow();
      }
    });
    it('handles empty object filters', async () => {
      // Test empty object at top level
      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: {},
        }),
      ).rejects.toThrow();
    });
  });

  describe('Metadata Filter Tests', () => {
    // Set up test vectors and metadata
    beforeAll(async () => {
      try {
        await vectorDB.deleteIndex(testIndexName2);
      } catch {
        // Ignore errors if index doesn't exist
      }
      await vectorDB.createIndex({ indexName: testIndexName2, dimension });

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
          inStock: true,
        },
        {
          category: 'books',
          price: 25,
          rating: 4.2,
          inStock: true,
        },
        {
          category: 'electronics',
          price: 500,
          rating: 4.5,
          inStock: false,
        },
        {
          category: 'books',
          price: 15,
          rating: 4.9,
          inStock: true,
        },
      ];

      await vectorDB.upsert({ indexName: testIndexName2, vectors, metadata });
      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 2000));
    });

    afterAll(async () => {
      // Cleanup after tests
      try {
        await vectorDB.deleteIndex(testIndexName2);
      } catch {
        // Ignore cleanup errors
      }
    });

    describe('Basic Comparison Operators', () => {
      it('filters with $eq operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: { category: { $eq: 'electronics' } },
        });
        expect(results.length).toBe(2);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
        });
      });

      it('filters with implicit $eq', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: { category: 'electronics' }, // implicit $eq
        });
        expect(results.length).toBe(2);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
        });
      });
      it('filters with $gt operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: { price: { $gt: 500 } },
        });
        expect(results.length).toBe(1);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeGreaterThan(500);
        });
      });

      it('filters with $gte operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: { price: { $gte: 500 } },
        });
        expect(results.length).toBe(2);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeGreaterThanOrEqual(500);
        });
      });

      it('filters with $lt operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: { price: { $lt: 100 } },
        });
        expect(results.length).toBe(2);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeLessThan(100);
        });
      });

      it('filters with $lte operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: { price: { $lte: 500 } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeLessThanOrEqual(500);
        });
      });

      it('filters with $gte, $lt, $lte operators', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: { price: { $gte: 25, $lte: 500 } },
        });
        expect(results.length).toBe(2);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeLessThanOrEqual(500);
          expect(Number(result.metadata?.price)).toBeGreaterThanOrEqual(25);
        });
      });

      it('filters with $ne operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: { category: { $ne: 'electronics' } },
        });
        expect(results.length).toBe(2);
        results.forEach(result => {
          expect(result.metadata?.category).not.toBe('electronics');
        });
      });

      it('filters with boolean values', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: { inStock: true }, // test both implicit
        });
        expect(results.length).toBe(3);
        results.forEach(result => {
          expect(result.metadata?.inStock).toBe(true);
        });
      });

      it('filters with multiple fields', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: { category: 'electronics', price: 1000 },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category === 'electronics' && result.metadata?.price === 1000).toBe(true);
        });
      });
    });

    describe('Array Operators', () => {
      it('filters with $in operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: { category: { $in: ['electronics', 'books'] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).toContain(result.metadata?.category);
        });
      });

      it('should filter with $in operator for numbers', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: { price: { $in: [50, 75, 1000] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect([50, 75, 1000]).toContain(result.metadata?.price);
        });
      });

      it('filters with $in operator for booleans', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: { inStock: { $in: [true] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.inStock).toBe(true);
        });
      });
    });

    describe('Logical Operators', () => {
      it('filters with $and operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: { $and: [{ category: 'electronics' }, { price: { $gt: 500 } }] },
        });
        expect(results.length).toBe(1);
        expect(results[0]?.metadata?.category).toBe('electronics');
        expect(Number(results[0]?.metadata?.price)).toBeGreaterThan(500);
      });

      it('should filter with $and operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: { $and: [{ category: 'electronics' }, { price: { $gt: 700 } }, { inStock: true }] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
          expect(Number(result.metadata?.price)).toBeGreaterThan(700);
          expect(result.metadata?.inStock).toBe(true);
        });
      });

      it('filters with $or operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: { $or: [{ price: { $gt: 900 } }, { rating: { $gt: 4.8 } }] },
        });
        expect(results.length).toBe(2);
        results.forEach(result => {
          expect(Number(result.metadata?.price) > 900 || Number(result.metadata?.rating) > 4.8).toBe(true);
        });
      });

      it('should filter with $or operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: { $or: [{ price: { $gt: 900 } }, { category: { $in: ['electronics', 'books'] } }] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          const condition1 = Number(result.metadata?.price) > 900;
          const condition2 = ['electronics', 'books'].includes(result.metadata?.category);
          expect(condition1 || condition2).toBe(true);
        });
      });

      it('should handle nested logical operators', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: {
            $and: [
              {
                $or: [{ category: 'electronics' }, { category: 'books' }],
              },
              { price: { $lt: 100 } },
              { inStock: true },
            ],
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).toContain(result.metadata?.category);
          expect(Number(result.metadata?.price)).toBeLessThan(100);
          expect(result.metadata?.inStock).toBe(true);
        });
      });

      it('uses implicit $eq within $or', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: { $or: [{ category: 'electronics' }, { price: { $gt: 100 } }] },
        });
        expect(results.length).toBeGreaterThan(0);
      });

      it('requires multiple conditions in logical operators', async () => {
        await expect(
          vectorDB.query({
            indexName: testIndexName2,
            queryVector: [1, 0, 0],
            filter: { $and: [{ category: 'electronics' }] },
          }),
        ).rejects.toThrow();

        await expect(
          vectorDB.query({
            indexName: testIndexName2,
            queryVector: [1, 0, 0],
            filter: { $or: [{ price: { $gt: 900 } }] },
          }),
        ).rejects.toThrow();
      });
    });

    describe('Complex Filter Combinations', () => {
      it('combines multiple operators and conditions', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: {
            $and: [
              { price: { $gt: 20 } },
              { inStock: true },
              {
                $or: [{ category: { $in: ['books'] } }, { rating: { $gt: 4.5 } }],
              },
            ],
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeGreaterThan(20);
          expect(result.metadata?.inStock).toBe(true);
          expect(result.metadata?.category === 'books' || Number(result.metadata?.rating) > 4.5).toBe(true);
        });
      });

      it('handles complex nested conditions', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: {
            $or: [
              {
                $and: [{ category: 'electronics' }, { price: { $gt: 700 } }],
              },
              {
                $and: [{ category: 'books' }, { price: { $lt: 20 } }],
              },
            ],
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          if (result.metadata?.category === 'electronics') {
            expect(Number(result.metadata?.price)).toBeGreaterThan(700);
          } else {
            expect(Number(result.metadata?.price)).toBeLessThan(20);
          }
        });
      });

      it('should combine comparison and array operators', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: { $and: [{ price: { $gte: 500 } }, { rating: { $gt: 4.5 } }] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeGreaterThanOrEqual(500);
          expect(Number(result.metadata?.rating)).toBeGreaterThan(4.5);
        });
      });

      it('should handle multiple conditions on same field', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: { $and: [{ price: { $gte: 30 } }, { price: { $lte: 800 } }] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          const price = Number(result.metadata?.price);
          expect(price).toBeGreaterThanOrEqual(30);
          expect(price).toBeLessThanOrEqual(800);
        });
      });

      it('should handle deeply nested logical operators', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: {
            $or: [
              {
                $and: [{ category: 'electronics' }, { price: { $gt: 700 } }, { rating: { $gt: 4.5 } }],
              },
              {
                $and: [{ category: 'books' }, { price: { $lt: 50 } }, { rating: { $gt: 4.0 } }],
              },
            ],
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          const isExpensiveElectronics =
            result.metadata?.category === 'electronics' &&
            Number(result.metadata?.price) > 700 &&
            Number(result.metadata?.rating) > 4.5;

          const isCheapBook =
            result.metadata?.category === 'books' &&
            Number(result.metadata?.price) < 50 &&
            Number(result.metadata?.rating) > 4.0;

          expect(isExpensiveElectronics || isCheapBook).toBe(true);
        });
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
            zero: 0,
            negativeZero: -0,
            infinity: Infinity,
            negativeInfinity: -Infinity,
            decimal: 0.1,
            negativeDecimal: -0.1,
            currentDate: new Date().toISOString(),
            epochDate: new Date(0).toISOString(),
            futureDate: new Date('2100-01-01').toISOString(),
          },
          {
            maxInt: Number.MAX_SAFE_INTEGER,
            minInt: Number.MIN_SAFE_INTEGER,
            maxFloat: Number.MAX_VALUE,
            minFloat: Number.MIN_VALUE,
            pastDate: new Date('1900-01-01').toISOString(),
            currentDate: new Date().toISOString(),
          },
        ];

        await vectorDB.upsert({
          indexName: testIndexName2,
          vectors,
          metadata,
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
      });

      it('handles special numeric values', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: { $or: [{ zero: 0 }, { negativeZero: 0 }] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          const value = result.metadata?.zero ?? result.metadata?.negativeZero;
          expect(value).toBe(0);
        });
      });

      it('handles extreme numeric values', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: {
            $or: [{ maxInt: { $gte: Number.MAX_SAFE_INTEGER } }, { minInt: { $lte: Number.MIN_SAFE_INTEGER } }],
          },
        });
        expect(results.length).toBe(1);
      });

      it('should handle numeric comparisons with decimals', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: {
            rating: { $gt: 4.5 },
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.rating)).toBeGreaterThan(4.5);
        });
      });

      it('should handle boolean values', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: { inStock: { $eq: false } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.inStock).toBe(false);
        });
      });
    });

    describe('Additional Validation Tests', () => {
      it('should throw error as date is not supported', async () => {
        await expect(
          vectorDB.query({
            indexName: testIndexName2,
            queryVector: [1, 0, 0],
            filter: {
              $and: [
                { currentDate: { $lte: new Date().toISOString() } },
                { currentDate: { $gt: new Date(0).toISOString() } },
              ],
            },
          }),
        ).rejects.toThrow();
      });
      it('should throw error as empty array in $in operator is not supported', async () => {
        await expect(
          vectorDB.query({
            indexName: testIndexName2,
            queryVector: [1, 0, 0],
            filter: {
              category: { $in: [] },
            },
          }),
        ).rejects.toThrow();
      });
      it('should reject non-numeric values in numeric comparisons', async () => {
        await expect(
          vectorDB.query({
            indexName: testIndexName2,
            queryVector: [1, 0, 0],
            filter: {
              price: { $gt: '500' }, // string instead of number
            },
          }),
        ).rejects.toThrow();
      });

      it('should reject mixed types in $in operator', async () => {
        await expect(
          vectorDB.query({
            indexName: testIndexName2,
            queryVector: [1, 0, 0],
            filter: {
              field: { $in: ['string', 123] }, // mixed string and number
            },
          }),
        ).rejects.toThrow();
      });
      it('should handle undefined filter', async () => {
        const results1 = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: undefined,
        });
        const results2 = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: undefined,
        });
        expect(results1).toEqual(results2);
        expect(results1.length).toBeGreaterThan(0);
      });

      it('should handle null filter', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: null,
        });
        const results2 = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: undefined,
        });
        expect(results).toEqual(results2);
        expect(results.length).toBeGreaterThan(0);
      });
    });

    describe('Additional Edge Cases', () => {
      it('should handle exact boundary conditions', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: {
            $and: [{ price: { $gte: 25 } }, { price: { $lte: 1000 } }],
          },
        });
        expect(results.length).toBeGreaterThan(0);
        expect(results.some(r => r.metadata?.price === 25)).toBe(true);
        expect(results.some(r => r.metadata?.price === 1000)).toBe(true);
      });
    });

    describe('Additional Complex Logical Combinations', () => {
      it('should handle deeply nested $or conditions', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: {
            $or: [
              {
                $and: [{ category: 'electronics' }, { $or: [{ price: { $gt: 900 } }, { rating: { $gt: 4.8 } }] }],
              },
              {
                $and: [{ category: 'books' }, { $or: [{ price: { $lt: 30 } }, { rating: { $gt: 4.5 } }] }],
              },
            ],
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          if (result.metadata?.category === 'electronics') {
            expect(Number(result.metadata?.price) > 900 || Number(result.metadata?.rating) > 4.8).toBe(true);
          } else if (result.metadata?.category === 'books') {
            expect(Number(result.metadata?.price) < 30 || Number(result.metadata?.rating) > 4.5).toBe(true);
          }
        });
      });

      it('should handle multiple field comparisons with same value', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: {
            $or: [{ price: { $gt: 500 } }, { rating: { $gt: 4.5 } }],
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price) > 500 || Number(result.metadata?.rating) > 4.5).toBe(true);
        });
      });
    });

    describe('Performance Edge Cases', () => {
      it('should handle filters with many conditions', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: {
            $and: Array(10)
              .fill(null)
              .map(() => ({
                $or: [{ price: { $gt: 100 } }, { rating: { $gt: 4.0 } }],
              })),
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price) > 100 || Number(result.metadata?.rating) > 4.0).toBe(true);
        });
      });

      it('should handle deeply nested conditions efficiently', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: {
            $or: Array(5)
              .fill(null)
              .map(() => ({
                $and: [
                  { category: { $in: ['electronics', 'books'] } },
                  { price: { $gt: 50 } },
                  { rating: { $gt: 4.0 } },
                ],
              })),
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).toContain(result.metadata?.category);
          expect(Number(result.metadata?.price)).toBeGreaterThan(50);
          expect(Number(result.metadata?.rating)).toBeGreaterThan(4.0);
        });
      });

      it('should handle large number of $or conditions', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: {
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
          },
        });
        expect(results.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Document Operations and Filtering', () => {
    const testDocuments = [
      'The quick brown fox jumps over the lazy dog',
      'Pack my box with five dozen liquor jugs',
      'How vexingly quick daft zebras JUMP',
    ];

    beforeAll(async () => {
      try {
        await vectorDB.deleteIndex(testIndexName3);
      } catch {
        // Ignore errors if index doesn't exist
      }
      await vectorDB.createIndex({ indexName: testIndexName3, dimension });

      const testVectors = [
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0],
      ];

      const testMetadata = [
        { source: 'pangram1', length: 43 },
        { source: 'pangram2', length: 32 },
        { source: 'pangram3', length: 30 },
      ];
      const testIds = ['doc1', 'doc2', 'doc3'];

      await vectorDB.upsert({
        indexName: testIndexName3,
        vectors: testVectors,
        documents: testDocuments,
        metadata: testMetadata,
        ids: testIds,
      });

      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 2000));
    });

    afterAll(async () => {
      // Cleanup after tests
      try {
        await vectorDB.deleteIndex(testIndexName3);
      } catch {
        // Ignore cleanup errors
      }
    });

    describe('Basic Document Operations', () => {
      it('should store and retrieve documents', async () => {
        const results = await vectorDB.query({ indexName: testIndexName3, queryVector: [1.0, 0.0, 0.0], topK: 3 });
        expect(results).toHaveLength(3);
        // Verify documents are returned
        expect(results[0].document).toBe(testDocuments[0]);
      });

      it('should filter documents using $contains', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName3,
          queryVector: [1.0, 0.0, 0.0],
          topK: 3,
          documentFilter: { $contains: 'quick' },
        });
        expect(results).toHaveLength(2);
      });

      it('should filter with $not_contains', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName3,
          queryVector: [1.0, 0.0, 0.0],
          topK: 3,
          documentFilter: { $not_contains: 'fox' },
        });
        expect(results.every(r => !r.document?.includes('fox'))).toBe(true);
      });

      it('should combine metadata and document filters', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName3,
          queryVector: [1.0, 0.0, 0.0],
          topK: 3,
          filter: { source: 'pangram1' },
          documentFilter: { $contains: 'fox' },
        });
        expect(results).toHaveLength(1);
        expect(results[0].metadata?.source).toBe('pangram1');
        expect(results[0].document).toContain('fox');
      });
    });

    describe('Complex Document Filtering', () => {
      it('should handle $and conditions', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName3,
          queryVector: [1.0, 0.0, 0.0],
          topK: 3,
          documentFilter: { $and: [{ $contains: 'quick' }, { $not_contains: 'fox' }] },
        });
        expect(results).toHaveLength(1);
        expect(results[0].document).toContain('quick');
        expect(results[0].document).not.toContain('fox');
      });

      it('should handle $or conditions', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName3,
          queryVector: [1.0, 0.0, 0.0],
          topK: 3,
          documentFilter: { $or: [{ $contains: 'fox' }, { $contains: 'zebras' }] },
        });
        expect(results).toHaveLength(2);
        expect(results[0].document).toContain('fox');
        expect(results[1].document).toContain('zebras');
      });
    });

    describe('Edge Cases and Validation', () => {
      it('should reject empty string in $contains', async () => {
        await expect(
          vectorDB.query({
            indexName: testIndexName3,
            queryVector: [1.0, 0.0, 0.0],
            topK: 3,
            documentFilter: { $contains: '' },
          }),
        ).rejects.toThrow('Expected where document operand value for operator $contains to be a non-empty str');
      });

      it('should be case sensitive', async () => {
        // First verify lowercase works
        const lowerResults = await vectorDB.query({
          indexName: testIndexName3,
          queryVector: [1.0, 0.0, 0.0],
          topK: 3,
          documentFilter: { $contains: 'quick' },
        });
        expect(lowerResults.length).toBe(2);

        // Then verify uppercase doesn't match
        const upperResults = await vectorDB.query({
          indexName: testIndexName3,
          queryVector: [1.0, 0.0, 0.0],
          topK: 3,
          documentFilter: { $contains: 'QUICK' },
        });
        expect(upperResults.length).toBe(0);

        const upperResults2 = await vectorDB.query({
          indexName: testIndexName3,
          queryVector: [1.0, 0.0, 0.0],
          topK: 3,
          documentFilter: { $contains: 'JUMP' },
        });
        expect(upperResults2.length).toBe(1);
      });

      it('should handle exact string matches', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName3,
          queryVector: [1.0, 0.0, 0.0],
          topK: 3,
          documentFilter: { $contains: 'quick brown' }, // Test multi-word match
        });
        expect(results.length).toBe(1);
        expect(results[0].document).toContain('quick brown');
      });

      it('should handle deeply nested logical operators', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName3,
          queryVector: [1.0, 0.0, 0.0],
          topK: 3,
          documentFilter: {
            $or: [
              {
                $and: [{ $contains: 'quick' }, { $not_contains: 'fox' }],
              },
              {
                $and: [{ $contains: 'box' }, { $not_contains: 'quick' }],
              },
            ],
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          if (result.document?.includes('quick')) {
            expect(result.document).not.toContain('fox');
          } else if (result.document?.includes('box')) {
            expect(result.document).not.toContain('quick');
          }
        });
      });
    });
  });
  describe('Deprecation Warnings', () => {
    const indexName = 'test_deprecation_warnings';

    const indexName2 = 'test_deprecation_warnings2';

    let warnSpy;

    beforeEach(async () => {
      warnSpy = vi.spyOn(vectorDB['logger'], 'warn');
      await vectorDB.createIndex({ indexName: indexName, dimension: 3 });
    });

    afterEach(async () => {
      warnSpy.mockRestore();
      await vectorDB.deleteIndex(indexName);
    });

    it('should show deprecation warning when using individual args for createIndex', async () => {
      await vectorDB.createIndex(indexName2, 3, 'cosine');
      await vectorDB.deleteIndex(indexName2);

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
      await vectorDB.deleteIndex(indexName2);

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should maintain backward compatibility with individual args', async () => {
      // Query
      const queryResults = await vectorDB.query(indexName, [1, 2, 3], 5);
      expect(Array.isArray(queryResults)).toBe(true);

      // CreateIndex
      await expect(vectorDB.createIndex(indexName2, 3, 'cosine')).resolves.not.toThrow();
      await vectorDB.deleteIndex(indexName2);

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
