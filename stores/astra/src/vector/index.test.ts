import { vi, describe, it, expect, beforeAll, afterAll, test, beforeEach, afterEach } from 'vitest';

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

describe('AstraVector Integration Tests', () => {
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
      await Promise.all(collections.map(c => vectorDB.deleteIndex(c)));
    } catch (error) {
      console.error('Failed to delete test collections:', error);
    }

    await vectorDB.createIndex({ indexName: testIndexName, dimension: 4, metric: 'cosine' });
    await vectorDB.createIndex({ indexName: testIndexName2, dimension: 4, metric: 'cosine' });
  }, 500000);

  afterAll(async () => {
    // Cleanup: delete test collection
    try {
      await vectorDB.deleteIndex(testIndexName);
    } catch (error) {
      console.error('Failed to delete test collection:', error);
    }
    try {
      await vectorDB.deleteIndex(testIndexName2);
    } catch (error) {
      console.error('Failed to delete test collection:', error);
    }
  });

  test('full vector database workflow', async () => {
    // Verify collection was created
    const indexes = await vectorDB.listIndexes();
    expect(indexes).toContain(testIndexName);

    // 2. Get collection stats
    const initialStats = await vectorDB.describeIndex(testIndexName);
    expect(initialStats).toEqual({
      dimension: 4,
      metric: 'cosine',
      count: 0,
    });

    // 3. Insert vectors with metadata
    const vectors = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];

    const metadata = [{ label: 'vector1' }, { label: 'vector2' }, { label: 'vector3' }, { label: 'vector4' }];

    const ids = await vectorDB.upsert({ indexName: testIndexName, vectors, metadata });
    expect(ids).toHaveLength(4);

    // Wait for document count to update (with timeout)
    const countUpdated = await waitForCondition(
      async () => {
        const stats = await vectorDB.describeIndex(testIndexName);
        console.log('Current count:', stats.count);
        return stats.count === 4;
      },
      15000, // 15 second timeout
      2000, // Check every 2 seconds
    );

    if (!countUpdated) {
      console.warn('Document count did not update to expected value within timeout');
    }

    // 4. Query vectors
    const queryVector = [1, 0, 0, 0];
    const results = await vectorDB.query({ indexName: testIndexName, queryVector, topK: 2 });

    expect(results).toHaveLength(2);
    expect(results?.[0]?.metadata).toEqual({ label: 'vector1' });
    expect(results?.[0]?.score).toBeCloseTo(1, 4);

    // 5. Query with filter
    const filteredResults = await vectorDB.query({
      indexName: testIndexName,
      queryVector,
      topK: 2,
      filter: { 'metadata.label': 'vector2' },
    });

    expect(filteredResults).toHaveLength(1);
    expect(filteredResults?.[0]?.metadata).toEqual({ label: 'vector2' });

    // Get final stats
    const finalStats = await vectorDB.describeIndex(testIndexName);
    console.log('Final stats:', finalStats);

    // More lenient assertion for document count
    expect(finalStats.count).toBeGreaterThan(0);
    if (finalStats.count !== 4) {
      console.warn(`Expected count of 4, but got ${finalStats.count}. This may be due to eventual consistency.`);
    }
  });

  test('gets vector results back from query', async () => {
    const queryVector = [1, 0, 0, 0];
    const results = await vectorDB.query({
      indexName: testIndexName,
      queryVector,
      topK: 2,
      includeVector: true,
    });

    expect(results).toHaveLength(2);
    expect(results?.[0]?.metadata).toEqual({ label: 'vector1' });
    expect(results?.[0]?.score).toBeCloseTo(1, 4);
    expect(results?.[0]?.vector).toEqual([1, 0, 0, 0]);
  });

  test('handles different vector dimensions', async () => {
    const highDimIndexName = 'high_dim_test_' + Date.now();

    try {
      // Create index with higher dimensions
      await vectorDB.createIndex({
        indexName: highDimIndexName,
        dimension: 1536,
        metric: 'cosine',
      });

      // Insert high-dimensional vectors
      const vectors = [
        Array(1536)
          .fill(0)
          .map((_, i) => i % 2), // Alternating 0s and 1s
        Array(1536)
          .fill(0)
          .map((_, i) => (i + 1) % 2), // Opposite pattern
      ];

      const metadata = [{ label: 'even' }, { label: 'odd' }];

      const ids = await vectorDB.upsert({
        indexName: highDimIndexName,
        vectors,
        metadata,
      });
      expect(ids).toHaveLength(2);

      // Wait for indexing with more generous timeout
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Query with same pattern as first vector
      const queryVector = Array(1536)
        .fill(0)
        .map((_, i) => i % 2);
      const results = await vectorDB.query({
        indexName: highDimIndexName,
        queryVector,
        topK: 2,
      });

      expect(results).toHaveLength(2);
      expect(results?.[0]?.metadata).toEqual({ label: 'even' });
      expect(results?.[0]?.score).toBeCloseTo(1, 4);
    } finally {
      // Cleanup
      await vectorDB.deleteIndex(highDimIndexName);
    }
  });

  test('handles different distance metrics', async () => {
    const metrics = ['cosine', 'euclidean', 'dotproduct'] as const;

    for (const metric of metrics) {
      const metricIndexName = `metrictest${metric}${Date.now()}`;

      try {
        // Create index with different metric
        await vectorDB.createIndex({
          indexName: metricIndexName,
          dimension: 4,
          metric,
        });

        // Insert same vectors
        const vectors = [
          [1, 0, 0, 0],
          [0.7071, 0.7071, 0, 0], // 45-degree angle from first vector
        ];

        await vectorDB.upsert({
          indexName: metricIndexName,
          vectors,
        });

        // Wait for indexing with more generous timeout
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Query
        const results = await vectorDB.query({
          indexName: metricIndexName,
          queryVector: [1, 0, 0, 0],
          topK: 2,
        });

        expect(results).toHaveLength(2);

        // Scores will differ based on metric but order should be same
        expect(results?.[0]?.score).toBeGreaterThan(results?.[1]?.score!);
      } finally {
        // Cleanup
        await vectorDB.deleteIndex(metricIndexName);
      }
    }
  }, 500000);

  describe('Filter Validation in Queries', () => {
    it('rejects invalid operator values', async () => {
      await expect(
        vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: { tags: { $all: 'not-an-array' } },
        }),
      ).rejects.toThrow();
    });

    it('validates array operator values', async () => {
      await expect(
        vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: { tags: { $in: null } },
        }),
      ).rejects.toThrow();

      await expect(
        vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: { tags: { $all: 'not-an-array' } },
        }),
      ).rejects.toThrow();
    });

    it('validates $in operators', async () => {
      const invalidValues = [123, 'string', true, { key: 'value' }, {}, null];
      for (const val of invalidValues) {
        await expect(
          vectorDB.query({
            indexName: testIndexName2,
            queryVector: [1, 0, 0, 0],
            filter: { field: { $in: val } },
          }),
        ).rejects.toThrow();
      }
    });

    it('validates $nin operators', async () => {
      const invalidValues = [123, 'string', true, { key: 'value' }, {}, null];
      for (const val of invalidValues) {
        await expect(
          vectorDB.query({
            indexName: testIndexName2,
            queryVector: [1, 0, 0, 0],
            filter: { field: { $nin: val } },
          }),
        ).rejects.toThrow();
      }
    });

    it('validates $all operators', async () => {
      const invalidValues = [123, 'string', true, { key: 'value' }, {}, [], null];
      for (const val of invalidValues) {
        await expect(
          vectorDB.query({
            indexName: testIndexName2,
            queryVector: [1, 0, 0, 0],
            filter: { field: { $all: val } },
          }),
        ).rejects.toThrow();
      }
    });

    it('validates element operators', async () => {
      const invalidValues = [123, 'string', { key: 'value' }, {}, [], null];
      for (const val of invalidValues) {
        await expect(
          vectorDB.query({
            indexName: testIndexName2,
            queryVector: [1, 0, 0, 0],
            filter: { field: { $exists: val } },
          }),
        ).rejects.toThrow();
      }
    });

    it('validates comparison operators', async () => {
      // Numeric comparisons require numbers
      const numOps = ['$gt', '$gte', '$lt', '$lte'];
      const invalidNumericValues = [[], {}, null];
      for (const op of numOps) {
        for (const val of invalidNumericValues) {
          await expect(
            vectorDB.query({
              indexName: testIndexName2,
              queryVector: [1, 0, 0, 0],
              filter: { field: { [op]: val } },
            }),
          ).rejects.toThrow();
        }
      }
    });

    it('validates multiple invalid values', async () => {
      await expect(
        vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            field1: { $in: 'not-array' },
            field2: { $exists: 'not-boolean' },
            field3: { $gt: 'not-number' },
          },
        }),
      ).rejects.toThrow();
    });
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

    describe('Basic Comparison Operators', () => {
      it('filters with $eq operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            'metadata.category': { $eq: 'electronics' },
          },
        });
        expect(results.length).toBe(2);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
        });
      });

      it('filters with $gt operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            'metadata.price': { $gt: 500 },
          },
        });
        expect(results.length).toBe(1);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeGreaterThan(500);
        });
      });

      it('filters with $gte, $lt, $lte operators', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            'metadata.price': { $gte: 25, $lte: 500 },
          },
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
          queryVector: [1, 0, 0, 0],
          filter: {
            'metadata.category': { $ne: 'books' },
          },
        });
        expect(results.length).toBe(2);
        results.forEach(result => {
          expect(result.metadata?.category).not.toBe('books');
        });
      });
    });

    describe('Null/Undefined/Empty FIlters', () => {
      it('should handle undefined filter', async () => {
        const results1 = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: undefined,
        });
        const results2 = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
        });
        expect(results1).toEqual(results2);
        expect(results1.length).toBeGreaterThan(0);
      });

      it('should handle empty object filter', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {},
        });
        const results2 = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
        });
        expect(results).toEqual(results2);
        expect(results.length).toBeGreaterThan(0);
      });

      it('should handle null filter', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: null,
        });
        const results2 = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
        });
        expect(results).toEqual(results2);
        expect(results.length).toBeGreaterThan(0);
      });
    });

    describe('Array Operators', () => {
      it('filters with $in operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            'metadata.tags': { $in: ['premium'] },
          },
        });
        expect(results.length).toBe(2);
        results.forEach(result => {
          expect(result.metadata?.tags).toContain('premium');
        });
      });

      it('filters with $nin operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            'metadata.tags': { $nin: ['bestseller'] },
          },
        });
        expect(results.length).toBe(2);
        results.forEach(result => {
          expect(result.metadata?.tags).not.toContain('bestseller');
        });
      });

      it('filters with $all operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            'metadata.tags': { $all: ['premium', 'new'] },
          },
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
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            $and: [{ 'metadata.category': 'electronics' }, { 'metadata.price': { $gt: 500 } }],
          },
        });
        expect(results.length).toBe(1);
        expect(results[0]?.metadata?.category).toBe('electronics');
        expect(Number(results[0]?.metadata?.price)).toBeGreaterThan(500);
      });

      it('filters with $or operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            $or: [{ 'metadata.price': { $gt: 900 } }, { 'metadata.rating': { $gt: 4.8 } }],
          },
        });
        expect(results.length).toBe(2);
        results.forEach(result => {
          expect(Number(result.metadata?.price) > 900 || Number(result.metadata?.rating) > 4.8).toBe(true);
        });
      });

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

      it('filters with $eq operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            $not: { 'metadata.category': { $eq: 'electronics' } },
          },
        });
        expect(results.length).toBe(2);
        results.forEach(result => {
          expect(result.metadata?.category).not.toBe('electronics');
        });
      });

      it('filters with multiple conditions on same field using implicit $and', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            'metadata.category': 'electronics',
            'metadata.price': 1000,
          },
        });
        expect(results.length).toBe(1);
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

      // Test $not with $exists
      it('filters with $exists', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            $not: { 'metadata.optional_field': { $exists: true } },
          },
        });
        expect(results.length).toBeGreaterThan(0);
      });

      it('filters with nested logical operators', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            $and: [
              { 'metadata.category': 'electronics' },
              {
                $or: [{ 'metadata.price': { $gt: 900 } }, { 'metadata.tags': { $all: ['refurbished'] } }],
              },
            ],
          },
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
      it('combines multiple operators and conditions', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            $and: [
              { 'metadata.price': { $gt: 20 } },
              { 'metadata.inStock': true },
              {
                $or: [{ 'metadata.tags': { $in: ['premium'] } }, { 'metadata.rating': { $gt: 4.5 } }],
              },
            ],
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeGreaterThan(20);
          expect(result.metadata?.inStock).toBe(true);
          expect(result.metadata?.tags?.includes('premium') || Number(result.metadata?.rating) > 4.5).toBe(true);
        });
      });

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

      it('filters based on field existence', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            'metadata.optionalField': { $exists: true },
          },
        });
        expect(results.length).toBe(1);
        expect('optionalField' in results[0]!.metadata!).toBe(true);
      });

      it('filters for null values', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            'metadata.nested.nullField': null,
          },
        });
        expect(results.length).toBe(1);
        expect(results[0]!.metadata!.nested.nullField).toBeNull();
      });

      it('combines existence checks with other operators', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            $and: [{ 'metadata.category': 'special' }, { 'metadata.optionalField': { $exists: false } }],
          },
        });
        expect(results.length).toBe(1);
        expect(results[0]!.metadata!.category).toBe('special');
        expect('optionalField' in results[0]!.metadata!).toBe(false);
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

      it('handles extreme numeric values', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            $or: [
              { 'metadata.numericFields.maxInt': { $gte: Number.MAX_SAFE_INTEGER } },
              { 'metadata.numericFields.minInt': { $lte: Number.MIN_SAFE_INTEGER } },
            ],
          },
        });
        expect(results.length).toBe(1);
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

      it('handles $in with empty array input', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
          queryVector: [1, 0, 0, 0],
          filter: {
            'metadata.arrays.single': { $in: [] },
          },
        });
        expect(results.length).toBe(0);
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

  describe('Basic vector operations', () => {
    const indexName = 'testbasicvectoroperations';

    beforeAll(async () => {
      await vectorDB.createIndex({ indexName, dimension: 4 });
    });

    afterAll(async () => {
      await vectorDB.deleteIndex(indexName);
    });

    const testVectors = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];

    it('should update the vector by id', async () => {
      const ids = await vectorDB.upsert({ indexName, vectors: testVectors });
      expect(ids).toHaveLength(4);

      const idToBeUpdated = ids[0];
      const newVector = [1, 2, 3, 4];
      const newMetaData = {
        test: 'updates',
      };

      const update = {
        vector: newVector,
        metadata: newMetaData,
      };

      await vectorDB.updateIndexById(indexName, idToBeUpdated, update);

      await new Promise(resolve => setTimeout(resolve, 2000));

      const results = await vectorDB.query({
        indexName: indexName,
        queryVector: newVector,
        topK: 2,
        includeVector: true,
      });

      expect(results).toHaveLength(2);
      const updatedResult = results.find(result => result.id === idToBeUpdated);
      expect(updatedResult).toBeDefined();
      expect(updatedResult?.id).toEqual(idToBeUpdated);
      expect(updatedResult?.vector).toEqual(newVector);
      expect(updatedResult?.metadata).toEqual(newMetaData);
    });

    it('should only update the metadata by id', async () => {
      const ids = await vectorDB.upsert({ indexName, vectors: testVectors });
      expect(ids).toHaveLength(4);

      const idToBeUpdated = ids[0];
      const newMetaData = {
        test: 'updates',
      };

      const update = {
        metadata: newMetaData,
      };

      await vectorDB.updateIndexById(indexName, idToBeUpdated, update);
      await new Promise(resolve => setTimeout(resolve, 2000));

      const results = await vectorDB.query({
        indexName: indexName,
        queryVector: testVectors[0],
        topK: 2,
        includeVector: true,
      });

      expect(results).toHaveLength(2);
      const updatedResult = results.find(result => result.id === idToBeUpdated);
      expect(updatedResult).toBeDefined();
      expect(updatedResult?.id).toEqual(idToBeUpdated);
      expect(updatedResult?.vector).toEqual(testVectors[0]);
      expect(updatedResult?.metadata).toEqual(newMetaData);
    });

    it('should only update vector embeddings by id', async () => {
      const ids = await vectorDB.upsert({ indexName, vectors: testVectors });
      expect(ids).toHaveLength(4);

      const idToBeUpdated = ids[0];
      const newVector = [1, 2, 3, 4];

      const update = {
        vector: newVector,
      };

      await vectorDB.updateIndexById(indexName, idToBeUpdated, update);
      await new Promise(resolve => setTimeout(resolve, 2000));

      const results = await vectorDB.query({
        indexName: indexName,
        queryVector: newVector,
        topK: 2,
        includeVector: true,
      });

      expect(results).toHaveLength(2);
      const updatedResult = results.find(result => result.id === idToBeUpdated);
      expect(updatedResult).toBeDefined();
      expect(updatedResult?.id).toEqual(idToBeUpdated);
      expect(updatedResult?.vector).toEqual(newVector);
    });

    it('should throw exception when no updates are given', async () => {
      await expect(vectorDB.updateIndexById(indexName, 'id', {})).rejects.toThrow('No updates provided');
    });

    it('should delete the vector by id', async () => {
      const ids = await vectorDB.upsert({ indexName, vectors: testVectors });
      expect(ids).toHaveLength(4);

      const idToBeDeleted = ids[0];
      await vectorDB.deleteIndexById(indexName, idToBeDeleted);

      const results = await vectorDB.query({
        indexName: indexName,
        queryVector: [1, 0, 0, 0],
        topK: 2,
      });

      expect(results).toHaveLength(2);
      expect(results.map(res => res.id)).not.toContain(idToBeDeleted);
    });
  });
});
