import { createVectorTestSuite } from '@internal/storage-test-utils';
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';

import { AstraVector } from './';

// Give tests enough time to complete database operations
vi.setConfig({ testTimeout: 300000, hookTimeout: 300000 });

// Helper function to wait for condition with timeout
async function waitForCondition(
  condition: () => Promise<boolean>,
  timeout: number = 10000,
  interval: number = 1000,
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  return false;
}

async function createIndexAndWait(
  vectorDB: AstraVector,
  indexName: string,
  dimension: number,
  metric: 'cosine' | 'euclidean' | 'dotproduct',
) {
  await vectorDB.createIndex({ indexName, dimension, metric });
  const created = await waitForCondition(
    async () => {
      const newCollections = await vectorDB.listIndexes();
      return newCollections.includes(indexName);
    },
    30000,
    2000,
  );
  if (!created) {
    throw new Error('Timed out waiting for collection to be created');
  }
}

async function deleteIndexAndWait(vectorDB: AstraVector, indexName: string) {
  await vectorDB.deleteIndex({ indexName });
  const deleted = await waitForCondition(
    async () => {
      const newCollections = await vectorDB.listIndexes();
      return !newCollections.includes(indexName);
    },
    30000,
    2000,
  );
  if (!deleted) {
    throw new Error('Timed out waiting for collection to be deleted');
  }
}

