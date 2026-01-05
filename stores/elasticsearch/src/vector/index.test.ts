// To setup an ElasticSearch server, run the docker compose file in the elasticsearch directory
import { createVectorTestSuite } from '@internal/storage-test-utils';
import type { QueryResult } from '@mastra/core/vector';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ElasticSearchVector } from './index';

/**
 * Helper function to check if two vectors are similar (cosine similarity close to 1)
 * This is needed because ElasticSearch may normalize vectors when using cosine similarity
 */
function areVectorsSimilar(v1: number[] | undefined, v2: number[] | undefined, threshold = 0.99): boolean {
  if (!v1 || !v2 || v1.length !== v2.length) return false;

  // Calculate cosine similarity
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  for (let i = 0; i < v1.length; i++) {
    dotProduct += v1[i] * v2[i];
    mag1 += v1[i] * v1[i];
    mag2 += v2[i] * v2[i];
  }

  mag1 = Math.sqrt(mag1);
  mag2 = Math.sqrt(mag2);

  if (mag1 === 0 || mag2 === 0) return false;

  const similarity = dotProduct / (mag1 * mag2);
  return similarity >= threshold;
}

describe('ElasticSearchVector', () => {
  let vectorDB: ElasticSearchVector;
  const url = 'http://localhost:9200';
  const testIndexName = 'test-index-' + Date.now();
  const testIndexName2 = 'test-index2-' + Date.now();

  beforeAll(async () => {
    // Initialize ElasticSearchVector
    vectorDB = new ElasticSearchVector({ url, id: 'elasticsearch-test' });
  });

  afterAll(async () => {
    // Clean up test tables
    await vectorDB.deleteIndex({ indexName: testIndexName });
  });

  // Index Management Tests
  describe('Index Management', () => {
    describe('createIndex', () => {
      afterAll(async () => {
        await vectorDB.deleteIndex({ indexName: testIndexName2 });
      });

      it('should create a new vector table with specified dimensions', async () => {
        await vectorDB.createIndex({ indexName: testIndexName, dimension: 3 });
        const stats = await vectorDB.describeIndex({ indexName: testIndexName });
        expect(stats?.dimension).toBe(3);
        expect(stats?.count).toBe(0);
      });

      it('should create index with specified metric', async () => {
        await vectorDB.createIndex({ indexName: testIndexName2, dimension: 3, metric: 'euclidean' });
        const stats = await vectorDB.describeIndex({ indexName: testIndexName2 });
        expect(stats.metric).toBe('euclidean');
      });

      it('should throw error if dimension is invalid', async () => {
        await expect(vectorDB.createIndex({ indexName: 'testIndexNameFail', dimension: 0 })).rejects.toThrow();
      });
    });

    describe('metrics', () => {
      const testIndex = 'test_metric';
      afterEach(async () => {
        await vectorDB.deleteIndex({ indexName: testIndex });
      });
      it('should create index with cosine metric', async () => {
        await vectorDB.createIndex({
          indexName: testIndex,
          dimension: 3,
          metric: 'cosine',
        });
        const stats = await vectorDB.describeIndex({ indexName: testIndex });
        expect(stats.metric).toBe('cosine');
      });

      it('should create index with euclidean metric', async () => {
        await vectorDB.createIndex({
          indexName: testIndex,
          dimension: 3,
          metric: 'euclidean',
        });
        const stats = await vectorDB.describeIndex({ indexName: testIndex });
        expect(stats.metric).toBe('euclidean');
      });

      it('should create index with dotproduct', async () => {
        await vectorDB.createIndex({
          indexName: testIndex,
          dimension: 3,
          metric: 'dotproduct',
        });
        const stats = await vectorDB.describeIndex({ indexName: testIndex });
        expect(stats.metric).toBe('dotproduct');
      });
    });

    describe('listIndexes', () => {
      const indexName = 'test_query_3';
      const deleteTestIndexName = 'test_query_3_delete';

      beforeAll(async () => {
        await vectorDB.createIndex({ indexName, dimension: 3 });
      });

      afterAll(async () => {
        await vectorDB.deleteIndex({ indexName });
        // Clean up deletion test index if it still exists
        try {
          await vectorDB.deleteIndex({ indexName: deleteTestIndexName });
        } catch {
          // Ignore if already deleted
        }
      });

      it('should list all vector tables', async () => {
        const indexes = await vectorDB.listIndexes();
        expect(indexes).toContain(indexName);
      });

      it('should not return created index in list if it is deleted', async () => {
        // Use a separate index for the deletion test to avoid state dependency
        await vectorDB.createIndex({ indexName: deleteTestIndexName, dimension: 3 });
        const indexesBefore = await vectorDB.listIndexes();
        expect(indexesBefore).toContain(deleteTestIndexName);

        await vectorDB.deleteIndex({ indexName: deleteTestIndexName });
        const indexesAfter = await vectorDB.listIndexes();
        expect(indexesAfter).not.toContain(deleteTestIndexName);
      });
    });

    describe('describeIndex', () => {
      const indexName = 'test_query_4';
      beforeAll(async () => {
        await vectorDB.createIndex({ indexName, dimension: 3 });
      });

      afterAll(async () => {
        await vectorDB.deleteIndex({ indexName });
      });

      it('should return correct index stats', async () => {
        const vectors = [
          [1, 2, 3],
          [4, 5, 6],
        ];
        await vectorDB.upsert({ indexName, vectors });

        const stats = await vectorDB.describeIndex({ indexName });
        expect(stats).toEqual({
          dimension: 3,
          count: 2,
          metric: 'cosine',
        });
      });

      it('should throw error for non-existent index', async () => {
        await expect(vectorDB.describeIndex({ indexName: 'non_existent' })).rejects.toThrow();
      });
    });

    // Verify basic index creation and deletion
    describe('Basic Index Operations', () => {
      const testIndexName = 'basic-query';
      it('should create an index and verify its existence', async () => {
        await vectorDB.createIndex({ indexName: testIndexName, dimension: 1536 });

        const indexes = await vectorDB.listIndexes();
        expect(indexes).toContain(testIndexName);

        // Delete the index after the test
        await vectorDB.deleteIndex({ indexName: testIndexName });
      });

      it('should throw an error if dimension is not a positive integer', async () => {
        await expect(vectorDB.createIndex({ indexName: testIndexName, dimension: -1 })).rejects.toThrow(
          'Dimension must be a positive integer',
        );
      });

      it('should delete an index and verify its deletion', async () => {
        const deleteTestIndex = 'test-deletion-' + Date.now();
        await vectorDB.createIndex({ indexName: deleteTestIndex, dimension: 1536 });

        let indexes = await vectorDB.listIndexes();
        expect(indexes).toContain(deleteTestIndex);

        await vectorDB.deleteIndex({ indexName: deleteTestIndex });

        indexes = await vectorDB.listIndexes();
        expect(indexes).not.toContain(deleteTestIndex);
      });
    });
  });

  describe('Vector Operations', () => {
    let testIndexName = 'test_vector';
    beforeEach(async () => {
      await vectorDB.createIndex({ indexName: testIndexName, dimension: 3 });
    });

    afterEach(async () => {
      await vectorDB.deleteIndex({ indexName: testIndexName });
    });

    describe('query', () => {
      it('should query vectors and return nearest neighbors', async () => {
        const testMetadata = [{ label: 'x-axis' }, { label: 'y-axis' }, { label: 'z-axis' }];
        const testVectors = [
          [1.0, 0.0, 0.0],
          [0.0, 1.0, 0.0],
          [0.0, 0.0, 1.0],
        ];

        await vectorDB.upsert({ indexName: testIndexName, vectors: testVectors, metadata: testMetadata });

        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1.0, 0.1, 0.1],
          topK: 3,
        });

        expect(results).toHaveLength(3);
        expect(results[0]?.score).toBeGreaterThan(0);
        expect(results[0]?.metadata).toBeDefined();
      });

      it('should query vectors and return vector in results', async () => {
        const dimension = 3;
        const queryVector = [1.0, 0.1, 0.1];
        const testMetadata = [{ label: 'x-axis' }, { label: 'y-axis' }, { label: 'z-axis' }];
        const testVectors = [
          [1.0, 0.0, 0.0],
          [0.0, 1.0, 0.0],
          [0.0, 0.0, 1.0],
        ];

        await vectorDB.upsert({ indexName: testIndexName, vectors: testVectors, metadata: testMetadata });

        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector,
          topK: 3,
          includeVector: true,
        });

        expect(results).toHaveLength(3);
        expect(results?.[0]?.vector).toBeDefined();
        expect(results?.[0]?.vector).toHaveLength(dimension);
      });

      it('should query vectors with metadata filter - A', async () => {
        const testMetadata = [
          { label: 'x-axis', num: 1 },
          { label: 'y-axis', num: 2 },
          { label: 'z-axis', num: 3 },
        ];
        const testVectors = [
          [0.0, 1.0, 0.0],
          [0.0, 1.0, 0.0],
          [0.0, 1.0, 0.0],
        ];
        const queryVector = [0.0, 1.0, 0.0];
        const queryFilter = { label: 'x-axis', num: 1 };

        await vectorDB.upsert({ indexName: testIndexName, vectors: testVectors, metadata: testMetadata });

        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: queryVector,
          filter: queryFilter,
          topK: 10,
        });

        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.label).toBe('x-axis');
      }, 50000);

      it('should query vectors with metadata filter - B', async () => {
        const testMetadata = [
          { label: 'x-axis', num: 1 },
          { label: 'y-axis', num: 2 },
          { label: 'z-axis', num: 3 },
        ];
        const testVectors = [
          [0.0, 1.0, 0.0],
          [0.0, 1.0, 0.0],
          [0.0, 1.0, 0.0],
        ];
        const queryVector = [0.0, 1.0, 0.0];
        const queryFilter = { label: 'x-axis', num: 2 };

        await vectorDB.upsert({ indexName: testIndexName, vectors: testVectors, metadata: testMetadata });

        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: queryVector,
          filter: queryFilter,
          topK: 10,
        });

        expect(results).toHaveLength(0);
      }, 50000);
    });

    describe('upsert', () => {
      let testIndexName = 'test_vector_upsert';
      beforeEach(async () => {
        await vectorDB.createIndex({ indexName: testIndexName, dimension: 3 });
      });

      afterEach(async () => {
        await vectorDB.deleteIndex({ indexName: testIndexName });
      });

      it('should insert new vectors', async () => {
        const vectors = [
          [1, 2, 3],
          [4, 5, 6],
        ];
        const ids = await vectorDB.upsert({ indexName: testIndexName, vectors });

        expect(ids).toHaveLength(2);
        const stats = await vectorDB.describeIndex({ indexName: testIndexName });
        expect(stats.count).toBe(2);
      });

      it('should update existing vectors', async () => {
        const vectors = [[1, 2, 3]];
        const metadata = [{ test: 'initial' }];
        const [id] = await vectorDB.upsert({ indexName: testIndexName, vectors, metadata });

        const updatedVectors = [[4, 5, 6]];
        const updatedMetadata = [{ test: 'updated' }];
        await vectorDB.upsert({
          indexName: testIndexName,
          vectors: updatedVectors,
          metadata: updatedMetadata,
          ids: [id!],
        });

        const results = await vectorDB.query({ indexName: testIndexName, queryVector: [4, 5, 6], topK: 1 });
        expect(results[0]?.id).toBe(id);
        expect(results[0]?.metadata).toEqual({ test: 'updated' });
      });

      it('should handle metadata correctly', async () => {
        const vectors = [[1, 2, 3]];
        const metadata = [{ test: 'value', num: 123 }];

        await vectorDB.upsert({ indexName: testIndexName, vectors, metadata });
        const results = await vectorDB.query({ indexName: testIndexName, queryVector: [1, 2, 3], topK: 1 });

        expect(results[0]?.metadata).toEqual(metadata[0]);
      });

      it('should throw an error if vector dimension does not match index dimension', async () => {
        await expect(vectorDB.upsert({ indexName: testIndexName, vectors: [[1, 2, 3, 4]] })).rejects.toThrow(
          'Vector dimension does not match index dimension',
        );
      });
    });

    describe('updates', () => {
      // Use vectors with distinct directions to ensure predictable query results with cosine similarity
      const testVectors = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];

      beforeEach(async () => {
        await vectorDB.createIndex({ indexName: testIndexName, dimension: 3 });
      });

      afterEach(async () => {
        await vectorDB.deleteIndex({ indexName: testIndexName });
      });

      it('should update the vector by id', async () => {
        const ids = await vectorDB.upsert({ indexName: testIndexName, vectors: testVectors });
        expect(ids).toHaveLength(3);

        const idToBeUpdated = ids[0];
        const newVector = [1, 2, 3];
        const newMetaData = {
          test: 'updates',
        };

        const update = {
          vector: newVector,
          metadata: newMetaData,
        };

        await vectorDB.updateVector({ indexName: testIndexName, id: idToBeUpdated, update });

        const results: QueryResult[] = await vectorDB.query({
          indexName: testIndexName,
          queryVector: newVector,
          topK: 2,
          includeVector: true,
        });
        expect(results[0]?.id).toBe(idToBeUpdated);
        // Check vector similarity instead of exact equality due to normalization
        expect(areVectorsSimilar(results[0]?.vector, newVector)).toBe(true);
        expect(results[0]?.metadata).toEqual(newMetaData);
      });

      it('should only update the metadata by id', async () => {
        const ids = await vectorDB.upsert({ indexName: testIndexName, vectors: testVectors });
        expect(ids).toHaveLength(3);

        const idToBeUpdated = ids[0];
        const newMetaData = {
          test: 'updates',
        };

        const update = {
          metadata: newMetaData,
        };

        await vectorDB.updateVector({ indexName: testIndexName, id: idToBeUpdated, update });

        const results: QueryResult[] = await vectorDB.query({
          indexName: testIndexName,
          queryVector: testVectors[0],
          topK: 2,
          includeVector: true,
        });
        expect(results[0]?.id).toBe(idToBeUpdated);
        // Check vector similarity instead of exact equality due to normalization
        expect(areVectorsSimilar(results[0]?.vector, testVectors[0])).toBe(true);
        expect(results[0]?.metadata).toEqual(newMetaData);
      });

      it('should only update vector embeddings by id', async () => {
        const ids = await vectorDB.upsert({ indexName: testIndexName, vectors: testVectors });
        expect(ids).toHaveLength(3);

        const idToBeUpdated = ids[0];
        const newVector = [4, 4, 4];

        const update = {
          vector: newVector,
        };

        await vectorDB.updateVector({ indexName: testIndexName, id: idToBeUpdated, update });

        const results: QueryResult[] = await vectorDB.query({
          indexName: testIndexName,
          queryVector: newVector,
          topK: 2,
          includeVector: true,
        });
        expect(results[0]?.id).toBe(idToBeUpdated);
        // Check vector similarity instead of exact equality due to normalization
        expect(areVectorsSimilar(results[0]?.vector, newVector)).toBe(true);
      });

      it('should throw exception when no updates are given', async () => {
        await expect(vectorDB.updateVector({ indexName: testIndexName, id: 'id', update: {} })).rejects.toThrow(
          'No updates provided',
        );
      });
    });

    describe('deletes', () => {
      let testIndexName = 'test_vector_deletes';
      const testVectors = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ];

      beforeEach(async () => {
        await vectorDB.createIndex({ indexName: testIndexName, dimension: 3 });
      });

      afterEach(async () => {
        await vectorDB.deleteIndex({ indexName: testIndexName });
      });

      it('should delete the vector by id', async () => {
        const ids = await vectorDB.upsert({ indexName: testIndexName, vectors: testVectors });
        expect(ids).toHaveLength(3);
        const idToBeDeleted = ids[0];

        await vectorDB.deleteVector({ indexName: testIndexName, id: idToBeDeleted });

        const results: QueryResult[] = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1.0, 0.0, 0.0],
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
      await vectorDB.createIndex({ indexName: testIndexName, dimension: 3 });
    });

    afterAll(async () => {
      await vectorDB.deleteIndex({ indexName: testIndexName });
    });

    it('should handle non-existent index queries', async () => {
      await expect(vectorDB.query({ indexName: 'non-existent-index', queryVector: [1, 2, 3] })).rejects.toThrow();
    });

    it('should handle invalid dimension vectors', async () => {
      const invalidVector = [1, 2, 3, 4]; // 4D vector for 3D index
      await expect(vectorDB.upsert({ indexName: testIndexName, vectors: [invalidVector] })).rejects.toThrow();
    });

    it('should handle duplicate index creation gracefully', async () => {
      const infoSpy = vi.spyOn(vectorDB['logger'], 'info');
      const warnSpy = vi.spyOn(vectorDB['logger'], 'warn');

      const duplicateIndexName = `duplicate-test`;
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
});

// Metadata filtering and advanced operations tests
describe('ElasticSearch Metadata Filtering', () => {
  const elasticSearchVector = new ElasticSearchVector({
    url: 'http://localhost:9200',
    id: 'elasticsearch-metadata-test',
  });

  createVectorTestSuite({
    vector: elasticSearchVector,
    createIndex: async (indexName: string) => {
      await elasticSearchVector.createIndex({ indexName, dimension: 1536 });
    },
    deleteIndex: async (indexName: string) => {
      await elasticSearchVector.deleteIndex({ indexName });
    },
    waitForIndexing: async () => {
      // ElasticSearch indexes immediately with refresh: true
      await new Promise(resolve => setTimeout(resolve, 100));
    },
  });
});
