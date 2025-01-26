import { expect, describe, it, beforeEach, afterEach } from 'vitest';

import { LibSQLVector } from './index.js';

describe('LibSQLVector', () => {
  let vector: LibSQLVector;
  const testIndexName = 'test_vectors';
  const dimension = 3;

  beforeEach(async () => {
    // Use in-memory SQLite database for testing
    vector = new LibSQLVector('file::memory:?cache=shared');
    await vector.createIndex(testIndexName, dimension);
  });

  afterEach(async () => {
    await vector.deleteIndex(testIndexName);
  });

  describe('createIndex', () => {
    it('should create a new vector index', async () => {
      const newIndexName = 'new_test_vectors';
      await vector.createIndex(newIndexName, dimension);

      const indexes = await vector.listIndexes();
      expect(indexes).toContain(newIndexName);

      await vector.deleteIndex(newIndexName);
    });

    it('should throw error for invalid index name', async () => {
      await expect(vector.createIndex('invalid-name', dimension)).rejects.toThrow();
    });

    it('should throw error for invalid dimension', async () => {
      await expect(vector.createIndex('test_vectors', -1)).rejects.toThrow();
    });
  });

  describe('upsert and query', () => {
    it('should insert and retrieve vectors', async () => {
      const vectors = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];
      const metadata = [{ label: 'x-axis' }, { label: 'y-axis' }, { label: 'z-axis' }];

      const ids = await vector.upsert(testIndexName, vectors, metadata);
      expect(ids).toHaveLength(3);

      const queryVector = [1, 0, 0];
      const results = await vector.query(testIndexName, queryVector, 3);

      expect(results).toHaveLength(3);
      expect(results[0].score).toBeCloseTo(1, 5);
      expect(results[0].metadata).toEqual({ label: 'x-axis' });
    });

    it('should update existing vectors', async () => {
      const initialVector = [[1, 0, 0]];
      const initialMetadata = [{ label: 'initial' }];

      const [id] = await vector.upsert(testIndexName, initialVector, initialMetadata);

      const updatedVector = [[0, 1, 0]];
      const updatedMetadata = [{ label: 'updated' }];

      await vector.upsert(testIndexName, updatedVector, updatedMetadata, [id]);

      const results = await vector.query(testIndexName, [0, 1, 0], 1);
      expect(results[0].metadata).toEqual({ label: 'updated' });
      expect(results[0].score).toBeCloseTo(1, 5);
    });

    it('should filter results based on metadata', async () => {
      const vectors = [
        [1, 0, 0],
        [0.9, 0.1, 0],
        [0.8, 0.2, 0],
      ];
      const metadata = [{ category: 'A' }, { category: 'B' }, { category: 'A' }];

      await vector.upsert(testIndexName, vectors, metadata);

      const results = await vector.query(testIndexName, [1, 0, 0], 10, { category: 'A' });

      expect(results).toHaveLength(2);
      expect(results.every(r => r?.metadata?.category === 'A')).toBe(true);
    });
  });

  describe('deleteIndex', () => {
    it('should delete an existing index', async () => {
      const newIndexName = 'index_to_delete';
      await vector.createIndex(newIndexName, dimension);

      await vector.deleteIndex(newIndexName);

      const indexes = await vector.listIndexes();
      expect(indexes).not.toContain(newIndexName);
    });
  });

  describe('describeIndex', () => {
    it('should return correct index statistics', async () => {
      const vectors = [
        [1, 0, 0],
        [0, 1, 0],
      ];
      await vector.upsert(testIndexName, vectors);

      const stats = await vector.describeIndex(testIndexName);

      expect(stats.dimension).toBe(dimension);
      expect(stats.count).toBe(2);
      expect(stats.metric).toBe('cosine');
    });

    it('should throw error for non-existent index', async () => {
      await expect(vector.describeIndex('non_existent')).rejects.toThrow();
    });
  });

  describe('listIndexes', () => {
    it('should list all vector indexes', async () => {
      const indexes = await vector.listIndexes();
      expect(indexes).toContain(testIndexName);
    });
  });
});
