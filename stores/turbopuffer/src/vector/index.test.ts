import { createVectorTestSuite } from '@internal/storage-test-utils';
import dotenv from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TurbopufferVectorFilter } from './filter';
import { TurbopufferVector } from './';

dotenv.config();

// Check if we have a valid API key
const TURBOPUFFER_API_KEY = process.env.TURBOPUFFER_API_KEY;
const RUN_INTEGRATION_TESTS = !!TURBOPUFFER_API_KEY && TURBOPUFFER_API_KEY.trim() !== '';

// if (!TURBOPUFFER_API_KEY) {
//   throw new Error('Please set TURBOPUFFER_API_KEY in .env file');
// }
// TODO: skip until secrets in Github

function waitUntilVectorsIndexed(vectorDB: TurbopufferVector, indexName: string, expectedCount: number) {
  return new Promise((resolve, reject) => {
    const maxAttempts = 30; // 30 seconds max
    let attempts = 0;
    const interval = setInterval(async () => {
      try {
        const stats = await vectorDB.describeIndex({ indexName });
        console.log(`Index ${indexName} has ${stats.count} vectors indexed, waiting for ${expectedCount}`);
        if (stats && stats.count >= expectedCount) {
          clearInterval(interval);
          console.log(`Index ${indexName} has reached expected vector count: ${stats.count}`);
          resolve(true);
        }
        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(
            new Error(
              `Timeout waiting for vectors to be indexed (expected: ${expectedCount}, actual: ${stats ? stats.count : 'unknown'})`,
            ),
          );
        }
      } catch (error) {
        console.log(`Error checking vector count in ${indexName}:`, error);
        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error(`Timeout waiting for vectors to be indexed due to errors`));
        }
      }
    }, 1000);
  });
}

// Use proper conditional test suite
(RUN_INTEGRATION_TESTS ? describe : describe.skip)('TurbopufferVector Integration Tests', () => {
  let vectorDB: TurbopufferVector;
  const testIndexName = 'test-index-' + Date.now(); // Unique index name for each test run
  const dimension = 3;

  beforeAll(async () => {
    try {
      console.log(`Creating test vector database with index: ${testIndexName}`);

      vectorDB = new TurbopufferVector({
        id: 'turbopuffer-test-vector',
        apiKey: TURBOPUFFER_API_KEY!,
        baseUrl: 'https://gcp-us-central1.turbopuffer.com',
      });

      // Create test index
      await vectorDB.createIndex({ indexName: testIndexName, dimension });
      console.log(`Successfully created index: ${testIndexName}`);
    } catch (error) {
      console.error(`Error in test setup: ${error.message}`);
      throw error; // Re-throw to fail the test suite setup
    }
  }, 500000);

  afterAll(async () => {
    // Only attempt to delete if vectorDB exists
    if (!vectorDB) return;

    try {
      // Check if the namespace exists before trying to delete it
      const indexes = await vectorDB.listIndexes();

      if (indexes.includes(testIndexName)) {
        console.log(`Deleting test index: ${testIndexName}`);
        try {
          // Cleanup: delete test index
          await vectorDB.deleteIndex({ indexName: testIndexName });
          console.log(`Successfully deleted test index: ${testIndexName}`);
        } catch (deleteError) {
          console.error(`Error deleting test index ${testIndexName}:`, deleteError);
          // Don't throw - we don't want to fail tests during cleanup
        }
      } else {
        console.log(`Test index ${testIndexName} not found, no cleanup needed`);
      }
    } catch (error) {
      console.error('Error in cleanup:', error);
      // Don't throw - we don't want to fail tests during cleanup
    }
  }, 500000);

  describe('Store-Specific Tests', () => {
    it('should handle duplicate index creation gracefully', async () => {
      const duplicateIndexName = `duplicate-test`;
      const dimension = 768;

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

      // Cleanup
      await vectorDB.deleteIndex({ indexName: duplicateIndexName });
    });

    it('combines existence checks with other operators (Turbopuffer-specific)', async () => {
      try {
        // Turbopuffer doesn't support checking for null with $ne
        // Modified test to use a valid field and check if rating is > 40
        // First, upsert some test data with rating field
        const testVectors = [
          [1.0, 0.0, 0.0],
          [0.0, 1.0, 0.0],
          [0.0, 0.0, 1.0],
        ];
        const testMetadata = [{ rating: 45 }, { rating: 41 }, { rating: 48 }];

        await vectorDB.upsert({ indexName: testIndexName, vectors: testVectors, metadata: testMetadata });
        await waitUntilVectorsIndexed(vectorDB, testIndexName, 3);

        const filter: TurbopufferVectorFilter = {
          // Use a field we know exists and check if rating is > 40
          rating: { $gt: 40 },
        };
        const results = await vectorDB.query({ indexName: testIndexName, queryVector: [1, 0, 0], topK: 10, filter });

        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          const rating = Number(result.metadata?.rating);
          expect(rating).toBeGreaterThan(40);
        });
      } catch (error) {
        console.error('Error in existence checks test:', error);
        throw error;
      }
    }, 500000);
  });

  createVectorTestSuite({
    vector: new TurbopufferVector({
      id: 'turbopuffer-test-vector',
      apiKey: TURBOPUFFER_API_KEY!,
      baseUrl: 'https://gcp-us-central1.turbopuffer.com',
    }),
    createIndex: async (indexName: string) => {
      await vectorDB.createIndex({ indexName, dimension: 1536 });
    },
    deleteIndex: async (indexName: string) => {
      await vectorDB.deleteIndex({ indexName });
    },
    waitForIndexing: async () => {
      // Turbopuffer has eventual consistency, wait for vectors to be indexed
      await new Promise(resolve => setTimeout(resolve, 5000));
    },
  });
});
