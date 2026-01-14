import { createVectorTestSuite } from '@internal/storage-test-utils';
import dotenv from 'dotenv';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, afterEach } from 'vitest';

import { PineconeVector } from './';

dotenv.config();

const PINECONE_API_KEY = process.env.PINECONE_API_KEY!;

// if (!PINECONE_API_KEY) {
//   throw new Error('Please set PINECONE_API_KEY and PINECONE_ENVIRONMENT in .env file');
// }
// TODO: skip until we the secrets on Github

vi.setConfig({ testTimeout: 80_000, hookTimeout: 80_000 });

// Helper function to create sparse vectors for testing
function createSparseVector(text: string) {
  const words = text.toLowerCase().split(/\W+/).filter(Boolean);
  const uniqueWords = Array.from(new Set(words));
  const indices: number[] = [];
  const values: number[] = [];

  // Create a simple term frequency vector
  uniqueWords.forEach((word, i) => {
    const frequency = words.filter(w => w === word).length;
    indices.push(i);
    values.push(frequency);
  });

  return { indices, values };
}

function waitUntilReady(vectorDB: PineconeVector, indexName: string) {
  return new Promise(resolve => {
    const interval = setInterval(async () => {
      try {
        const stats = await vectorDB.describeIndex({ indexName });
        if (!!stats) {
          clearInterval(interval);
          resolve(true);
        }
      } catch (error) {
        console.log(error);
      }
    }, 5000);
  });
}

function waitUntilIndexDeleted(vectorDB: PineconeVector, indexName: string) {
  return new Promise((resolve, reject) => {
    const maxAttempts = 60;
    let attempts = 0;

    const interval = setInterval(async () => {
      try {
        const indexes = await vectorDB.listIndexes();
        if (!indexes.includes(indexName)) {
          clearInterval(interval);
          resolve(true);
        }
        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error('Timeout waiting for index to be deleted'));
        }
      } catch (error) {
        console.log(error);
      }
    }, 5000);
  });
}

