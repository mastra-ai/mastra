import dotenv from 'dotenv';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

import { PineconeVector } from './';

dotenv.config();

const PINECONE_API_KEY = process.env.PINECONE_API_KEY!;

// if (!PINECONE_API_KEY) {
//   throw new Error('Please set PINECONE_API_KEY and PINECONE_ENVIRONMENT in .env file');
// }
// TODO: skip until we the secrets on Github

function waitUntilReady(pineconeVector: PineconeVector, indexName: string) {
  return new Promise(resolve => {
    const interval = setInterval(async () => {
      try {
        const stats = await pineconeVector.describeIndex(indexName);
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

function waitUntilVectorsIndexed(pineconeVector: PineconeVector, indexName: string, expectedCount: number) {
  return new Promise((resolve, reject) => {
    const maxAttempts = 30; // 30 seconds max
    let attempts = 0;
    const interval = setInterval(async () => {
      try {
        const stats = await pineconeVector.describeIndex(indexName);
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
describe('PineconeVector Integration Tests', () => {
  let pineconeVector: PineconeVector;
  const testIndexName = 'test-index-' + Date.now(); // Unique index name for each test run
  const dimension = 3;

  beforeAll(async () => {
    pineconeVector = new PineconeVector(PINECONE_API_KEY);
    // Create test index
    await pineconeVector.createIndex(testIndexName, dimension);
    await waitUntilReady(pineconeVector, testIndexName);
  }, 500000);

  afterAll(async () => {
    // Cleanup: delete test index
    await pineconeVector.deleteIndex(testIndexName);
  }, 500000);

  describe('Index Operations', () => {
    it('should list indexes including our test index', async () => {
      const indexes = await pineconeVector.listIndexes();
      expect(indexes).toContain(testIndexName);
    }, 500000);

    it('should describe index with correct properties', async () => {
      const stats = await pineconeVector.describeIndex(testIndexName);
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
      vectorIds = await pineconeVector.upsert(testIndexName, testVectors, testMetadata);
      expect(vectorIds).toHaveLength(3);
      // Wait for vectors to be indexed
      await waitUntilVectorsIndexed(pineconeVector, testIndexName, 3);
    }, 500000);

    it.skip('should query vectors and return nearest neighbors', async () => {
      const queryVector = [1.0, 0.1, 0.1];
      const results = await pineconeVector.query(testIndexName, queryVector, 3);

      expect(results).toHaveLength(3);
      expect(results[0]!.score).toBeGreaterThan(0);
      expect(results[0]!.metadata).toBeDefined();
    }, 500000);

    it('should query vectors with metadata filter', async () => {
      const queryVector = [0.0, 1.0, 0.0];
      const filter = { label: 'y-axis' };

      const results = await pineconeVector.query(testIndexName, queryVector, 1, filter);

      expect(results).toHaveLength(1);
      expect(results?.[0]?.metadata?.label).toBe('y-axis');
    }, 500000);

    it('should query vectors and return vectors in results', async () => {
      const queryVector = [0.0, 1.0, 0.0];
      const results = await pineconeVector.query(testIndexName, queryVector, 1, undefined, true);

      expect(results).toHaveLength(1);
      expect(results?.[0]?.vector).toBeDefined();
      expect(results?.[0]?.vector).toHaveLength(dimension);
    }, 500000);
  });

  describe('Error Handling', () => {
    it('should handle non-existent index query gracefully', async () => {
      const nonExistentIndex = 'non-existent-index';
      await expect(pineconeVector.query(nonExistentIndex, [1, 0, 0])).rejects.toThrow();
    }, 500000);

    it('should handle incorrect dimension vectors', async () => {
      const wrongDimVector = [[1, 0]]; // 2D vector for 3D index
      await expect(pineconeVector.upsert(testIndexName, wrongDimVector)).rejects.toThrow();
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
      const ids = await pineconeVector.upsert(testIndexName, vectors, metadata);
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
        .map(() => pineconeVector.query(testIndexName, queryVector));

      const results = await Promise.all(promises);
      const duration = Date.now() - start;

      expect(results).toHaveLength(numQueries);
      console.log(`${numQueries} concurrent queries took ${duration}ms`);
    }, 500000);
  });

  describe('Filter Validation in Queries', () => {
    it('rejects queries with null values', async () => {
      await expect(
        pineconeVector.query(testIndexName, [1, 0, 0], 10, {
          field: null,
        }),
      ).rejects.toThrow('the $eq operator must be followed by a string, boolean or a number, got null instead');

      await expect(
        pineconeVector.query(testIndexName, [1, 0, 0], 10, {
          other: { $eq: null },
        }),
      ).rejects.toThrow('the $eq operator must be followed by a string, boolean or a number, got null instead');
    });

    it('rejects invalid array operator values', async () => {
      // Test non-undefined values
      const invalidValues = [123, 'string', true, { key: 'value' }, null];
      for (const op of ['$in', '$nin']) {
        // Removed $all as it's not supported
        for (const val of invalidValues) {
          await expect(
            pineconeVector.query(testIndexName, [1, 0, 0], 10, {
              field: { [op]: val },
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
            pineconeVector.query(testIndexName, [1, 0, 0], 10, {
              field: { [op]: val },
            }),
          ).rejects.toThrow(`the ${op} operator must be followed by a number`);
        }
      }
    });

    it('rejects multiple invalid values', async () => {
      await expect(
        pineconeVector.query(testIndexName, [1, 0, 0], 10, {
          field1: { $in: 'not-array' },
          field2: { $gt: 'not-number' },
        }),
      ).rejects.toThrow('the $in operator must be followed by a list of strings or a list of numbers');
    });

    it('rejects invalid array values', async () => {
      await expect(
        pineconeVector.query(testIndexName, [1, 0, 0], 10, {
          field: { $in: [null] },
        }),
      ).rejects.toThrow('the $in operator must be followed by a list of strings or a list of numbers');

      await expect(
        pineconeVector.query(testIndexName, [1, 0, 0], 10, {
          field: { $in: [undefined] },
        }),
      ).rejects.toThrow('the $in operator must be followed by a list of strings or a list of numbers');

      await expect(
        pineconeVector.query(testIndexName, [1, 0, 0], 10, {
          field: { $all: 'not-an-array' },
        }),
      ).rejects.toThrow('A non-empty array is required for the $all operator');
    });

    it('handles empty object filters', async () => {
      // Test empty object at top level
      await expect(pineconeVector.query(testIndexName, [1, 0, 0], 10, { field: { $eq: {} } })).rejects.toThrow(
        'the $eq operator must be followed by a string, boolean or a number, got {} instead',
      );
    });

    it('handles empty/undefined filters by returning all results', async () => {
      // Empty objects and undefined are ignored by Pinecone
      // and will return all results without filtering
      const noFilterCases = [{ field: {} }, { field: undefined }, { field: { $in: undefined } }];

      for (const filter of noFilterCases) {
        const results = await pineconeVector.query(testIndexName, [1, 0, 0], 10, filter);
        expect(results.length).toBeGreaterThan(0);
      }
    });
    it('handles empty object filters', async () => {
      // Test empty object at top level
      await expect(pineconeVector.query(testIndexName, [1, 0, 0], 10, {})).rejects.toThrow(
        'You must enter a `filter` object with at least one key-value pair.',
      );
    });
  });
});
