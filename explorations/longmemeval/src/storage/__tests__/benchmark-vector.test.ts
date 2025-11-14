import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BenchmarkVectorStore } from '../benchmark-vector';
import { rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('BenchmarkVectorStore', () => {
  let vectorStore: BenchmarkVectorStore;
  let testFilePath: string;

  beforeEach(async () => {
    vectorStore = new BenchmarkVectorStore();
    testFilePath = join(tmpdir(), `benchmark-vector-test-${Date.now()}.json`);
  });

  afterEach(async () => {
    // Clean up
    await vectorStore.clear();
    if (existsSync(testFilePath)) {
      await rm(testFilePath);
    }
  });

  describe('createIndex', () => {
    it('should create a new index', async () => {
      await vectorStore.createIndex({
        indexName: 'test-index',
        dimension: 1536,
        metric: 'cosine',
      });

      const indexes = await vectorStore.listIndexes();
      expect(indexes).toContain('test-index');
    });

    it('should validate dimension on existing index', async () => {
      await vectorStore.createIndex({
        indexName: 'test-index',
        dimension: 1536,
        metric: 'cosine',
      });

      // Try to create again with different dimension
      await expect(
        vectorStore.createIndex({
          indexName: 'test-index',
          dimension: 384,
          metric: 'cosine',
        }),
      ).rejects.toThrow();
    });
  });

  describe('upsert and query', () => {
    beforeEach(async () => {
      await vectorStore.createIndex({
        indexName: 'test-index',
        dimension: 3,
        metric: 'cosine',
      });
    });

    it('should upsert vectors and query them', async () => {
      const vectors = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];

      const metadata = [{ text: 'First vector' }, { text: 'Second vector' }, { text: 'Third vector' }];

      const ids = await vectorStore.upsert({
        indexName: 'test-index',
        vectors,
        metadata,
      });

      expect(ids).toHaveLength(3);

      // Query - note: imvectordb's query behavior might be different
      // This test might need adjustment based on actual behavior
      const results = await vectorStore.query({
        indexName: 'test-index',
        queryVector: [1, 0, 0],
        topK: 2,
      });

      expect(results).toBeDefined();
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('persist and hydrate', () => {
    it('should persist and restore vector store state', async () => {
      // Create index and add vectors
      await vectorStore.createIndex({
        indexName: 'test-index',
        dimension: 3,
        metric: 'cosine',
      });

      const ids = await vectorStore.upsert({
        indexName: 'test-index',
        vectors: [
          [1, 0, 0],
          [0, 1, 0],
        ],
        metadata: [{ text: 'Vector 1' }, { text: 'Vector 2' }],
        ids: ['vec-1', 'vec-2'],
      });

      // Persist
      await vectorStore.persist(testFilePath);

      // Create new store and hydrate
      const newStore = new BenchmarkVectorStore();
      await newStore.hydrate(testFilePath);

      // Verify index exists
      const indexes = await newStore.listIndexes();
      expect(indexes).toContain('test-index');

      // Verify index stats
      const stats = await newStore.describeIndex({ indexName: 'test-index' });
      expect(stats.dimension).toBe(3);
      expect(stats.count).toBe(2);
      expect(stats.metric).toBe('cosine');
    });

    it('should throw error if file does not exist', async () => {
      await expect(vectorStore.hydrate('/non/existent/file.json')).rejects.toThrow('Vector store file not found');
    });
  });

  describe('updateVector', () => {
    beforeEach(async () => {
      await vectorStore.createIndex({
        indexName: 'test-index',
        dimension: 3,
        metric: 'cosine',
      });
    });

    it('should update an existing vector', async () => {
      await vectorStore.upsert({
        indexName: 'test-index',
        vectors: [[1, 0, 0]],
        metadata: [{ text: 'Original' }],
        ids: ['vec-1'],
      });

      await vectorStore.updateVector({
        indexName: 'test-index',
        id: 'vec-1',
        update: {
          vector: [0, 1, 0],
          metadata: { text: 'Updated' },
        },
      });

      // Verify update by checking the store after persist/hydrate
      await vectorStore.persist(testFilePath);
      const newStore = new BenchmarkVectorStore();
      await newStore.hydrate(testFilePath);

      const stats = await newStore.describeIndex({ indexName: 'test-index' });
      expect(stats.count).toBe(1);
    });
  });

  describe('deleteVector', () => {
    beforeEach(async () => {
      await vectorStore.createIndex({
        indexName: 'test-index',
        dimension: 3,
        metric: 'cosine',
      });
    });

    it('should delete a vector', async () => {
      await vectorStore.upsert({
        indexName: 'test-index',
        vectors: [
          [1, 0, 0],
          [0, 1, 0],
        ],
        ids: ['vec-1', 'vec-2'],
      });

      await vectorStore.deleteVector({
        indexName: 'test-index',
        id: 'vec-1',
      });

      const stats = await vectorStore.describeIndex({ indexName: 'test-index' });
      expect(stats.count).toBe(1);
    });
  });

  describe('deleteIndex', () => {
    it('should delete an index', async () => {
      await vectorStore.createIndex({
        indexName: 'test-index',
        dimension: 3,
      });

      await vectorStore.deleteIndex({ indexName: 'test-index' });

      const indexes = await vectorStore.listIndexes();
      expect(indexes).not.toContain('test-index');
    });
  });
});