function waitUntilVectorsIndexed(
  vectorDB: PineconeVector,
  indexName: string,
  expectedCount: number,
  exactCount = false,
) {
  return new Promise((resolve, reject) => {
    const maxAttempts = 60;
    let attempts = 0;
    let lastCount = 0;
    let stableCount = 0;

    const interval = setInterval(async () => {
      try {
        const stats = await vectorDB.describeIndex({ indexName });
        const check = exactCount ? stats?.count === expectedCount : stats?.count >= expectedCount;
        if (stats && check) {
          if (stats.count === lastCount) {
            stableCount++;
            if (stableCount >= 2) {
              clearInterval(interval);
              resolve(true);
            }
          } else {
            stableCount = 1;
          }
          lastCount = stats.count;
        }
        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error('Timeout waiting for vectors to be indexed'));
        }
      } catch (error) {
        console.log(error);
      }
    }, 10000);
  });
}
// TODO: our pinecone account is over the limit, tests don't work in CI
describe.skip('PineconeVector Integration Tests', () => {
  let vectorDB: PineconeVector;
  const testIndexName = 'test-index'; // Unique index name for each test run
  const indexNameUpdate = 'test-index-update';
  const indexNameDelete = 'test-index-delete';
  const indexNameNamespace = 'test-index-namespace';
  const indexNameHybrid = 'test-index-hybrid';
  const dimension = 3;

  beforeAll(async () => {
    vectorDB = new PineconeVector({
      id: 'pinecone-test-vector',
      apiKey: PINECONE_API_KEY,
    });
    // Delete test index
    try {
      await vectorDB.deleteIndex({ indexName: testIndexName });
      await waitUntilIndexDeleted(vectorDB, testIndexName);
    } catch {
      // Ignore errors if index doesn't exist
    }
    try {
      await vectorDB.deleteIndex({ indexName: indexNameUpdate });
      await waitUntilIndexDeleted(vectorDB, indexNameUpdate);
    } catch {
      // Ignore errors if index doesn't exist
    }
    try {
      await vectorDB.deleteIndex({ indexName: indexNameDelete });
      await waitUntilIndexDeleted(vectorDB, indexNameDelete);
    } catch {
      // Ignore errors if index doesn't exist
    }
    try {
      await vectorDB.deleteIndex({ indexName: indexNameNamespace });
      await waitUntilIndexDeleted(vectorDB, indexNameNamespace);
    } catch {
      // Ignore errors if index doesn't exist
    }
    try {
      await vectorDB.deleteIndex({ indexName: indexNameHybrid });
      await waitUntilIndexDeleted(vectorDB, indexNameHybrid);
    } catch {
      // Ignore errors if index doesn't exist
    }
    // Create test index
    await vectorDB.createIndex({ indexName: testIndexName, dimension });
    await waitUntilReady(vectorDB, testIndexName);
  }, 500000);

  afterAll(async () => {
    // Cleanup: delete test index
    try {
      await vectorDB.deleteIndex({ indexName: testIndexName });
    } catch {
      // Ignore errors if index doesn't exist
    }
    try {
      await vectorDB.deleteIndex({ indexName: indexNameUpdate });
    } catch {
      // Ignore errors if index doesn't exist
    }
    try {
      await vectorDB.deleteIndex({ indexName: indexNameDelete });
    } catch {
      // Ignore errors if index doesn't exist
    }
    try {
      await vectorDB.deleteIndex({ indexName: indexNameNamespace });
    } catch {
      // Ignore errors if index doesn't exist
    }
    try {
      await vectorDB.deleteIndex({ indexName: indexNameHybrid });
    } catch {
      // Ignore errors if index doesn't exist
    }
  }, 500000);

  describe('Namespace Operations', () => {
    const namespace1 = 'test-namespace-1';
    const namespace2 = 'test-namespace-2';
    const testVector = [1.0, 0.0, 0.0];
    const testMetadata = { label: 'test' };

    beforeEach(async () => {
      await vectorDB.createIndex({ indexName: indexNameNamespace, dimension, metric: 'cosine' });
      await waitUntilReady(vectorDB, indexNameNamespace);
    });

    afterEach(async () => {
      try {
        await vectorDB.deleteIndex({ indexName: indexNameNamespace });
        await waitUntilIndexDeleted(vectorDB, indexNameNamespace);
      } catch {
        // Ignore errors if index doesn't exist
      }
    });

    it('should isolate vectors in different namespaces', async () => {
      // Insert same vector in two namespaces
      const [id1] = await vectorDB.upsert({
        indexName: indexNameNamespace,
        vectors: [testVector],
        metadata: [testMetadata],
        namespace: namespace1,
      });
      await waitUntilVectorsIndexed(vectorDB, indexNameNamespace, 1);

      const [id2] = await vectorDB.upsert({
        indexName: indexNameNamespace,
        vectors: [testVector],
        metadata: [{ ...testMetadata, label: 'test2' }],
        namespace: namespace2,
      });
      await waitUntilVectorsIndexed(vectorDB, indexNameNamespace, 2);

      // Query namespace1
      const results1 = await vectorDB.query({
        indexName: indexNameNamespace,
        queryVector: testVector,
        namespace: namespace1,
      });

      // Query namespace2
      const results2 = await vectorDB.query({
        indexName: indexNameNamespace,
        queryVector: testVector,
        namespace: namespace2,
      });

      // Verify isolation
      expect(results1).toHaveLength(1);
      expect(results2).toHaveLength(1);
      expect(results1[0]?.id).toBe(id1);
      expect(results1[0]?.metadata?.label).toBe('test');
      expect(results2[0]?.id).toBe(id2);
      expect(results2[0]?.metadata?.label).toBe('test2');
    }, 500000);

    it('should update vectors within specific namespace', async () => {
      const [id] = await vectorDB.upsert({
        indexName: indexNameNamespace,
        vectors: [testVector],
        metadata: [testMetadata],
        namespace: namespace1,
      });
      await waitUntilVectorsIndexed(vectorDB, indexNameNamespace, 1);

      // Update in namespace1
      await vectorDB.updateVector({
        indexName: indexNameNamespace,
        id,
        update: { metadata: { label: 'updated' } },
        namespace: namespace1,
      });

      await waitUntilVectorsIndexed(vectorDB, indexNameNamespace, 1);

      // Query to verify update
      const results = await vectorDB.query({
        indexName: indexNameNamespace,
        queryVector: testVector,
        namespace: namespace1,
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.metadata?.label).toBe('updated');
    }, 500000);

    it('should delete vectors from specific namespace', async () => {
      const [id] = await vectorDB.upsert({
        indexName: indexNameNamespace,
        vectors: [testVector],
        metadata: [testMetadata],
        namespace: namespace1,
      });
      await waitUntilVectorsIndexed(vectorDB, indexNameNamespace, 1);

      // Delete from namespace1
      await vectorDB.deleteVector({ indexName: indexNameNamespace, id, namespace: namespace1 });

      await waitUntilVectorsIndexed(vectorDB, indexNameNamespace, 0, true);

      // Query to verify deletion
      const results = await vectorDB.query({
        indexName: indexNameNamespace,
        queryVector: testVector,
        namespace: namespace1,
      });

      expect(results.length).toBe(0);
    }, 500000);

    it('should show namespace stats in describeIndex', async () => {
      await vectorDB.upsert({
        indexName: indexNameNamespace,
        vectors: [testVector],
        metadata: [testMetadata],
        namespace: namespace1,
      });
      await waitUntilVectorsIndexed(vectorDB, indexNameNamespace, 1);
      await vectorDB.upsert({
        indexName: indexNameNamespace,
        vectors: [testVector],
        metadata: [{ ...testMetadata, label: 'test2' }],
        namespace: namespace2,
      });
      await waitUntilVectorsIndexed(vectorDB, indexNameNamespace, 2);

      const stats = await vectorDB.describeIndex({ indexName: indexNameNamespace });
      expect(stats.namespaces).toBeDefined();
      expect(stats.namespaces?.[namespace1]).toBeDefined();
      expect(stats.namespaces?.[namespace2]).toBeDefined();
      expect(stats.namespaces?.[namespace1].recordCount).toBe(1);
      expect(stats.namespaces?.[namespace2].recordCount).toBe(1);
    }, 500000);
  });

  describe('Error Handling', () => {
    const testIndexName = 'test-index-error';
    beforeAll(async () => {
      await vectorDB.createIndex({ indexName: testIndexName, dimension: 3 });
    });

    afterAll(async () => {
      await vectorDB.deleteIndex({ indexName: testIndexName });
    });

    it('should handle duplicate index creation gracefully', async () => {
      const duplicateIndexName = `duplicate-test`;
      const dimension = 768;
      const infoSpy = vi.spyOn(vectorDB['logger'], 'info');
      const warnSpy = vi.spyOn(vectorDB['logger'], 'warn');

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

        expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('already exists with'));

        // Try to create with same dimensions and different metric - should not throw
        await expect(
          vectorDB.createIndex({
            indexName: duplicateIndexName,
            dimension,
            metric: 'euclidean',
          }),
        ).resolves.not.toThrow();

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Attempted to create index with metric'));

        // Try to create with different dimensions - should throw
        await expect(
          vectorDB.createIndex({
            indexName: duplicateIndexName,
            dimension: dimension + 1,
            metric: 'cosine',
          }),
        ).rejects.toThrow(
          `Index "${duplicateIndexName}" already exists with ${dimension} dimensions, but ${dimension + 1} dimensions were requested`,
        );
      } finally {
        infoSpy.mockRestore();
        warnSpy.mockRestore();
        // Cleanup
        await vectorDB.deleteIndex({ indexName: duplicateIndexName });
      }
    });
  });

  describe('Hybrid Search Operations', () => {
    const testVectors = [
      [0.9, 0.1, 0.0], // cats (very distinct)
      [0.1, 0.9, 0.0], // dogs (very distinct)
      [0.0, 0.0, 0.9], // birds (completely different)
    ];

    const testMetadata = [
      { text: 'cats purr and meow', animal: 'cat' },
      { text: 'dogs bark and fetch', animal: 'dog' },
      { text: 'birds fly and nest', animal: 'bird' },
    ];

    // Create sparse vectors with fixed vocabulary indices
    const testSparseVectors = [
      { indices: [0], values: [1.0] }, // cat terms only
      { indices: [1], values: [1.0] }, // dog terms only
      { indices: [2], values: [1.0] }, // bird terms only
    ];

    beforeEach(async () => {
      await vectorDB.createIndex({ indexName: indexNameHybrid, dimension: 3, metric: 'dotproduct' });
      await waitUntilReady(vectorDB, indexNameHybrid);

      // Upsert with both dense and sparse vectors
      await vectorDB.upsert({
        indexName: indexNameHybrid,
        vectors: testVectors,
        sparseVectors: testSparseVectors,
        metadata: testMetadata,
      });
      await waitUntilVectorsIndexed(vectorDB, indexNameHybrid, 3);
    });

    afterEach(async () => {
      try {
        await vectorDB.deleteIndex({ indexName: indexNameHybrid });
        await waitUntilIndexDeleted(vectorDB, indexNameHybrid);
      } catch {
        // Ignore errors if index doesn't exist
      }
    });

    it('should combine dense and sparse signals in hybrid search', async () => {
      // Query vector strongly favors cats
      const queryVector = [1.0, 0.0, 0.0];
      // But sparse vector strongly favors dogs
      const sparseVector = {
        indices: [1], // Index 1 corresponds to dog-related terms
        values: [1.0], // Maximum weight for dog terms
      };

      const results = await vectorDB.query({
        indexName: indexNameHybrid,
        queryVector,
        sparseVector,
        topK: 2,
      });

      expect(results).toHaveLength(2);

      // Get results with just vector similarity
      const vectorResults = await vectorDB.query({
        indexName: indexNameHybrid,
        queryVector,
        topK: 2,
      });

      // Results should be different when using hybrid search vs just vector
      expect(results[0].id).not.toBe(vectorResults[0].id);

      // First result should be dog due to sparse vector influence
      expect(results[0].metadata?.animal).toBe('dog');
    });

    it('should support sparse vectors as optional parameters', async () => {
      // Should work with just dense vectors in upsert
      await vectorDB.upsert({
        indexName: indexNameHybrid,
        vectors: [[0.1, 0.2, 0.3]],
        metadata: [{ test: 'dense only' }],
      });

      // Should work with just dense vector in query
      const denseOnlyResults = await vectorDB.query({
        indexName: indexNameHybrid,
        queryVector: [0.1, 0.2, 0.3],
        topK: 1,
      });
      expect(denseOnlyResults).toHaveLength(1);

      // Should work with both dense and sparse in query
      const hybridResults = await vectorDB.query({
        indexName: indexNameHybrid,
        queryVector: [0.1, 0.2, 0.3],
        sparseVector: createSparseVector('test query'),
        topK: 1,
      });
      expect(hybridResults).toHaveLength(1);
    });
  });
});

// Metadata filtering and advanced operations tests
describe.skip('Pinecone Metadata Filtering', () => {
  const pineconeVector = new PineconeVector({
    apiKey: PINECONE_API_KEY,
    id: 'pinecone-metadata-test',
  });

  createVectorTestSuite({
    vector: pineconeVector,
    createIndex: async (indexName: string) => {
      await pineconeVector.createIndex({ indexName, dimension: 4 });
      // Wait for index to be ready
      await waitUntilReady(pineconeVector, indexName);
      // Return the normalized name so tests use it
      return indexName;
    },
    deleteIndex: async (indexName: string) => {
      // Use the same normalization
      const normalizedName = indexName
        .toLowerCase()
        .replace(/_/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      await pineconeVector.deleteIndex({ indexName: normalizedName });
      // Wait for index to be deleted
      await waitUntilIndexDeleted(pineconeVector, normalizedName);
    },
    waitForIndexing: async () => {
      // Pinecone has eventual consistency, need to wait for vectors to be indexed
      await new Promise(resolve => setTimeout(resolve, 5000));
    },
  });
});