describe.skip('AstraVector Integration Tests', () => {
  let vectorDB: AstraVector;
  const testIndexName = 'testvectors1733728136118'; // Unique collection name
  const testIndexName2 = 'testvectors1733728136119'; // Unique collection name

  beforeAll(async () => {
    // Ensure required environment variables are set
    const token = process.env.ASTRA_DB_TOKEN;
    const endpoint = process.env.ASTRA_DB_ENDPOINT;
    const keyspace = process.env.ASTRA_DB_KEYSPACE;

    if (!token || !endpoint) {
      throw new Error('Please set ASTRA_DB_TOKEN and ASTRA_DB_ENDPOINT environment variables');
    }

    vectorDB = new AstraVector({
      token,
      endpoint,
      keyspace,
    });
    try {
      const collections = await vectorDB.listIndexes();
      await Promise.all(collections.map(c => vectorDB.deleteIndex({ indexName: c })));
      const deleted = await waitForCondition(
        async () => {
          const remainingCollections = await vectorDB.listIndexes();
          return remainingCollections.length === 0;
        },
        30000,
        2000,
      );
      if (!deleted) {
        throw new Error('Timed out waiting for collections to be deleted');
      }
    } catch (error) {
      console.error('Failed to delete test collections:', error);
      throw error;
    }

    await createIndexAndWait(vectorDB, testIndexName, 4, 'cosine');
    await createIndexAndWait(vectorDB, testIndexName2, 4, 'cosine');
  }, 500000);

  afterAll(async () => {
    // Cleanup: delete test collection
    try {
      await vectorDB.deleteIndex({ indexName: testIndexName });
    } catch (error) {
      console.error('Failed to delete test collection:', error);
    }
    try {
      await vectorDB.deleteIndex({ indexName: testIndexName2 });
    } catch (error) {
      console.error('Failed to delete test collection:', error);
    }
  });

  describe('Metadata Filter Tests', () => {
    // Set up test vectors and metadata
    beforeAll(async () => {
      const vectors = [
        [1, 0, 0, 0], // Electronics
        [0, 1, 0, 0], // Books
        [0, 0, 1, 0], // Electronics
        [0, 0, 0, 1], // Books
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

      await vectorDB.upsert({
        indexName: testIndexName2,
        vectors,
        metadata,
      });
      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 2000));
    });

    describe('Logical Operators', () => {
      it('filters with direct field comparison', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            $not: { 'metadata.category': 'electronics' }, // Simple field equality
          },
        });
        expect(results.length).toBe(2);
        results.forEach(result => {
          expect(result.metadata?.category).not.toBe('electronics');
        });
      });

      it('filters with multiple fields', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            $not: {
              'metadata.category': 'electronics',
              'metadata.price': 100,
            },
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category === 'electronics' && result.metadata?.price === 100).toBe(false);
        });
      });

      it('uses $not within $or', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            $or: [{ $not: { 'metadata.category': 'electronics' } }, { 'metadata.price': { $gt: 100 } }],
          },
        });
        expect(results.length).toBeGreaterThan(0);
      });
    });

    describe('Nested Field Queries', () => {
      it('filters on nested object fields', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            'metadata.specs.color': 'black',
          },
        });
        expect(results.length).toBe(1);
        expect(results[0]?.metadata?.specs?.color).toBe('black');
      });

      it('combines nested field queries with logical operators', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            $or: [{ 'metadata.specs.weight': { $lt: 2.0 } }, { 'metadata.author.country': 'UK' }],
          },
        });
        expect(results.length).toBe(2);
        results.forEach(result => {
          expect(result.metadata?.specs?.weight < 2.0 || result.metadata?.author?.country === 'UK').toBe(true);
        });
      });
    });

    describe('Complex Filter Combinations', () => {
      it('handles complex nested conditions', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            $or: [
              {
                $and: [
                  { 'metadata.category': 'electronics' },
                  { 'metadata.specs.weight': { $lt: 2.0 } },
                  { 'metadata.tags': { $in: ['premium'] } },
                ],
              },
              {
                $and: [
                  { 'metadata.category': 'books' },
                  { 'metadata.price': { $lt: 20 } },
                  { 'metadata.author.country': 'UK' },
                ],
              },
            ],
          },
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
    });

    describe('Field Existence and Null Checks', () => {
      beforeAll(async () => {
        // Add some vectors with special metadata cases
        const vectors = [
          [0.5, 0.5, 0.5, 0.5],
          [0.3, 0.3, 0.3, 0.3],
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

        await vectorDB.upsert({
          indexName: testIndexName2,
          vectors,
          metadata,
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
      });

      it('handles empty array edge cases', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            'metadata.emptyArray': { $size: 0 },
          },
        });
        expect(results.length).toBe(1);
        expect(results[0]!.metadata!.emptyArray).toHaveLength(0);
      });
    });

    describe('Date and Numeric Edge Cases', () => {
      beforeAll(async () => {
        const vectors = [
          [0.1, 0.1, 0.1, 0.1],
          [0.2, 0.2, 0.2, 0.2],
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
          queryVector: [1, 0, 0, 0],
          filter: {
            $or: [{ 'metadata.numericFields.zero': 0 }, { 'metadata.numericFields.negativeZero': 0 }],
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          const value = result.metadata?.numericFields?.zero ?? result.metadata?.numericFields?.negativeZero;
          expect(value).toBe(0);
        });
      });

      it('compares dates correctly', async () => {
        const now = new Date().toISOString();
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            $and: [
              { 'metadata.dateFields.current': { $lte: now } },
              { 'metadata.dateFields.current': { $gt: new Date(0).toISOString() } },
            ],
          },
        });
        expect(results.length).toBeGreaterThan(0);
      });
    });

    describe('Advanced Array Operations', () => {
      beforeAll(async () => {
        const vectors = [
          [0.7, 0.7, 0.7, 0.7],
          [0.8, 0.8, 0.8, 0.8],
          [0.9, 0.9, 0.9, 0.9],
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

        await vectorDB.upsert({
          indexName: testIndexName2,
          vectors,
          metadata,
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
      });

      it('combines $size with $exists for array fields', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            $and: [{ 'metadata.arrays.empty': { $exists: true } }, { 'metadata.arrays.empty': { $size: 0 } }],
          },
        });
        expect(results.length).toBe(2);
        results.forEach(result => {
          expect(result.metadata?.arrays?.empty).toBeDefined();
          expect(result.metadata?.arrays?.empty).toHaveLength(0);
        });
      });

      it('filters arrays by exact size matching', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            $and: [{ 'metadata.arrays.multiple': { $size: 3 } }, { 'metadata.arrays.multiple': { $in: ['two'] } }],
          },
        });
        expect(results.length).toBe(1);
        expect(results[0]?.metadata?.arrays?.multiple).toContain('two');
        expect(results[0]?.metadata?.arrays?.multiple).toHaveLength(3);
      });
    });
  });

  describe('Error Handling', () => {
    const testIndexName = 'test_index_error';
    beforeAll(async () => {
      await vectorDB.createIndex({ indexName: testIndexName, dimension: 3 });
    });

    afterAll(async () => {
      await vectorDB.deleteIndex({ indexName: testIndexName });
    });

    it('should handle duplicate index creation gracefully', async () => {
      const duplicateIndexName = `duplicate_test`;
      const dimension = 768;

      try {
        // Create index first time
        await vectorDB.createIndex({
          indexName: duplicateIndexName,
          dimension,
          metric: 'cosine',
        });

        // Try to create with same dimensions - should not throw
        await expect(
          vectorDB.createIndex({
            indexName: duplicateIndexName,
            dimension,
            metric: 'cosine',
          }),
        ).resolves.not.toThrow();

        // Try to create with different dimensions - should throw
        await expect(
          vectorDB.createIndex({
            indexName: duplicateIndexName,
            dimension: dimension + 1,
            metric: 'cosine',
          }),
        ).rejects.toThrow(
          `Collection already exists: trying to create Collection ('${duplicateIndexName}') with different settings`,
        );
      } finally {
        // Cleanup
        await vectorDB.deleteIndex({ indexName: duplicateIndexName });
      }
    });
  });
});

// Shared Test Suite Integration
// Following the pattern from stores/pg - integrates all 6 test domains from shared suite
describe('AstraVector Shared Test Suite', () => {
  const token = process.env.ASTRA_DB_TOKEN;
  const endpoint = process.env.ASTRA_DB_ENDPOINT;
  const keyspace = process.env.ASTRA_DB_KEYSPACE;

  if (!token || !endpoint) {
    console.warn('Skipping shared test suite: ASTRA_DB_TOKEN and ASTRA_DB_ENDPOINT environment variables not set');
    return;
  }

  const sharedVectorDB = new AstraVector({
    token,
    endpoint,
    keyspace,
  });

  createVectorTestSuite({
    vector: sharedVectorDB,
    createIndex: async (indexName: string) => {
      // Using dimension 1536 as required by the shared test suite
      await createIndexAndWait(sharedVectorDB, indexName, 1536, 'cosine');
    },
    deleteIndex: async (indexName: string) => {
      await deleteIndexAndWait(sharedVectorDB, indexName);
    },
    waitForIndexing: async () => {
      // Astra needs time for eventual consistency
      // Using a fixed delay since we already wait in createIndexAndWait
      await new Promise(resolve => setTimeout(resolve, 2000));
    },
  });
});
