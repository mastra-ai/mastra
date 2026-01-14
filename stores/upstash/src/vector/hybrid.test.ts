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
 * Helper function to create sparse vectors for hybrid index compatibility
 */
function _createSparseVector() {
  return {
    indices: [0, 1, 2, 10, 50],
    values: [0.1, 0.2, 0.3, 0.4, 0.5],
  };
}

/**
 * These tests require a real Upstash Vector instance since there is no local Docker alternative.
 * The tests will be skipped in local development where Upstash credentials are not available.
 * In CI/CD environments, these tests will run using the provided Upstash Vector credentials.
 */
describe.skipIf(!process.env.UPSTASH_VECTOR_URL || !process.env.UPSTASH_VECTOR_TOKEN)('UpstashVector', () => {
  let vectorStore: UpstashVector;
  const VECTOR_DIMENSION = 1024;
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

    vectorStore = new UpstashVector({ url, token });
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

    let vectorIds: string[];

    it('should upsert vectors and query them', async () => {
      // Create and log test vectors
      const testVectors = [createVector(0, 1.0), createVector(1, 1.0), createVector(2, 1.0)];

      const testMetadata = [{ label: 'first-dimension' }, { label: 'second-dimension' }, { label: 'third-dimension' }];

      // Upsert vectors
      vectorIds = await vectorStore.upsert({
        indexName: testIndexName,
        vectors: testVectors,
        metadata: testMetadata,
        sparseVectors: testVectors.map(() => _createSparseVector()),
      });

      expect(vectorIds).toHaveLength(3);
      await waitUntilVectorsIndexed(vectorStore, testIndexName, 3);

      const results = await vectorStore.query({ indexName: testIndexName, queryVector: createVector(0, 0.9), topK: 3 });

      expect(results).toHaveLength(3);
      if (results.length > 0) {
        expect(results?.[0]?.metadata).toEqual({ label: 'first-dimension' });
      }
    }, 5000000);

    it('should query vectors and return vector in results', async () => {
      const results = await vectorStore.query({
        indexName: testIndexName,
        queryVector: createVector(0, 0.9),
        topK: 3,
        includeVector: true,
      });
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.vector).toBeDefined();
        expect(result.vector).toHaveLength(VECTOR_DIMENSION);
      });
    });

    describe('Vector update operations', () => {
      const testVectors = [createVector(0, 1.0), createVector(1, 1.0), createVector(2, 1.0)];

      const testIndexName = 'test-index';

      afterEach(async () => {
        await vectorStore.deleteIndex({ indexName: testIndexName });
      });

      it('should update the vector by id', async () => {
        const ids = await vectorStore.upsert({
          indexName: testIndexName,
          vectors: testVectors,
          sparseVectors: testVectors.map(() => _createSparseVector()),
        });
        expect(ids).toHaveLength(3);

        const idToBeUpdated = ids[0];
        const newVector = createVector(0, 4.0);
        const newMetaData = {
          test: 'updates',
        };

        const update = {
          vector: newVector,
          sparseVector: _createSparseVector(),
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
        const ids = await vectorStore.upsert({
          indexName: testIndexName,
          vectors: testVectors,
          sparseVectors: testVectors.map(() => _createSparseVector()),
        });
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
        const ids = await vectorStore.upsert({
          indexName: testIndexName,
          vectors: testVectors,
          sparseVectors: testVectors.map(() => _createSparseVector()),
        });
        expect(ids).toHaveLength(3);

        const idToBeUpdated = ids[0];
        const newVector = createVector(0, 4.0);

        const update = {
          vector: newVector,
          sparseVector: _createSparseVector(),
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
        const ids = await vectorStore.upsert({
          indexName: testIndexName,
          vectors: testVectors,
          sparseVectors: testVectors.map(() => _createSparseVector()),
        });
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
  describe('Index Operations', () => {
    const createVector = (primaryDimension: number, value: number = 1.0): number[] => {
      const vector = new Array(VECTOR_DIMENSION).fill(0);
      vector[primaryDimension] = value;
      // Normalize the vector for cosine similarity
      const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      return vector.map(val => val / magnitude);
    };
    it('should create and list an index', async () => {
      // since, we do not have to create index explictly in case of upstash. Upserts are enough
      // for testing the listIndexes() function
      // await vectorStore.createIndex({ indexName: testIndexName, dimension: 3, metric: 'cosine' });
      const ids = await vectorStore.upsert({
        indexName: testIndexName,
        vectors: [createVector(0, 1.0)],
        sparseVectors: [_createSparseVector()],
      });
      expect(ids).toHaveLength(1);
      const indexes = await vectorStore.listIndexes();
      expect(indexes).toEqual([testIndexName]);
    });

    it('should describe an index correctly', async () => {
      const stats = await vectorStore.describeIndex({ indexName: 'mastra_default' });
      expect(stats).toEqual({
        dimension: 1024,
        metric: 'cosine',
        count: 0,
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

  describe('Hybrid Vector Operations (Sparse + Dense)', () => {
    const hybridIndexName = `mastra-hybrid-${Date.now()}-${Math.random().toString(36).substring(2)}`;

    // Helper function to create a normalized vector
    const createVector = (primaryDimension: number, value: number = 1.0): number[] => {
      const vector = new Array(VECTOR_DIMENSION).fill(0);
      vector[primaryDimension] = value;
      // Normalize the vector for cosine similarity
      const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      return vector.map(val => val / magnitude);
    };

    afterEach(async () => {
      try {
        await vectorStore.deleteIndex({ indexName: hybridIndexName });
      } catch {
        // Index might not exist
      }
    });

    it('should upsert vectors with sparse vectors', async () => {
      const vectors = [createVector(0, 1.0), createVector(1, 1.0)];
      const sparseVectors = [
        { indices: [1, 5, 10], values: [0.8, 0.6, 0.4] },
        { indices: [2, 6, 11], values: [0.7, 0.5, 0.3] },
      ];
      const metadata = [{ type: 'sparse-test-1' }, { type: 'sparse-test-2' }];

      const ids = await vectorStore.upsert({
        indexName: hybridIndexName,
        vectors,
        sparseVectors,
        metadata,
      });

      expect(ids).toHaveLength(2);
      expect(ids[0]).toBeDefined();
      expect(ids[1]).toBeDefined();

      await waitUntilVectorsIndexed(vectorStore, hybridIndexName, 2);
    }, 30000);

    it('should query with sparse vector for hybrid search', async () => {
      const vectors = [createVector(0, 1.0), createVector(1, 1.0)];
      const sparseVectors = [
        { indices: [1, 5, 10], values: [0.8, 0.6, 0.4] },
        { indices: [2, 6, 11], values: [0.7, 0.5, 0.3] },
      ];
      const metadata = [{ type: 'hybrid-query-test-1' }, { type: 'hybrid-query-test-2' }];

      await vectorStore.upsert({
        indexName: hybridIndexName,
        vectors,
        sparseVectors,
        metadata,
      });

      await waitUntilVectorsIndexed(vectorStore, hybridIndexName, 2);

      const results = await vectorStore.query({
        indexName: hybridIndexName,
        queryVector: createVector(0, 0.9),
        sparseVector: { indices: [1, 5], values: [0.9, 0.7] },
        topK: 2,
      });

      expect(results).toHaveLength(2);
      expect(results[0]?.metadata).toBeDefined();
      expect(results[0]?.score).toBeGreaterThan(0);
    }, 30000);

    it('should query with fusion algorithm', async () => {
      const vectors = [createVector(0, 1.0), createVector(1, 1.0)];
      const sparseVectors = [
        { indices: [1, 5, 10], values: [0.8, 0.6, 0.4] },
        { indices: [2, 6, 11], values: [0.7, 0.5, 0.3] },
      ];

      await vectorStore.upsert({
        indexName: hybridIndexName,
        vectors,
        sparseVectors,
      });

      await waitUntilVectorsIndexed(vectorStore, hybridIndexName, 2);

      const { FusionAlgorithm } = await import('@upstash/vector');

      const results = await vectorStore.query({
        indexName: hybridIndexName,
        queryVector: createVector(0, 0.9),
        sparseVector: { indices: [1, 5], values: [0.9, 0.7] },
        fusionAlgorithm: FusionAlgorithm.RRF,
        topK: 2,
      });

      expect(results).toHaveLength(2);
      expect(results[0]?.score).toBeGreaterThan(0);
    }, 30000);

    it('should work with dense-only queries (backward compatibility)', async () => {
      const vectors = [createVector(0, 1.0), createVector(1, 1.0)];
      const sparseVectors = [
        { indices: [1, 5, 10], values: [0.8, 0.6, 0.4] },
        { indices: [2, 6, 11], values: [0.7, 0.5, 0.3] },
      ];

      await vectorStore.upsert({
        indexName: hybridIndexName,
        vectors,
        sparseVectors,
      });

      await waitUntilVectorsIndexed(vectorStore, hybridIndexName, 2);

      const results = await vectorStore.query({
        indexName: hybridIndexName,
        queryVector: createVector(0, 0.9),
        topK: 2,
      });

      expect(results).toHaveLength(2);
      expect(results[0]?.score).toBeGreaterThan(0);
    }, 30000);

    it('should support QueryMode for dense-only queries', async () => {
      const vectors = [createVector(0, 1.0), createVector(1, 1.0)];
      const sparseVectors = [
        { indices: [1, 5, 10], values: [0.8, 0.6, 0.4] },
        { indices: [2, 6, 11], values: [0.7, 0.5, 0.3] },
      ];

      await vectorStore.upsert({
        indexName: hybridIndexName,
        vectors,
        sparseVectors,
      });

      await waitUntilVectorsIndexed(vectorStore, hybridIndexName, 2);

      const { QueryMode } = await import('@upstash/vector');

      const results = await vectorStore.query({
        indexName: hybridIndexName,
        queryVector: createVector(0, 0.9),
        queryMode: QueryMode.DENSE,
        topK: 2,
      });

      expect(results).toHaveLength(2);
      expect(results[0]?.score).toBeGreaterThan(0);
    }, 30000);

    it('should support QueryMode for sparse-only queries', async () => {
      const vectors = [createVector(0, 1.0), createVector(1, 1.0)];
      const sparseVectors = [
        { indices: [1, 5, 10], values: [0.8, 0.6, 0.4] },
        { indices: [2, 6, 11], values: [0.7, 0.5, 0.3] },
      ];

      await vectorStore.upsert({
        indexName: hybridIndexName,
        vectors,
        sparseVectors,
      });

      await waitUntilVectorsIndexed(vectorStore, hybridIndexName, 2);

      const { QueryMode } = await import('@upstash/vector');

      const results = await vectorStore.query({
        indexName: hybridIndexName,
        queryVector: createVector(0, 0.9),
        sparseVector: { indices: [1, 5], values: [0.9, 0.7] },
        queryMode: QueryMode.SPARSE,
        topK: 2,
      });

      expect(results).toHaveLength(2);
      expect(results[0]?.score).toBeGreaterThan(0);
    }, 30000);

    it('should support QueryMode for hybrid queries', async () => {
      const vectors = [createVector(0, 1.0), createVector(1, 1.0)];
      const sparseVectors = [
        { indices: [1, 5, 10], values: [0.8, 0.6, 0.4] },
        { indices: [2, 6, 11], values: [0.7, 0.5, 0.3] },
      ];

      await vectorStore.upsert({
        indexName: hybridIndexName,
        vectors,
        sparseVectors,
      });

      await waitUntilVectorsIndexed(vectorStore, hybridIndexName, 2);

      const { QueryMode } = await import('@upstash/vector');

      const results = await vectorStore.query({
        indexName: hybridIndexName,
        queryVector: createVector(0, 0.9),
        sparseVector: { indices: [1, 5], values: [0.9, 0.7] },
        queryMode: QueryMode.HYBRID,
        topK: 2,
      });

      expect(results).toHaveLength(2);
      expect(results[0]?.score).toBeGreaterThan(0);
    }, 30000);
  });
});
