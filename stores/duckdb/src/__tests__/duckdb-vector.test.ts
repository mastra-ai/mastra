/**
 * DuckDB Vector Store Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DuckDBVector } from '../vector';
import type { DuckDBVectorConfig } from '../vector/types';
import {
  generateTestVectors,
  generateRandomVector,
  expectScoreOrder,
  measureTime,
  mockMetadata,
  TEST_DB_PATH,
} from './setup';

describe('DuckDBVector', () => {
  let vectorStore: DuckDBVector;

  beforeEach(() => {
    vectorStore = new DuckDBVector({
      path: ':memory:',
      dimensions: 512,
      metric: 'cosine',
    });
  });

  afterEach(async () => {
    if (vectorStore) {
      await vectorStore.close();
    }
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const store = new DuckDBVector();
      expect(store).toBeInstanceOf(DuckDBVector);
    });

    it('should initialize with custom configuration', () => {
      const config: DuckDBVectorConfig = {
        path: TEST_DB_PATH,
        dimensions: 1536,
        metric: 'euclidean',
        poolSize: 10,
        memoryLimit: '4GB',
        threads: 8,
      };

      const store = new DuckDBVector(config);
      expect(store).toBeInstanceOf(DuckDBVector);
    });

    it('should initialize in-memory database', () => {
      const store = new DuckDBVector({ path: ':memory:' });
      expect(store).toBeInstanceOf(DuckDBVector);
    });
  });

  describe('Index Management', () => {
    it('should create an index', async () => {
      await vectorStore.createIndex({
        indexName: 'test-index',
        dimension: 512,
        metric: 'cosine',
      });

      const indexes = await vectorStore.listIndexes();
      expect(indexes).toContain('test-index');
    });

    it('should fail to create duplicate index', async () => {
      await vectorStore.createIndex({
        indexName: 'test-index',
        dimension: 512,
      });

      await expect(
        vectorStore.createIndex({
          indexName: 'test-index',
          dimension: 512,
        }),
      ).rejects.toThrow('already exists');
    });

    it('should list all indexes', async () => {
      await vectorStore.createIndex({ indexName: 'index1', dimension: 512 });
      await vectorStore.createIndex({ indexName: 'index2', dimension: 256 });
      await vectorStore.createIndex({ indexName: 'index3', dimension: 1024 });

      const indexes = await vectorStore.listIndexes();
      expect(indexes).toHaveLength(3);
      expect(indexes).toEqual(['index1', 'index2', 'index3']);
    });

    it('should describe index statistics', async () => {
      await vectorStore.createIndex({
        indexName: 'test-index',
        dimension: 512,
        metric: 'cosine',
      });

      const vectors = generateTestVectors(100, 512);
      await vectorStore.upsert({
        indexName: 'test-index',
        vectors: vectors.map(v => v.values),
        ids: vectors.map(v => v.id),
        metadata: vectors.map(v => v.metadata),
      });

      const stats = await vectorStore.describeIndex({
        indexName: 'test-index',
      });

      expect(stats).toMatchObject({
        dimension: 512,
        count: 100,
        metric: 'cosine',
      });
    });

    it('should delete an index', async () => {
      await vectorStore.createIndex({ indexName: 'test-index', dimension: 512 });

      await vectorStore.deleteIndex({ indexName: 'test-index' });

      const indexes = await vectorStore.listIndexes();
      expect(indexes).not.toContain('test-index');
    });
  });

  describe('Vector Operations', () => {
    beforeEach(async () => {
      await vectorStore.createIndex({
        indexName: 'test-index',
        dimension: 512,
        metric: 'cosine',
      });
    });

    it('should upsert vectors', async () => {
      const testData = generateTestVectors(10, 512);

      const ids = await vectorStore.upsert({
        indexName: 'test-index',
        vectors: testData.map(v => v.values),
        ids: testData.map(v => v.id),
        metadata: testData.map(v => v.metadata),
      });

      expect(ids).toHaveLength(10);
      expect(ids).toEqual(testData.map(v => v.id));
    });

    it('should upsert vectors with namespace', async () => {
      const testData = generateTestVectors(5, 512);

      const ids = await vectorStore.upsert({
        indexName: 'test-index',
        vectors: testData.map(v => v.values),
        ids: testData.map(v => v.id),
        metadata: testData.map(v => ({ ...v.metadata, namespace: 'test-namespace' })),
      });

      expect(ids).toHaveLength(5);
    });

    it('should update existing vectors', async () => {
      const vector = {
        id: 'vec_1',
        values: generateRandomVector(512),
        metadata: { version: 1 },
      };

      await vectorStore.upsert({
        indexName: 'test-index',
        vectors: [vector.values],
        ids: [vector.id],
        metadata: [vector.metadata],
      });

      const updatedVector = {
        id: 'vec_1',
        values: generateRandomVector(512),
        metadata: { version: 2 },
      };

      await vectorStore.upsert({
        indexName: 'test-index',
        vectors: [updatedVector.values],
        ids: [updatedVector.id],
        metadata: [updatedVector.metadata],
      });

      const results = await vectorStore.query({
        indexName: 'test-index',
        queryVector: updatedVector.values,
        topK: 1,
        includeVector: false,
      });

      expect(results[0].metadata.version).toBe(2);
    });

    it('should query similar vectors', async () => {
      const vectors = generateTestVectors(100, 512);

      await vectorStore.upsert({
        indexName: 'test-index',
        vectors: vectors.map(v => v.values),
        ids: vectors.map(v => v.id),
        metadata: vectors.map(v => v.metadata),
      });

      const queryVector = vectors[0].values;
      const results = await vectorStore.query({
        indexName: 'test-index',
        queryVector,
        topK: 10,
      });

      expect(results).toHaveLength(10);
      expect(results[0].id).toBe(vectors[0].id);
      expectScoreOrder(results);
    });

    it('should query with metadata filters', async () => {
      const vectors = generateTestVectors(50, 512);

      await vectorStore.upsert({
        indexName: 'test-index',
        vectors: vectors.map(v => v.values),
        ids: vectors.map(v => v.id),
        metadata: vectors.map(v => v.metadata),
      });

      const results = await vectorStore.query({
        indexName: 'test-index',
        queryVector: generateRandomVector(512),
        topK: 10,
        filter: {
          metadata: {
            category: 'A',
          },
        },
      });

      results.forEach(result => {
        expect(result.metadata?.category).toBe('A');
      });
    });

    it('should query with complex filters', async () => {
      const vectors = generateTestVectors(100, 512);

      await vectorStore.upsert({
        indexName: 'test-index',
        vectors: vectors.map(v => v.values),
        ids: vectors.map(v => v.id),
        metadata: vectors.map(v => v.metadata),
      });

      const results = await vectorStore.query({
        indexName: 'test-index',
        queryVector: generateRandomVector(512),
        topK: 20,
        filter: {
          $and: [{ metadata: { category: { $in: ['A', 'B'] } } }, { metadata: { score: { $gte: 50 } } }],
        },
      });

      results.forEach(result => {
        expect(['A', 'B']).toContain(result.metadata?.category);
        expect(result.metadata?.score).toBeGreaterThanOrEqual(50);
      });
    });

    it('should update vector metadata', async () => {
      const vector = {
        id: 'vec_1',
        values: generateRandomVector(512),
        metadata: { original: true },
      };

      await vectorStore.upsert({
        indexName: 'test-index',
        vectors: [vector.values],
        ids: [vector.id],
        metadata: [vector.metadata],
      });

      await vectorStore.updateVector({
        indexName: 'test-index',
        id: 'vec_1',
        update: {
          metadata: { original: false, updated: true },
        },
      });

      const results = await vectorStore.query({
        indexName: 'test-index',
        queryVector: vector.values,
        topK: 1,
        includeVector: false,
      });

      expect(results[0].metadata).toMatchObject({
        original: false,
        updated: true,
      });
    });

    it('should delete vectors', async () => {
      const vectors = generateTestVectors(10, 512);

      await vectorStore.upsert({
        indexName: 'test-index',
        vectors: vectors.map(v => v.values),
        ids: vectors.map(v => v.id),
        metadata: vectors.map(v => v.metadata),
      });

      await vectorStore.deleteVector({
        indexName: 'test-index',
        id: ['vec_0', 'vec_1', 'vec_2'],
      });

      const stats = await vectorStore.describeIndex({
        indexName: 'test-index',
      });

      expect(stats.count).toBe(7);
    });
  });

  describe('Advanced Features', () => {
    beforeEach(async () => {
      await vectorStore.createIndex({
        indexName: 'test-index',
        dimension: 512,
        metric: 'cosine',
      });
    });

    it('should perform hybrid search', async () => {
      const vectors = generateTestVectors(50, 512);

      await vectorStore.upsert({
        indexName: 'test-index',
        vectors: vectors.map(v => v.values),
        ids: vectors.map(v => v.id),
        metadata: vectors.map(v => v.metadata),
      });

      const results = await vectorStore.hybridSearch('test-index', generateRandomVector(512), 'Test content', {
        vectorWeight: 0.7,
        topK: 10,
      });

      expect(results).toHaveLength(10);
      expectScoreOrder(results);
    });

    it('should import vectors from Parquet', async () => {
      // This would require a test Parquet file
      // Skipping for template
    });

    it('should handle batch operations efficiently', async () => {
      const vectors = generateTestVectors(1000, 512);

      const { time } = await measureTime(
        async () =>
          await vectorStore.upsert({
            indexName: 'test-index',
            vectors: vectors.map(v => v.values),
            ids: vectors.map(v => v.id),
            metadata: vectors.map(v => v.metadata),
          }),
        'Batch upsert 1000 vectors',
      );

      expect(time).toBeLessThan(8000); // Should complete within 8 seconds

      const stats = await vectorStore.describeIndex({
        indexName: 'test-index',
      });

      expect(stats.count).toBe(1000);
    });
  });

  describe('Different Metrics', () => {
    it('should support cosine similarity', async () => {
      const store = new DuckDBVector({
        path: ':memory:',
        dimensions: 128,
        metric: 'cosine',
      });

      await store.createIndex({
        indexName: 'cosine-index',
        dimension: 128,
        metric: 'cosine',
      });

      const vectors = generateTestVectors(20, 128);
      await store.upsert({
        indexName: 'cosine-index',
        vectors: vectors.map(v => v.values),
        ids: vectors.map(v => v.id),
        metadata: vectors.map(v => v.metadata),
      });

      const results = await store.query({
        indexName: 'cosine-index',
        queryVector: vectors[0].values,
        topK: 5,
      });

      expect(results[0].id).toBe(vectors[0].id);
      expect(results[0].score).toBeCloseTo(1, 2);

      await store.close();
    });

    it('should support euclidean distance', async () => {
      const store = new DuckDBVector({
        path: ':memory:',
        dimensions: 128,
        metric: 'euclidean',
      });

      await store.createIndex({
        indexName: 'euclidean-index',
        dimension: 128,
        metric: 'euclidean',
      });

      const vectors = generateTestVectors(20, 128);
      await store.upsert({
        indexName: 'euclidean-index',
        vectors: vectors.map(v => v.values),
        ids: vectors.map(v => v.id),
        metadata: vectors.map(v => v.metadata),
      });

      const results = await store.query({
        indexName: 'euclidean-index',
        queryVector: vectors[0].values,
        topK: 5,
      });

      expect(results[0].id).toBe(vectors[0].id);
      expect(results[0].score).toBeCloseTo(0, 2);

      await store.close();
    });

    it('should support dot product', async () => {
      const store = new DuckDBVector({
        path: ':memory:',
        dimensions: 128,
        metric: 'dot',
      });

      await store.createIndex({
        indexName: 'dot-index',
        dimension: 128,
        metric: 'dot',
      });

      const vectors = generateTestVectors(20, 128);
      await store.upsert({
        indexName: 'dot-index',
        vectors: vectors.map(v => v.values),
        ids: vectors.map(v => v.id),
        metadata: vectors.map(v => v.metadata),
      });

      const results = await store.query({
        indexName: 'dot-index',
        queryVector: vectors[0].values,
        topK: 5,
      });

      expect(results[0].id).toBe(vectors[0].id);
      expectScoreOrder(results);

      await store.close();
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid dimensions', async () => {
      await vectorStore.createIndex({
        indexName: 'test-index',
        dimension: 512,
      });

      const invalidVector = {
        id: 'invalid',
        values: generateRandomVector(256), // Wrong dimension
      };

      await expect(
        vectorStore.upsert({
          indexName: 'test-index',
          vectors: [invalidVector.values],
          ids: [invalidVector.id],
        }),
      ).rejects.toThrow('dimension mismatch');
    });

    it('should throw error for non-existent index', async () => {
      await expect(
        vectorStore.query({
          indexName: 'non-existent',
          queryVector: generateRandomVector(512),
        }),
      ).rejects.toThrow();
    });

    it('should handle empty query results gracefully', async () => {
      await vectorStore.createIndex({
        indexName: 'test-index',
        dimension: 512,
      });

      const results = await vectorStore.query({
        indexName: 'test-index',
        queryVector: generateRandomVector(512),
        topK: 10,
      });

      expect(results).toEqual([]);
    });
  });

  describe('Deposium Integration Scenarios', () => {
    it('should handle multi-space queries', async () => {
      await vectorStore.createIndex({
        indexName: 'deposium-index',
        dimension: 512,
        metric: 'cosine',
      });

      // Create vectors for different spaces
      const vectors = [];
      for (let space = 0; space < 3; space++) {
        for (let i = 0; i < 10; i++) {
          vectors.push({
            id: `space${space}_vec${i}`,
            values: generateRandomVector(512),
            metadata: {
              ...mockMetadata.deposium,
              space_id: `deposium_space_${space}`,
              document_id: `doc_${space}_${i}`,
            },
          });
        }
      }

      await vectorStore.upsert({
        indexName: 'deposium-index',
        vectors: vectors.map(v => v.values),
        ids: vectors.map(v => v.id),
        metadata: vectors.map(v => v.metadata),
      });

      // Query specific space
      const results = await vectorStore.query({
        indexName: 'deposium-index',
        queryVector: generateRandomVector(512),
        topK: 5,
        filter: {
          metadata: { space_id: 'deposium_space_1' },
        },
      });

      results.forEach(result => {
        expect(result.metadata?.space_id).toBe('deposium_space_1');
      });
    });

    it('should handle Ollama 512D embeddings', async () => {
      await vectorStore.createIndex({
        indexName: 'ollama-index',
        dimension: 512,
        metric: 'cosine',
      });

      // Simulate Ollama embeddings (normalized)
      const embeddings = generateTestVectors(50, 512).map(v => ({
        ...v,
        metadata: {
          ...v.metadata,
          model: 'ollama:llama2',
          dimension: 512,
        },
      }));

      await vectorStore.upsert({
        indexName: 'ollama-index',
        vectors: embeddings.map(v => v.values),
        ids: embeddings.map(v => v.id),
        metadata: embeddings.map(v => v.metadata),
      });

      const results = await vectorStore.query({
        indexName: 'ollama-index',
        queryVector: generateRandomVector(512),
        topK: 10,
      });

      expect(results).toHaveLength(10);
    });
  });
});
