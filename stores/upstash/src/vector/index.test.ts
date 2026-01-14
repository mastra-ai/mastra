import { createVectorTestSuite } from '@internal/storage-test-utils';
import type { QueryResult } from '@mastra/core/vector';
import dotenv from 'dotenv';

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';

import { UpstashVector } from './';

dotenv.config();

function waitUntilVectorsIndexed(vector: UpstashVector, indexName: string, expectedCount: number) {
  return new Promise((resolve, reject) => {
    const maxAttempts = 30;
    let attempts = 0;
    const interval = setInterval(async () => {
      try {
        const stats = await vector.describeIndex({ indexName });
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
    }, 5000);
  });
}

/**
 * These tests require a real Upstash Vector instance since there is no local Docker alternative.
 * The tests will be skipped in local development where Upstash credentials are not available.
 * In CI/CD environments, these tests will run using the provided Upstash Vector credentials.
 */
describe.skipIf(!process.env.UPSTASH_VECTOR_URL || !process.env.UPSTASH_VECTOR_TOKEN)('UpstashVector', () => {
  let vectorStore: UpstashVector;
  const VECTOR_DIMENSION = 1536;
  const testIndexName = 'default';
  const filterIndexName = 'filter-index';

  beforeAll(() => {
    // Load from environment variables for CI/CD
    const url = process.env.UPSTASH_VECTOR_URL;
    const token = process.env.UPSTASH_VECTOR_TOKEN;

    if (!url || !token) {
      console.log('Skipping Upstash Vector tests - no credentials available');
      return;
    }

    vectorStore = new UpstashVector({ id: 'upstash-test-vector', url, token });
  });

  afterAll(async () => {
    if (!vectorStore) return;

    // Cleanup: delete test index
    try {
      await vectorStore.deleteIndex({ indexName: testIndexName });
    } catch (error) {
      console.warn('Failed to delete test index:', error);
    }
    try {
      await vectorStore.deleteIndex({ indexName: filterIndexName });
    } catch (error) {
      console.warn('Failed to delete filter index:', error);
    }
  });

  describe('Vector Operations', () => {
    // Helper function to create a normalized vector
    const createVector = (primaryDimension: number, value: number = 1.0): number[] => {
      const vector = new Array(VECTOR_DIMENSION).fill(0);
      vector[primaryDimension] = value;
      // Normalize the vector for cosine similarity
      const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      return vector.map(val => val / magnitude);
    };

    describe('Vector update operations', () => {
      const testVectors = [createVector(0, 1.0), createVector(1, 1.0), createVector(2, 1.0)];

      const testIndexName = 'test-index';

      afterEach(async () => {
        await vectorStore.deleteIndex({ indexName: testIndexName });
      });

      it('should update the vector by id', async () => {
        const ids = await vectorStore.upsert({ indexName: testIndexName, vectors: testVectors });
        expect(ids).toHaveLength(3);

        const idToBeUpdated = ids[0];
        const newVector = createVector(0, 4.0);
        const newMetaData = {
          test: 'updates',
        };

        const update = {
          vector: newVector,
          metadata: newMetaData,
        };

        await vectorStore.updateVector({ indexName: testIndexName, id: idToBeUpdated, update });

        await waitUntilVectorsIndexed(vectorStore, testIndexName, 3);

        const results: QueryResult[] = await vectorStore.query({
          indexName: testIndexName,
          queryVector: newVector,
          topK: 2,
          includeVector: true,
        });
        expect(results[0]?.id).toBe(idToBeUpdated);
        expect(results[0]?.vector).toEqual(newVector);
        expect(results[0]?.metadata).toEqual(newMetaData);
      }, 500000);

      it('should only update the metadata by id', async () => {
        const ids = await vectorStore.upsert({ indexName: testIndexName, vectors: testVectors });
        expect(ids).toHaveLength(3);

        const newMetaData = {
          test: 'updates',
        };

        const update = {
          metadata: newMetaData,
        };

        await expect(vectorStore.updateVector({ indexName: testIndexName, id: 'id', update })).rejects.toThrow(
          'Both vector and metadata must be provided for an update',
        );
      });

      it('should only update vector embeddings by id', async () => {
        const ids = await vectorStore.upsert({ indexName: testIndexName, vectors: testVectors });
        expect(ids).toHaveLength(3);

        const idToBeUpdated = ids[0];
        const newVector = createVector(0, 4.0);

        const update = {
          vector: newVector,
        };

        await vectorStore.updateVector({ indexName: testIndexName, id: idToBeUpdated, update });

        await waitUntilVectorsIndexed(vectorStore, testIndexName, 3);

        const results: QueryResult[] = await vectorStore.query({
          indexName: testIndexName,
          queryVector: newVector,
          topK: 2,
          includeVector: true,
        });
        expect(results[0]?.id).toBe(idToBeUpdated);
        expect(results[0]?.vector).toEqual(newVector);
      }, 500000);

      it('should throw exception when no updates are given', async () => {
        await expect(vectorStore.updateVector({ indexName: testIndexName, id: 'id', update: {} })).rejects.toThrow(
          'No update data provided',
        );
      });
    });

    describe('Vector delete operations', () => {
      const testVectors = [createVector(0, 1.0), createVector(1, 1.0), createVector(2, 1.0)];

      afterEach(async () => {
        await vectorStore.deleteIndex({ indexName: testIndexName });
      });

      it('should delete the vector by id', async () => {
        const ids = await vectorStore.upsert({ indexName: testIndexName, vectors: testVectors });
        expect(ids).toHaveLength(3);
        const idToBeDeleted = ids[0];

        await vectorStore.deleteVector({ indexName: testIndexName, id: idToBeDeleted });

        const results: QueryResult[] = await vectorStore.query({
          indexName: testIndexName,
          queryVector: createVector(0, 1.0),
          topK: 2,
        });

        expect(results).toHaveLength(2);
        expect(results.map(res => res.id)).not.toContain(idToBeDeleted);
      });
    });
  });

  describe('Error Handling', () => {
    const testIndexName = 'test_index_error';
    beforeAll(async () => {
      await vectorStore.createIndex({ indexName: testIndexName, dimension: 3 });
    });

    afterAll(async () => {
      await vectorStore.deleteIndex({ indexName: testIndexName });
    });

    it('should handle invalid dimension vectors', async () => {
      await expect(
        vectorStore.upsert({ indexName: testIndexName, vectors: [[1.0, 0.0]] }), // Wrong dimensions
      ).rejects.toThrow();
    });

    it('should handle querying with wrong dimensions', async () => {
      await expect(
        vectorStore.query({ indexName: testIndexName, queryVector: [1.0, 0.0] }), // Wrong dimensions
      ).rejects.toThrow();
    });
  });

  // Metadata filtering and advanced operations tests
  if (process.env.UPSTASH_VECTOR_URL && process.env.UPSTASH_VECTOR_TOKEN) {
    describe('Upstash Metadata Filtering', () => {
      const url = process.env.UPSTASH_VECTOR_URL!;
      const token = process.env.UPSTASH_VECTOR_TOKEN!;

      const upstashVector = new UpstashVector({
        url,
        token,
        id: 'upstash-metadata-test',
      });

      createVectorTestSuite({
        vector: upstashVector,
        createIndex: async (indexName: string) => {
          // Upstash doesn't require explicit index creation (uses namespaces)
          // But we need to ensure it exists by creating it
          await upstashVector.createIndex({ indexName, dimension: 1536 });
        },
        deleteIndex: async (indexName: string) => {
          await upstashVector.deleteIndex({ indexName });
        },
        waitForIndexing: async () => {
          // Upstash has eventual consistency, wait for vectors to be indexed
          await new Promise(resolve => setTimeout(resolve, 5000));
        },
      });
    });
  }
});
