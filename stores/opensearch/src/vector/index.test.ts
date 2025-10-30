// To setup a Opensearch server, run the docker compose file in the opensearch directory
import type { QueryResult } from '@mastra/core/vector';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { OpenSearchVector } from './index';

/**
 * Helper function to check if two vectors are similar (cosine similarity close to 1)
 * This is needed because OpenSearch may normalize vectors when using cosine similarity
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

describe('OpenSearchVector', () => {
  let vectorDB: OpenSearchVector;
  const url = 'http://localhost:9200';
  const testIndexName = 'test-index-' + Date.now();
  const testIndexName2 = 'test-index2-' + Date.now();

  beforeAll(async () => {
    // Initialize PgVector
    vectorDB = new OpenSearchVector({ url });
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
      beforeAll(async () => {
        await vectorDB.createIndex({ indexName, dimension: 3 });
      });

      afterAll(async () => {
        await vectorDB.deleteIndex({ indexName });
      });

      it('should list all vector tables', async () => {
        const indexes = await vectorDB.listIndexes();
        expect(indexes).toContain(indexName);
      });

      it('should not return created index in list if it is deleted', async () => {
        await vectorDB.deleteIndex({ indexName });
        const indexes = await vectorDB.listIndexes();
        expect(indexes).not.toContain(indexName);
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

        await vectorDB.upsert({ indexName: testIndexName, vectors: testVectors, metadata: testMetadata });

        const results = await vectorDB.query({
          indexName: testIndexName,
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

        await vectorDB.upsert({ indexName: testIndexName, vectors: testVectors, metadata: testMetadata });

        const results = await vectorDB.query({
          indexName: testIndexName,
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

        await vectorDB.upsert({
          indexName: testIndexName,
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

        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [0.0, 1.0, 0.0],
          filter: complexFilter,
          topK: 10,
        });

        expect(results).toHaveLength(1);
        expect(results[0]?.metadata).toEqual(testMetadata[1]);
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
      let testIndexName = 'test_vector_updates';
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

  // Advanced Query and Filter Tests
  describe('Advanced Query and Filter Operations', () => {
    const indexName = 'test_query_filters';

    beforeEach(async () => {
      await vectorDB.createIndex({ indexName, dimension: 3 });
      const vectors = [
        [1, 0.1, 0],
        [0.9, 0.2, 0],
        [0.95, 0.1, 0],
        [0.85, 0.2, 0],
        [0.9, 0.1, 0],
      ];

      const metadata = [
        {
          category: 'electronics',
          price: 100,
          tags: ['new', 'premium'],
          active: true,
          ratings: [4.5, 4.8, 4.2], // Array of numbers
          stock: [
            { location: 'A', count: 25 },
            { location: 'B', count: 15 },
          ], // Array of objects
          reviews: [
            { user: 'alice', score: 5, verified: true },
            { user: 'bob', score: 4, verified: true },
            { user: 'charlie', score: 3, verified: false },
          ], // Complex array objects
        },
        {
          category: 'books',
          price: 50,
          tags: ['used'],
          active: true,
          ratings: [3.8, 4.0, 4.1],
          stock: [
            { location: 'A', count: 10 },
            { location: 'C', count: 30 },
          ],
          reviews: [
            { user: 'dave', score: 4, verified: true },
            { user: 'eve', score: 5, verified: false },
          ],
        },
        { category: 'electronics', price: 75, tags: ['refurbished'], active: false },
        { category: 'books', price: 25, tags: ['used', 'sale'], active: true },
        { category: 'clothing', price: 60, tags: ['new'], active: true },
      ];

      await vectorDB.upsert({ indexName, vectors, metadata });
    });

    afterEach(async () => {
      await vectorDB.deleteIndex({ indexName });
    });

    // Numeric Comparison Tests
    describe('Comparison Operators', () => {
      it('should handle numeric string comparisons', async () => {
        // Insert a record with numeric string
        await vectorDB.upsert({ indexName, vectors: [[1, 0.1, 0]], metadata: [{ numericString: '123' }] });

        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { numericString: { $gt: '100' } },
        });
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]?.metadata?.numericString).toBe('123');
      });

      it('should filter with $gt operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $gt: 75 } },
        });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.price).toBe(100);
      });

      it('should filter with $lte operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $lte: 50 } },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.price).toBeLessThanOrEqual(50);
        });
      });

      it('should filter with lt operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $lt: 60 } },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.price).toBeLessThan(60);
        });
      });

      it('should filter with gte operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $gte: 75 } },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.price).toBeGreaterThanOrEqual(75);
        });
      });

      it('should filter with ne operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $ne: 'electronics' } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).not.toBe('electronics');
        });
      });

      it('should filter with $gt and $lte operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $gt: 70, $lte: 100 } },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.price).toBeGreaterThan(70);
          expect(result.metadata?.price).toBeLessThanOrEqual(100);
        });
      });
    });

    // Array Operator Tests
    describe('Array Operators', () => {
      it('should filter with $in operator for scalar field', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $in: ['electronics', 'clothing'] } },
        });
        expect(results).toHaveLength(3);
        results.forEach(result => {
          expect(['electronics', 'clothing']).toContain(result.metadata?.category);
        });
      });

      it('should filter with $in operator for array field', async () => {
        // Insert a record with tags as array
        await vectorDB.upsert({
          indexName,
          vectors: [[2, 0.2, 0]],
          metadata: [{ tags: ['featured', 'sale', 'new'] }],
        });
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $in: ['sale', 'clearance'] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.tags.some((tag: string) => ['sale', 'clearance'].includes(tag))).toBe(true);
        });
      });

      it('should filter with $nin operator for scalar field', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $nin: ['electronics', 'books'] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).not.toContain(result.metadata?.category);
        });
      });

      it('should filter with $nin operator for array field', async () => {
        // Insert a record with tags as array
        await vectorDB.upsert({
          indexName,
          vectors: [[2, 0.3, 0]],
          metadata: [{ tags: ['clearance', 'used'] }],
        });
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $nin: ['new', 'sale'] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.tags.every((tag: string) => !['new', 'sale'].includes(tag))).toBe(true);
        });
      });

      it('should handle empty arrays in in/nin operators', async () => {
        // Should return no results for empty IN
        const resultsIn = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $in: [] } },
        });
        expect(resultsIn).toHaveLength(0);

        // Should return all results for empty NIN
        const resultsNin = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $nin: [] } },
        });
        expect(resultsNin.length).toBeGreaterThan(0);
      });

      it('should filter with $all operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $all: ['used', 'sale'] } },
        });
        expect(results).toHaveLength(1);
        results.forEach(result => {
          expect(result.metadata?.tags).toContain('used');
          expect(result.metadata?.tags).toContain('sale');
        });
      });

      it('should filter with $all using single value', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $all: ['new'] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.tags).toContain('new');
        });
      });

      it('should handle empty array for $all', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $all: [] } },
        });
        expect(results).toHaveLength(0);
      });

      it('should handle non-array field $all', async () => {
        // First insert a record with non-array field
        await vectorDB.upsert({ indexName, vectors: [[1, 0.1, 0]], metadata: [{ tags: 'not-an-array' }] });

        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $all: ['value'] } },
        });
        expect(results).toHaveLength(0);
      });

      // String Pattern Tests
      it('should handle exact string matches', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: 'electronics' },
        });
        expect(results).toHaveLength(2);
      });

      it('should handle case-sensitive string matches', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: 'ELECTRONICS' },
        });
        expect(results).toHaveLength(0);
      });
    });

    // Logical Operator Tests
    describe('Logical Operators', () => {
      it('should handle AND filter conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $and: [{ category: { $eq: 'electronics' } }, { price: { $gt: 75 } }] },
        });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.category).toBe('electronics');
        expect(results[0]?.metadata?.price).toBeGreaterThan(75);
      });

      it('should handle OR filter conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $or: [{ category: { $eq: 'electronics' } }, { category: { $eq: 'books' } }] },
        });
        expect(results.length).toBeGreaterThan(1);
        results.forEach(result => {
          expect(['electronics', 'books']).toContain(result?.metadata?.category);
        });
      });

      it('should handle $not operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $not: { category: 'electronics' } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).not.toBe('electronics');
        });
      });

      it('should handle nested $not with $or', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $not: { $or: [{ category: 'electronics' }, { category: 'books' }] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).not.toContain(result.metadata?.category);
        });
      });

      it('should handle $not with comparison operators', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $not: { $gt: 100 } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeLessThanOrEqual(100);
        });
      });

      it('should handle $not with $in operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $not: { $in: ['electronics', 'books'] } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).not.toContain(result.metadata?.category);
        });
      });

      it('should handle $not with multiple nested conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $not: { $and: [{ category: 'electronics' }, { price: { $gt: 50 } }] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category !== 'electronics' || result.metadata?.price <= 50).toBe(true);
        });
      });

      it('should handle $not with $exists operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $not: { $exists: true } } },
        });
        expect(results.length).toBe(0); // All test data has tags
      });

      it('should handle $not with array operators', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $not: { $all: ['new', 'premium'] } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(!result.metadata?.tags.includes('new') || !result.metadata?.tags.includes('premium')).toBe(true);
        });
      });

      it('should handle $not with complex nested conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {
            $not: {
              $or: [
                {
                  $and: [{ category: 'electronics' }, { price: { $gt: 90 } }],
                },
                {
                  $and: [{ category: 'books' }, { price: { $lt: 30 } }],
                },
              ],
            },
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          const notExpensiveElectronics = !(result.metadata?.category === 'electronics' && result.metadata?.price > 90);
          const notCheapBooks = !(result.metadata?.category === 'books' && result.metadata?.price < 30);
          expect(notExpensiveElectronics && notCheapBooks).toBe(true);
        });
      });

      it('should handle $not with empty arrays', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $not: { $in: [] } } },
        });
        expect(results.length).toBeGreaterThan(0); // Should match all records
      });

      it('should handle $not with null values', async () => {
        // First insert a record with null value
        await vectorDB.upsert({
          indexName,
          vectors: [[1, 0.1, 0]],
          metadata: [{ category: null, price: 0 }],
        });

        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $not: { $eq: null } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).not.toBeNull();
        });
      });

      it('should handle $not with boolean values', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { active: { $not: { $eq: true } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.active).not.toBe(true);
        });
      });

      it('should handle $not with multiple conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $not: { category: 'electronics', price: { $gt: 50 } } },
        });
        expect(results.length).toBeGreaterThan(0);
      });

      it('should handle $not with $not operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $not: { $not: { category: 'electronics' } } },
        });
        expect(results.length).toBeGreaterThan(0);
      });

      it('should handle $not in nested fields', async () => {
        // Create a unique identifier for this test
        const testId = 'test-' + Date.now();
        await vectorDB.upsert({
          indexName,
          vectors: [[1, 0.1, 0]],
          metadata: [{ user: { profile: { price: 10 } }, testId }],
        });
        await vectorDB.upsert({
          indexName,
          vectors: [[1, 0.1, 0]],
          metadata: [{ user: { profile: { price: 50 } }, testId }],
        });
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {
            $and: [
              { testId }, // Only match our specific test document
              { 'user.profile.price': { $not: { $gt: 25 } } },
            ],
          },
        });
        expect(results.length).toBe(1);
      });

      it('should handle $not with multiple operators', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $not: { $gte: 30, $lte: 70 } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          const price = Number(result.metadata?.price);
          expect(price < 30 || price > 70).toBe(true);
        });
      });

      it('should handle $not with comparison operators', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $not: { $gt: 100 } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeLessThanOrEqual(100);
        });
      });

      it('should handle $not with $and', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $not: { $and: [{ category: 'electronics' }, { price: { $gt: 50 } }] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category !== 'electronics' || result.metadata?.price <= 50).toBe(true);
        });
      });

      it('should handle nested $and with $or and $not', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {
            $and: [{ $or: [{ category: 'electronics' }, { category: 'books' }] }, { $not: { price: { $lt: 50 } } }],
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).toContain(result.metadata?.category);
          expect(result.metadata?.price).toBeGreaterThanOrEqual(50);
        });
      });

      it('should handle $or with multiple $not conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $or: [{ $not: { category: 'electronics' } }, { $not: { price: { $gt: 50 } } }] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category !== 'electronics' || result.metadata?.price <= 50).toBe(true);
        });
      });
    });

    // Edge Cases and Special Values
    describe('Edge Cases and Special Values', () => {
      it('should handle empty result sets with valid filters', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $gt: 1000 } },
        });
        expect(results).toHaveLength(0);
      });

      it('should throw error for invalid operator', async () => {
        await expect(
          vectorDB.query({
            indexName,
            queryVector: [1, 0, 0],
            filter: { price: { $invalid: 100 } as any },
          }),
        ).rejects.toThrow('Unsupported operator: $invalid');
      });

      it('should handle empty filter object', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {},
        });
        expect(results.length).toBeGreaterThan(0);
      });

      it('should handle numeric string comparisons', async () => {
        await vectorDB.upsert({
          indexName,
          vectors: [[1, 0.1, 0]],
          metadata: [{ numericString: '123' }],
        });
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { numericString: { $gt: '100' } },
        });
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]?.metadata?.numericString).toBe('123');
      });
    });

    describe('Edge Cases and Special Values', () => {
      // Additional Edge Cases
      it('should handle empty result sets with valid filters', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $gt: 1000 } },
        });
        expect(results).toHaveLength(0);
      });

      it('should handle empty filter object', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {},
        });
        expect(results.length).toBeGreaterThan(0);
      });

      // Empty Conditions Tests
      it('should handle empty conditions in logical operators', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $and: [], category: 'electronics' },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
        });
      });

      it('should handle empty $and conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $and: [], category: 'electronics' },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
        });
      });

      it('should handle empty $or conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $or: [], category: 'electronics' },
        });
        expect(results).toHaveLength(0);
      });

      it('should handle empty $not conditions', async () => {
        await expect(
          vectorDB.query({
            indexName,
            queryVector: [1, 0, 0],
            filter: { $not: {}, category: 'electronics' },
          }),
        ).rejects.toThrow('$not operator cannot be empty');
      });

      it('should handle multiple empty logical operators', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $and: [], $or: [], category: 'electronics' },
        });
        expect(results).toHaveLength(0);
      });

      // Nested Field Tests
      it('should handle deeply nested metadata paths', async () => {
        await vectorDB.upsert({
          indexName,
          vectors: [[1, 0.1, 0]],
          metadata: [
            {
              level1: {
                level2: {
                  level3: 'deep value',
                },
              },
            },
          ],
        });

        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { 'level1.level2.level3': 'deep value' },
        });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.level1?.level2?.level3).toBe('deep value');
      });

      it('should handle non-existent nested paths', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { 'nonexistent.path': 'value' },
        });
        expect(results).toHaveLength(0);
      });

      // Complex Nested Operators Test
      it('should handle deeply nested logical operators', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {
            $and: [
              {
                $or: [{ category: 'electronics' }, { $and: [{ category: 'books' }, { price: { $lt: 30 } }] }],
              },
              {
                $not: {
                  $or: [{ active: false }, { price: { $gt: 100 } }],
                },
              },
            ],
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          // First condition: electronics OR (books AND price < 30)
          const firstCondition =
            result.metadata?.category === 'electronics' ||
            (result.metadata?.category === 'books' && result.metadata?.price < 30);

          // Second condition: NOT (active = false OR price > 100)
          const secondCondition = result.metadata?.active !== false && result.metadata?.price <= 100;

          expect(firstCondition && secondCondition).toBe(true);
        });
      });

      it('should handle multiple logical operators at root level', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {
            $and: [{ category: 'electronics' }],
            $or: [{ price: { $lt: 100 } }, { price: { $gt: 20 } }],
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
          expect(result.metadata?.price < 100 || result.metadata?.price > 20).toBe(true);
        });
      });

      it('should handle undefined filter', async () => {
        const results1 = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: undefined,
        });
        const results2 = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
        });
        expect(results1).toEqual(results2);
        expect(results1.length).toBeGreaterThan(0);
      });

      it('should handle empty object filter', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {},
        });
        const results2 = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
        });
        expect(results).toEqual(results2);
        expect(results.length).toBeGreaterThan(0);
      });

      it('should handle null filter', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: null,
        });
        const results2 = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
        });
        expect(results).toEqual(results2);
        expect(results.length).toBeGreaterThan(0);
      });
    });

    // Regex Operator Tests
    describe('Regex Operators', () => {
      it('should handle $regex with case sensitivity', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $regex: 'ELECTRONICS' } },
        });
        expect(results).toHaveLength(0);
      });

      it('should handle $regex with start anchor', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $regex: '^elect' } },
        });
        expect(results).toHaveLength(2);
      });

      it('should handle $regex with end anchor', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $regex: 'nics$' } },
        });
        expect(results).toHaveLength(2);
      });

      it('should handle dotall flag', async () => {
        await vectorDB.upsert({
          indexName,
          vectors: [[1, 0.1, 0]],
          metadata: [{ description: 'First\nSecond\nThird' }],
        });

        const withoutS = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { description: { $regex: 'First[^\\n]*Third' } },
        });
        expect(withoutS).toHaveLength(0);
      });
      it('should handle $not with $regex operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $not: { $regex: '^elect' } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).not.toMatch(/^elect/);
        });
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
