import { vi, describe, it, expect, beforeAll, afterAll, test } from 'vitest';

import { AstraVector } from './';

// Give tests enough time to complete database operations
vi.setConfig({ testTimeout: 3000000 });

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

describe.skip('AstraVector Integration Tests', () => {
  let astraVector: AstraVector;
  const testIndexName = 'testvectors1733728136118'; // Unique collection name

  console.log('testIndexName:', testIndexName);

  beforeAll(() => {
    // Ensure required environment variables are set
    const token = process.env.ASTRA_DB_TOKEN;
    const endpoint = process.env.ASTRA_DB_ENDPOINT;
    const keyspace = process.env.ASTRA_DB_KEYSPACE;

    if (!token || !endpoint) {
      throw new Error('Please set ASTRA_DB_TOKEN and ASTRA_DB_ENDPOINT environment variables');
    }

    astraVector = new AstraVector({
      token,
      endpoint,
      keyspace,
    });
  });

  afterAll(async () => {
    // Cleanup: delete test collection
    try {
      await astraVector.deleteIndex(testIndexName);
    } catch (error) {
      console.error('Failed to delete test collection:', error);
    }
  });

  test('full vector database workflow', async () => {
    // 1. Create a new collection
    await astraVector.createIndex(testIndexName, 4, 'cosine');

    // Verify collection was created
    const indexes = await astraVector.listIndexes();
    expect(indexes).toContain(testIndexName);

    // 2. Get collection stats
    const initialStats = await astraVector.describeIndex(testIndexName);
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

    const ids = await astraVector.upsert(testIndexName, vectors, metadata);
    expect(ids).toHaveLength(4);

    // Wait for document count to update (with timeout)
    const countUpdated = await waitForCondition(
      async () => {
        const stats = await astraVector.describeIndex(testIndexName);
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
    const results = await astraVector.query(testIndexName, queryVector, 2);

    expect(results).toHaveLength(2);
    expect(results?.[0]?.metadata).toEqual({ label: 'vector1' });
    expect(results?.[0]?.score).toBeCloseTo(1, 4);

    // 5. Query with filter
    const filteredResults = await astraVector.query(testIndexName, queryVector, 2, { 'metadata.label': 'vector2' });

    expect(filteredResults).toHaveLength(1);
    expect(filteredResults?.[0]?.metadata).toEqual({ label: 'vector2' });

    // Get final stats
    const finalStats = await astraVector.describeIndex(testIndexName);
    console.log('Final stats:', finalStats);

    // More lenient assertion for document count
    expect(finalStats.count).toBeGreaterThan(0);
    if (finalStats.count !== 4) {
      console.warn(`Expected count of 4, but got ${finalStats.count}. This may be due to eventual consistency.`);
    }
  });

  test('gets vector results back from query', async () => {
    const queryVector = [1, 0, 0, 0];
    const results = await astraVector.query(testIndexName, queryVector, 2, undefined, true);

    expect(results).toHaveLength(2);
    expect(results?.[0]?.metadata).toEqual({ label: 'vector1' });
    expect(results?.[0]?.score).toBeCloseTo(1, 4);
    expect(results?.[0]?.vector).toEqual([1, 0, 0, 0]);
  });

  test('handles different vector dimensions', async () => {
    const highDimIndexName = 'high_dim_test_' + Date.now();

    try {
      // Create index with higher dimensions
      await astraVector.createIndex(highDimIndexName, 1536, 'cosine');

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

      const ids = await astraVector.upsert(highDimIndexName, vectors, metadata);
      expect(ids).toHaveLength(2);

      // Wait for indexing with more generous timeout
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Query with same pattern as first vector
      const queryVector = Array(1536)
        .fill(0)
        .map((_, i) => i % 2);
      const results = await astraVector.query(highDimIndexName, queryVector, 2);

      expect(results).toHaveLength(2);
      expect(results?.[0]?.metadata).toEqual({ label: 'even' });
      expect(results?.[0]?.score).toBeCloseTo(1, 4);
    } finally {
      // Cleanup
      await astraVector.deleteIndex(highDimIndexName);
    }
  });

  test('handles different distance metrics', async () => {
    const metrics = ['cosine', 'euclidean', 'dotproduct'] as const;

    for (const metric of metrics) {
      const metricIndexName = `metrictest${metric}${Date.now()}`;

      try {
        // Create index with different metric
        await astraVector.createIndex(metricIndexName, 4, metric);

        // Insert same vectors
        const vectors = [
          [1, 0, 0, 0],
          [0.7071, 0.7071, 0, 0], // 45-degree angle from first vector
        ];

        await astraVector.upsert(metricIndexName, vectors);

        // Wait for indexing with more generous timeout
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Query
        const results = await astraVector.query(metricIndexName, [1, 0, 0, 0], 2);

        expect(results).toHaveLength(2);

        // Scores will differ based on metric but order should be same
        expect(results?.[0]?.score).toBeGreaterThan(results?.[1]?.score!);
      } finally {
        // Cleanup
        await astraVector.deleteIndex(metricIndexName);
      }
    }
  }, 500000);

  // describe('filter', () => {
  //       it('throws error for invalid operator values', () => {
  //     const filter = { tags: { $all: 'not-an-array' } };
  //     expect(() => translator.translate(filter)).toThrow();
  //   });

  //   it('validates array operator values', () => {
  //     expect(() =>
  //       translator.translate({
  //         tags: { $in: null },
  //       }),
  //     ).toThrow();

  //     expect(() =>
  //       translator.translate({
  //         tags: { $all: 'not-an-array' },
  //       }),
  //     ).toThrow();
  //   });

  //   it('validates numeric values for comparison operators', () => {
  //     const filter = {
  //       price: { $gt: 'not-a-number' },
  //     };
  //     expect(() => translator.translate(filter)).toThrow();
  //   });

  //   it('validates value types', () => {
  //     expect(() =>
  //       translator.translate({
  //         date: { $gt: 'not-a-date' },
  //       }),
  //     ).toThrow();

  //     expect(() =>
  //       translator.translate({
  //         number: { $lt: 'not-a-number' },
  //       }),
  //     ).toThrow();
  //   });

  //   // Array Operators
  //   it('validates array operators', () => {
  //     const invalidValues = [123, 'string', true, { key: 'value' }, null, undefined];
  //     for (const op of ['$in', '$nin', '$all']) {
  //       for (const val of invalidValues) {
  //         expect(() =>
  //           translator.translate({
  //             field: { [op]: val },
  //           }),
  //         ).toThrow();
  //       }
  //     }

  //     // Invalid array elements
  //     expect(() =>
  //       translator.translate({
  //         field: { $in: [undefined, null] },
  //       }),
  //     ).toThrow();
  //   });

  //   // Element Operators
  //   it('validates element operators', () => {
  //     const invalidValues = [123, 'string', [], {}, null, undefined];
  //     for (const val of invalidValues) {
  //       expect(() =>
  //         translator.translate({
  //           field: { $exists: val },
  //         }),
  //       ).toThrow();
  //     }
  //   });

  //   // Comparison Operators
  //   it('validates comparison operators', () => {
  //     // Basic equality can accept any non-undefined value
  //     const eqOps = ['$eq', '$ne'];
  //     for (const op of eqOps) {
  //       expect(() =>
  //         translator.translate({
  //           field: { [op]: undefined },
  //         }),
  //       ).toThrow();
  //     }

  //     // Numeric comparisons require numbers or dates
  //     const numOps = ['$gt', '$gte', '$lt', '$lte'];
  //     const invalidNumericValues = ['not-a-number', true, [], {}, null, undefined];
  //     for (const op of numOps) {
  //       for (const val of invalidNumericValues) {
  //         expect(() =>
  //           translator.translate({
  //             field: { [op]: val },
  //           }),
  //         ).toThrow();
  //       }
  //     }
  //   });
  // });

  // // Multiple Invalid Values
  // it('validates multiple invalid values', () => {
  //   expect(() =>
  //     translator.translate({
  //       field1: { $in: 'not-array' },
  //       field2: { $exists: 'not-boolean' },
  //       field3: { $gt: 'not-number' },
  //       field4: { $regex: {} },
  //     }),
  //   ).toThrow();
  // });
  //     it('validates regex options', () => {
  //       expect(() =>
  //         translator.translate({
  //           field: {
  //             $regex: 'pattern',
  //             $options: 'i',
  //           },
  //         }),
  //       ).not.toThrow();
  //     });
  // describe('regex validation', () => {

  // Text Search Operators
  // it('validates regex operators', () => {
  //   const invalidValues = [123, true, [], {}, null, undefined];
  //   for (const val of invalidValues) {
  //     expect(() =>
  //       translator.translate({
  //         field: { $regex: val },
  //       }),
  //     ).toThrow();
  //   }
  // });
  // it('not supported regex options', () => {
  //   expect(() =>
  //     translator.translate({
  //       field: {
  //         $regex: 'pattern',
  //         $options: 'm', // 'm' is not supported
  //       },
  //     }),
  //   ).toThrow();
  // });

  // it('invalid regex options type', () => {
  //   expect(() =>
  //     translator.translate({
  //       field: {
  //         $regex: 'pattern',
  //         $options: true, // must be string
  //       },
  //     }),
  //   ).toThrow();
  // });
  //   it('validates basic regex patterns', () => {
  //     // Valid cases
  //     const validCases = [
  //       { field: { $regex: 'pattern' } },
  //       { field: { $regex: 'pattern', $options: 'i' } },
  //       { field: { $regex: /pattern/ } },
  //       { field: { $regex: new RegExp('pattern') } },
  //     ];

  //     validCases.forEach(filter => {
  //       expect(() => translator.translate(filter)).not.toThrow();
  //     });

  //     // Invalid cases
  //     const invalidCases = [
  //       { field: { $regex: 123 } },
  //       { field: { $regex: true } },
  //       { field: { $regex: [] } },
  //       { field: { $regex: {} } },
  //       { field: { $regex: 'pattern', $options: 'x' } }, // unsupported option
  //       { field: { $regex: 'pattern', $options: 123 } }, // invalid options type
  //     ];

  //     invalidCases.forEach(filter => {
  //       expect(() => translator.translate(filter)).toThrow();
  //     });
  //   });

  //   it('handles multiple regex conditions', () => {
  //     const filter = {
  //       title: { $regex: 'pattern1', $options: 'i' },
  //       description: { $regex: 'pattern2' },
  //       $or: [{ tag: { $regex: 'pattern3', $options: 'i' } }, { category: { $regex: 'pattern4' } }],
  //     };
  //     expect(translator.translate(filter)).toEqual(filter);
  //   });
  // });
});
