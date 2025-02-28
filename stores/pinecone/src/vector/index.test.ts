import dotenv from 'dotenv';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, afterEach } from 'vitest';

import { PineconeVector } from './';

dotenv.config();

const PINECONE_API_KEY = process.env.PINECONE_API_KEY!;

// if (!PINECONE_API_KEY) {
//   throw new Error('Please set PINECONE_API_KEY and PINECONE_ENVIRONMENT in .env file');
// }
// TODO: skip until we the secrets on Github

function waitUntilReady(vectorDB: PineconeVector, indexName: string) {
  return new Promise(resolve => {
    const interval = setInterval(async () => {
      try {
        const stats = await vectorDB.describeIndex(indexName);
        if (!!stats) {
          clearInterval(interval);
          resolve(true);
        }
      } catch (error) {
        console.log(error);
      }
    }, 1000);
  });
}

function waitUntilVectorsIndexed(vectorDB: PineconeVector, indexName: string, expectedCount: number) {
  return new Promise((resolve, reject) => {
    const maxAttempts = 30; // 30 seconds max
    let attempts = 0;
    const interval = setInterval(async () => {
      try {
        const stats = await vectorDB.describeIndex(indexName);
        if (stats && stats.count >= expectedCount) {
          clearInterval(interval);
          resolve(true);
        }
        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error('Timeout waiting for vectors to be indexed'));
        }
      } catch (error) {
        console.log(error);
      }
    }, 1000);
  });
}
// TODO: our pinecone account is over the limit, tests don't work in CI
describe.skip('PineconeVector Integration Tests', () => {
  let vectorDB: PineconeVector;
  const testIndexName = 'test-index-' + Date.now(); // Unique index name for each test run
  const dimension = 3;

  beforeAll(async () => {
    vectorDB = new PineconeVector(PINECONE_API_KEY);
    // Create test index
    await vectorDB.createIndex({ indexName: testIndexName, dimension });
    await waitUntilReady(vectorDB, testIndexName);
  }, 500000);

  afterAll(async () => {
    // Cleanup: delete test index
    await vectorDB.deleteIndex(testIndexName);
  }, 500000);

  describe('Index Operations', () => {
    it('should list indexes including our test index', async () => {
      const indexes = await vectorDB.listIndexes();
      expect(indexes).toContain(testIndexName);
    }, 500000);

    it('should describe index with correct properties', async () => {
      const stats = await vectorDB.describeIndex(testIndexName);
      expect(stats.dimension).toBe(dimension);
      expect(stats.metric).toBe('cosine');
      expect(typeof stats.count).toBe('number');
    }, 500000);
  });

  describe('Vector Operations', () => {
    const testVectors = [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0],
    ];
    const testMetadata = [{ label: 'x-axis' }, { label: 'y-axis' }, { label: 'z-axis' }];
    let vectorIds: string[];

    it('should upsert vectors with metadata', async () => {
      vectorIds = await vectorDB.upsert({ indexName: testIndexName, vectors: testVectors, metadata: testMetadata });
      expect(vectorIds).toHaveLength(3);
      // Wait for vectors to be indexed
      await waitUntilVectorsIndexed(vectorDB, testIndexName, 3);
    }, 500000);

    it.skip('should query vectors and return nearest neighbors', async () => {
      const queryVector = [1.0, 0.1, 0.1];
      const results = await vectorDB.query({ indexName: testIndexName, queryVector, topK: 3 });

      expect(results).toHaveLength(3);
      expect(results[0]!.score).toBeGreaterThan(0);
      expect(results[0]!.metadata).toBeDefined();
    }, 500000);

    it('should query vectors with metadata filter', async () => {
      const queryVector = [0.0, 1.0, 0.0];
      const filter = { label: 'y-axis' };

      const results = await vectorDB.query({ indexName: testIndexName, queryVector, topK: 1, filter });

      expect(results).toHaveLength(1);
      expect(results?.[0]?.metadata?.label).toBe('y-axis');
    }, 500000);

    it('should query vectors and return vectors in results', async () => {
      const queryVector = [0.0, 1.0, 0.0];
      const results = await vectorDB.query({ indexName: testIndexName, queryVector, topK: 1, includeVector: true });

      expect(results).toHaveLength(1);
      expect(results?.[0]?.vector).toBeDefined();
      expect(results?.[0]?.vector).toHaveLength(dimension);
    }, 500000);
  });

  describe('Error Handling', () => {
    it('should handle non-existent index query gracefully', async () => {
      const nonExistentIndex = 'non-existent-index';
      await expect(vectorDB.query({ indexName: nonExistentIndex, queryVector: [1, 0, 0] })).rejects.toThrow();
    }, 500000);

    it('should handle incorrect dimension vectors', async () => {
      const wrongDimVector = [[1, 0]]; // 2D vector for 3D index
      await expect(vectorDB.upsert({ indexName: testIndexName, vectors: wrongDimVector })).rejects.toThrow();
    }, 500000);
  });

  describe('Performance Tests', () => {
    it('should handle batch upsert of 1000 vectors', async () => {
      const batchSize = 1000;
      const vectors = Array(batchSize)
        .fill(null)
        .map(() =>
          Array(dimension)
            .fill(null)
            .map(() => Math.random()),
        );
      const metadata = vectors.map((_, i) => ({ id: i }));

      const start = Date.now();
      const ids = await vectorDB.upsert({ indexName: testIndexName, vectors, metadata });
      const duration = Date.now() - start;

      expect(ids).toHaveLength(batchSize);
      console.log(`Batch upsert of ${batchSize} vectors took ${duration}ms`);
    }, 300000); // 5 minute timeout

    it('should perform multiple concurrent queries', async () => {
      const queryVector = [1, 0, 0];
      const numQueries = 10;

      const start = Date.now();
      const promises = Array(numQueries)
        .fill(null)
        .map(() => vectorDB.query({ indexName: testIndexName, queryVector }));

      const results = await Promise.all(promises);
      const duration = Date.now() - start;

      expect(results).toHaveLength(numQueries);
      console.log(`${numQueries} concurrent queries took ${duration}ms`);
    }, 500000);
  });

  describe('Filter Validation in Queries', () => {
    it('rejects queries with null values', async () => {
      await expect(
        vectorDB.query({ indexName: testIndexName, queryVector: [1, 0, 0], topK: 10, filter: { field: null } }),
      ).rejects.toThrow();

      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { other: { $eq: null } },
        }),
      ).rejects.toThrow('the $eq operator must be followed by a string, boolean or a number, got null instead');
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
          ).rejects.toThrow(`the ${op} operator must be followed by a list of strings or a list of numbers`);
        }
      }
    });

    it('validates comparison operators', async () => {
      const numOps = ['$gt', '$gte', '$lt', '$lte'];
      const invalidNumericValues = ['not-a-number', true, [], {}, null]; // Removed undefined
      for (const op of numOps) {
        for (const val of invalidNumericValues) {
          await expect(
            vectorDB.query({
              indexName: testIndexName,
              queryVector: [1, 0, 0],
              filter: { field: { [op]: val } },
            }),
          ).rejects.toThrow(`the ${op} operator must be followed by a number`);
        }
      }
    });

    it('rejects multiple invalid values', async () => {
      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { field1: { $in: 'not-array' }, field2: { $exists: 'not-boolean' }, field3: { $gt: 'not-number' } },
        }),
      ).rejects.toThrow();
    });

    it('rejects invalid array values', async () => {
      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { field: { $in: [null] } },
        }),
      ).rejects.toThrow('the $in operator must be followed by a list of strings or a list of numbers');

      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { field: { $in: [undefined] } },
        }),
      ).rejects.toThrow('the $in operator must be followed by a list of strings or a list of numbers');

      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { field: { $all: 'not-an-array' } },
        }),
      ).rejects.toThrow('A non-empty array is required for the $all operator');
    });

    it('handles empty object filters', async () => {
      // Test empty object at top level
      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { field: { $eq: {} } },
        }),
      ).rejects.toThrow('the $eq operator must be followed by a string, boolean or a number, got {} instead');
    });

    it('handles empty/undefined filters by returning all results', async () => {
      // Empty objects and undefined are ignored by Pinecone
      // and will return all results without filtering
      const noFilterCases = [{ field: {} }, { field: undefined }, { field: { $in: undefined } }];

      for (const filter of noFilterCases) {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter,
        });
        expect(results.length).toBeGreaterThan(0);
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
      ).rejects.toThrow('You must enter a `filter` object with at least one key-value pair.');
    });
  });

  describe('Metadata Filter Tests', () => {
    const testVectors = [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0],
      [0.5, 0.5, 0.0],
      [0.3, 0.3, 0.3],
      [0.8, 0.1, 0.1],
      [0.1, 0.8, 0.1],
      [0.1, 0.1, 0.8],
    ];

    const testMetadata = [
      { category: 'electronics', price: 1000, tags: ['premium', 'new'], inStock: true, rating: 4.5 },
      { category: 'books', price: 50, tags: ['bestseller'], inStock: true, rating: 4.8 },
      { category: 'electronics', price: 500, tags: ['refurbished'], inStock: false, rating: 4.0 },
      { category: 'clothing', price: 75, tags: ['summer', 'sale'], inStock: true, rating: 4.2 },
      { category: 'books', price: 30, tags: ['paperback', 'sale'], inStock: true, rating: 4.1 },
      { category: 'electronics', price: 800, tags: ['premium'], inStock: true, rating: 4.7 },
      { category: 'clothing', price: 150, tags: ['premium', 'new'], inStock: false, rating: 4.4 },
      { category: 'books', price: 25, tags: ['paperback', 'bestseller'], inStock: true, rating: 4.3 },
    ];

    beforeAll(async () => {
      await vectorDB.upsert({ indexName: testIndexName, vectors: testVectors, metadata: testMetadata });
      // Wait for vectors to be indexed
      await waitUntilVectorsIndexed(vectorDB, testIndexName, testVectors.length);
    }, 500000);

    describe('Comparison Operators', () => {
      it('should filter with implict $eq', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { category: 'electronics' },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
        });
      });
      it('should filter with $eq operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { category: { $eq: 'electronics' } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
        });
      });

      it('should filter with $gt operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { price: { $gt: 500 } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeGreaterThan(500);
        });
      });

      it('should filter with $gte operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { price: { $gte: 500 } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeGreaterThanOrEqual(500);
        });
      });

      it('should filter with $lt operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { price: { $lt: 100 } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeLessThan(100);
        });
      });

      it('should filter with $lte operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { price: { $lte: 50 } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeLessThanOrEqual(50);
        });
      });

      it('should filter with $ne operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { category: { $ne: 'electronics' } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).not.toBe('electronics');
        });
      });

      it('filters with $gte, $lt, $lte operators', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { price: { $gte: 25, $lte: 30 } },
        });
        expect(results.length).toBe(2);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeLessThanOrEqual(30);
          expect(Number(result.metadata?.price)).toBeGreaterThanOrEqual(25);
        });
      });
    });

    describe('Array Operators', () => {
      it('should filter with $in operator for strings', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
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
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { price: { $in: [50, 75, 1000] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect([50, 75, 1000]).toContain(result.metadata?.price);
        });
      });

      it('should filter with $nin operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { category: { $nin: ['electronics', 'books'] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).not.toContain(result.metadata?.category);
        });
      });

      it('should filter with $all operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $all: ['premium', 'new'] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.tags).toContain('premium');
          expect(result.metadata?.tags).toContain('new');
        });
      });
    });

    describe('Logical Operators', () => {
      it('should filter with implict $and', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { category: 'electronics', price: { $gt: 700 }, inStock: true },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
          expect(Number(result.metadata?.price)).toBeGreaterThan(700);
          expect(result.metadata?.inStock).toBe(true);
        });
      });
      it('should filter with $and operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
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

      it('should filter with $or operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { $or: [{ price: { $gt: 900 } }, { tags: { $all: ['bestseller'] } }] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          const condition1 = Number(result.metadata?.price) > 900;
          const condition2 = result.metadata?.tags?.includes('bestseller');
          expect(condition1 || condition2).toBe(true);
        });
      });

      it('should handle nested logical operators', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
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
    });

    describe('Complex Filter Combinations', () => {
      it('should combine comparison and array operators', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { $and: [{ price: { $gte: 500 } }, { tags: { $in: ['premium', 'refurbished'] } }] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeGreaterThanOrEqual(500);
          expect(result.metadata?.tags?.some(tag => ['premium', 'refurbished'].includes(tag))).toBe(true);
        });
      });

      it('should handle multiple conditions on same field', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
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

      it('should handle complex nested conditions', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: {
            $or: [
              {
                $and: [{ category: 'electronics' }, { price: { $gt: 700 } }, { tags: { $all: ['premium'] } }],
              },
              {
                $and: [{ category: 'books' }, { price: { $lt: 50 } }, { tags: { $in: ['paperback'] } }],
              },
            ],
          },
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

      it('combines existence checks with other operators', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { $and: [{ category: 'clothing' }, { optionalField: { $exists: false } }] },
        });
        expect(results.length).toBe(2);
        expect(results[0]!.metadata!.category).toBe('clothing');
        expect('optionalField' in results[0]!.metadata!).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      it('should handle numeric comparisons with decimals', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { rating: { $gt: 4.5 } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.rating)).toBeGreaterThan(4.5);
        });
      });

      it('should handle boolean values', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { inStock: { $eq: false } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.inStock).toBe(false);
        });
      });

      it('should handle empty array in $in operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { category: { $in: [] } },
        });
        expect(results).toHaveLength(0);
      });

      it('should handle single value in $all operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $all: ['premium'] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.tags).toContain('premium');
        });
      });
    });
  });

  describe('Additional Validation Tests', () => {
    it('should reject non-numeric values in numeric comparisons', async () => {
      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { price: { $gt: '500' } }, // string instead of number
        }),
      ).rejects.toThrow('the $gt operator must be followed by a number');
    });

    it('should reject invalid types in $in operator', async () => {
      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { price: { $in: [true, false] } }, // booleans instead of numbers
        }),
      ).rejects.toThrow('the $in operator must be followed by a list of strings or a list of numbers');
    });

    it('should reject mixed types in $in operator', async () => {
      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { field: { $in: ['string', 123] } }, // mixed string and number
        }),
      ).rejects.toThrow();
    });
    it('should handle undefined filter', async () => {
      const results1 = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        filter: undefined,
      });
      const results2 = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
      });
      expect(results1).toEqual(results2);
      expect(results1.length).toBeGreaterThan(0);
    });

    it('should handle null filter', async () => {
      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        filter: null,
      });
      const results2 = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
      });
      expect(results).toEqual(results2);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Additional Edge Cases', () => {
    it('should handle exact boundary conditions', async () => {
      // Test exact boundary values from our test data
      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        filter: { $and: [{ price: { $gte: 25 } }, { price: { $lte: 1000 } }] },
      });
      expect(results.length).toBeGreaterThan(0);
      // Should include both boundary values
      expect(results.some(r => r.metadata?.price === 25)).toBe(true);
      expect(results.some(r => r.metadata?.price === 1000)).toBe(true);
    });

    it('should handle multiple $all conditions on same array field', async () => {
      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        filter: { $and: [{ tags: { $all: ['premium'] } }, { tags: { $all: ['new'] } }] },
      });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.metadata?.tags).toContain('premium');
        expect(result.metadata?.tags).toContain('new');
      });
    });

    it('should handle multiple array operator combinations', async () => {
      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        filter: { $and: [{ tags: { $all: ['premium'] } }, { tags: { $in: ['new', 'refurbished'] } }] },
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
      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        filter: {
          $or: [
            {
              $and: [{ category: 'electronics' }, { $or: [{ price: { $gt: 900 } }, { tags: { $all: ['premium'] } }] }],
            },
            {
              $and: [{ category: 'books' }, { $or: [{ price: { $lt: 30 } }, { tags: { $all: ['bestseller'] } }] }],
            },
          ],
        },
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
      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        filter: { $or: [{ price: { $gt: 500 } }, { rating: { $gt: 4.5 } }] },
      });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(Number(result.metadata?.price) > 500 || Number(result.metadata?.rating) > 4.5).toBe(true);
      });
    });

    it('should handle combination of array and numeric comparisons', async () => {
      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        filter: {
          $and: [
            { tags: { $in: ['premium', 'bestseller'] } },
            { $or: [{ price: { $gt: 500 } }, { rating: { $gt: 4.5 } }] },
          ],
        },
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
      const results = await vectorDB.query({
        indexName: testIndexName,
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
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        filter: {
          $or: Array(5)
            .fill(null)
            .map(() => ({
              $and: [{ category: { $in: ['electronics', 'books'] } }, { price: { $gt: 50 } }, { rating: { $gt: 4.0 } }],
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
        indexName: testIndexName,
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
  describe('Deprecation Warnings', () => {
    const indexName = 'testdeprecationwarnings';

    const indexName2 = 'testdeprecationwarnings2';

    const indexName3 = 'testdeprecationwarnings3';

    const indexName4 = 'testdeprecationwarnings4';

    let warnSpy;

    beforeAll(async () => {
      try {
        await vectorDB.deleteIndex(indexName);
      } catch {
        // Ignore errors if index doesn't exist
      }
      try {
        await vectorDB.deleteIndex(indexName2);
      } catch {
        // Ignore errors if index doesn't exist
      }
      try {
        await vectorDB.deleteIndex(indexName3);
      } catch {
        // Ignore errors if index doesn't exist
      }
      try {
        await vectorDB.deleteIndex(indexName4);
      } catch {
        // Ignore errors if index doesn't exist
      }
      await vectorDB.createIndex({ indexName: indexName, dimension: 3 });
      await waitUntilReady(vectorDB, indexName);
    });

    afterAll(async () => {
      await vectorDB.deleteIndex(indexName);
      await vectorDB.deleteIndex(indexName2);
      await vectorDB.deleteIndex(indexName3);
      await vectorDB.deleteIndex(indexName4);
    });

    beforeEach(async () => {
      warnSpy = vi.spyOn(vectorDB['logger'], 'warn');
    });

    afterEach(async () => {
      warnSpy.mockRestore();
    });

    it('should show deprecation warning when using individual args for createIndex', async () => {
      await vectorDB.createIndex(indexName2, 3, 'cosine');
      await waitUntilReady(vectorDB, indexName2);
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
        indexName: indexName3,
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
      await expect(vectorDB.createIndex(indexName4, 3, 'cosine')).resolves.not.toThrow();
      await waitUntilReady(vectorDB, indexName4);
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
