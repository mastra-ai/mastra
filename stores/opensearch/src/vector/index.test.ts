// To setup a Opensearch server, run the docker compose file in the opensearch directory
import type { QueryVectorParams } from '@mastra/core';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { OpenSearchVector } from './index';

describe('OpenSearchVector', () => {
  let openSearch: OpenSearchVector;
  const url = 'http://localhost:9200';
  const testCollectionName = 'test-collection-' + Date.now();

  // Verify basic index creation and deletion
  describe('Basic Index Operations', () => {
    beforeEach(() => {
      openSearch = new OpenSearchVector(url);
    });

    it('should create an index and verify its existence', async () => {
      await openSearch.createIndex({ indexName: testCollectionName, dimension: 1536 });

      const indexes = await openSearch.listIndexes();
      expect(indexes).toContain(testCollectionName);

      // Delete the index after the test
      await openSearch.deleteIndex(testCollectionName);
    });

    it('should throw an error if dimension is not a positive integer', async () => {
      await expect(openSearch.createIndex({ indexName: testCollectionName, dimension: -1 })).rejects.toThrow(
        'Dimension must be a positive integer',
      );
    });

    it('should delete an index and verify its deletion', async () => {
      const deleteTestIndex = 'test-deletion-' + Date.now();
      await openSearch.createIndex({ indexName: deleteTestIndex, dimension: 1536 });

      let indexes = await openSearch.listIndexes();
      expect(indexes).toContain(deleteTestIndex);

      await openSearch.deleteIndex(deleteTestIndex);

      indexes = await openSearch.listIndexes();
      expect(indexes).not.toContain(deleteTestIndex);
    });
  });

  describe('Other Index Operations', () => {
    beforeEach(async () => {
      openSearch = new OpenSearchVector(url);
      await openSearch.createIndex({ indexName: testCollectionName, dimension: 1536 });
    });

    afterAll(async () => {
      await openSearch.deleteIndex(testCollectionName);
    });

    it('should describe index with correct properties', async () => {
      const stats = await openSearch.describeIndex(testCollectionName);
      expect(stats.dimension).toBe(1536);
      expect(stats.metric).toBe('cosine');
      expect(typeof stats.count).toBe('number');
    });
  });

  describe('Vector Operations', () => {
    beforeEach(async () => {
      openSearch = new OpenSearchVector(url);
      await openSearch.createIndex({ indexName: testCollectionName, dimension: 3 });
    });

    afterEach(async () => {
      try {
        await openSearch.deleteIndex(testCollectionName);
      } catch (error) {
        console.error('Error deleting index:', error);
      }
    });

    it('should insert new vectors', async () => {
      const vectors = [
        [1, 2, 3],
        [4, 5, 6],
      ];
      const ids = await openSearch.upsert({ indexName: testCollectionName, vectors });

      expect(ids).toHaveLength(2);
      const stats = await openSearch.describeIndex(testCollectionName);
      expect(stats.count).toBe(2);
    });

    it('should throw an error if vector dimension does not match index dimension', async () => {
      await expect(openSearch.upsert({ indexName: testCollectionName, vectors: [[1, 2, 3, 4]] })).rejects.toThrow(
        'Vector dimension does not match index dimension',
      );
    });

    it('should update existing vectors', async () => {
      const vectors = [[1, 2, 3]];
      const metadata = [{ test: 'initial' }];
      const [id] = await openSearch.upsert({ indexName: testCollectionName, vectors, metadata });

      const updatedVectors = [[4, 5, 6]];
      const updatedMetadata = [{ test: 'updated' }];

      await openSearch.upsert({
        indexName: testCollectionName,
        vectors: updatedVectors,
        metadata: updatedMetadata,
        ids: [id!],
      });

      const queryParams: QueryVectorParams = {
        indexName: testCollectionName,
        queryVector: [4, 5, 6],
        topK: 1,
      };

      const results = await openSearch.query(queryParams);

      expect(results[0]?.id).toBe(id);
      expect(results[0]?.metadata).toEqual({ test: 'updated' });
    });

    it('should handle metadata correctly', async () => {
      const vectors = [[1, 2, 3]];
      const metadata = [{ test: 'value', num: 123 }];

      await openSearch.upsert({ indexName: testCollectionName, vectors, metadata });
      const queryParams: QueryVectorParams = {
        indexName: testCollectionName,
        queryVector: [1, 2, 3],
        topK: 1,
      };
      const results = await openSearch.query(queryParams);

      expect(results[0]?.metadata).toEqual(metadata[0]);
    });

    it('should upsert vectors with metadata', async () => {
      const testMetadata = [{ label: 'x-axis' }, { label: 'y-axis' }, { label: 'z-axis' }];
      const testVectors = [
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0],
      ];

      const vectorIds = await openSearch.upsert({
        indexName: testCollectionName,
        vectors: testVectors,
        metadata: testMetadata,
      });
      expect(vectorIds).toHaveLength(3);

      const stats = await openSearch.describeIndex(testCollectionName);
      expect(stats.count).toBe(3);
    });

    it('should query vectors and return nearest neighbors', async () => {
      const testMetadata = [{ label: 'x-axis' }, { label: 'y-axis' }, { label: 'z-axis' }];
      const testVectors = [
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0],
      ];

      await openSearch.upsert({ indexName: testCollectionName, vectors: testVectors, metadata: testMetadata });

      const queryParams: QueryVectorParams = {
        indexName: testCollectionName,
        queryVector: [1.0, 0.1, 0.1],
        topK: 3,
      };
      const results = await openSearch.query(queryParams);

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

      await openSearch.upsert({ indexName: testCollectionName, vectors: testVectors, metadata: testMetadata });

      const results = await openSearch.query({
        indexName: testCollectionName,
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

      await openSearch.upsert({ indexName: testCollectionName, vectors: testVectors, metadata: testMetadata });

      const results = await openSearch.query({
        indexName: testCollectionName,
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

      await openSearch.upsert({ indexName: testCollectionName, vectors: testVectors, metadata: testMetadata });

      const results = await openSearch.query({
        indexName: testCollectionName,
        queryVector: queryVector,
        filter: queryFilter,
        topK: 10,
      });

      expect(results).toHaveLength(0);
    }, 50000);

    it('should query vectors with complex metadata filter - A', async () => {
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
      const queryFilter = {
        $and: [{ label: 'y-axis' }, { num: { $gt: 1 } }],
      };

      await openSearch.upsert({ indexName: testCollectionName, vectors: testVectors, metadata: testMetadata });

      const results = await openSearch.query({
        indexName: testCollectionName,
        queryVector: queryVector,
        filter: queryFilter,
        topK: 10,
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.metadata?.label).toBe('y-axis');
    }, 50000);

    it('should query vectors with complex metadata filter - B', async () => {
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
      const queryFilter = { $and: [{ label: 'x-axis' }, { num: { $gt: 1 } }] };

      await openSearch.upsert({ indexName: testCollectionName, vectors: testVectors, metadata: testMetadata });

      const results = await openSearch.query({
        indexName: testCollectionName,
        queryVector: queryVector,
        filter: queryFilter,
        topK: 10,
      });

      expect(results).toHaveLength(0);
    }, 50000);

    it('should handle complex nested filters with multiple conditions', async () => {
      const testMetadata = [
        {
          category: 'electronics',
          price: 100,
          tags: ['new', 'featured'],
          specs: { color: 'black', weight: 500 },
        },
        {
          category: 'electronics',
          price: 200,
          tags: ['used', 'sale'],
          specs: { color: 'white', weight: 300 },
        },
        {
          category: 'clothing',
          price: 50,
          tags: ['new', 'featured'],
          specs: { color: 'blue', weight: 100 },
        },
      ];

      const testVectors = [
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0],
      ];

      await openSearch.upsert({
        indexName: testCollectionName,
        vectors: testVectors,
        metadata: testMetadata,
      });

      const complexFilter = {
        $and: [
          { category: 'electronics' },
          { price: { $gt: 150 } },
          { tags: { $in: ['sale', 'featured'] } },
          { 'specs.weight': { $lt: 400 } },
        ],
      };

      const results = await openSearch.query({
        indexName: testCollectionName,
        queryVector: [0.0, 1.0, 0.0],
        filter: complexFilter,
        topK: 10,
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.metadata).toEqual(testMetadata[1]);
    }, 50000);
  });
});
