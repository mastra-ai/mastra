// To setup a Qdrant server, run:
// docker run -p 6333:6333 qdrant/qdrant
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { QdrantVector } from './index';

describe('QdrantVector', () => {
  let qdrant: QdrantVector;
  const testCollectionName = 'test-collection-' + Date.now();
  const dimension = 3;

  beforeAll(async () => {
    qdrant = new QdrantVector('http://localhost:6333/');
    await qdrant.createIndex(testCollectionName, dimension);
  });

  afterAll(async () => {
    await qdrant.deleteIndex(testCollectionName);
  }, 50000);

  describe('Index Operations', () => {
    it('should list collections including ours', async () => {
      const indexes = await qdrant.listIndexes();
      expect(indexes).toContain(testCollectionName);
    }, 50000);

    it('should describe index with correct properties', async () => {
      const stats = await qdrant.describeIndex(testCollectionName);
      expect(stats.dimension).toBe(dimension);
      expect(stats.metric).toBe('cosine');
      expect(typeof stats.count).toBe('number');
    }, 50000);
  });

  describe('Vector Operations', () => {
    const testVectors = [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0],
    ];
    const testMetadata = [{ label: 'x-axis' }, { label: 'y-axis' }, { label: 'z-axis' }];
    let vectorIds: string[];

    it('should upsert vectors with metadata', async () => {
      vectorIds = await qdrant.upsert(testCollectionName, testVectors, testMetadata);
      expect(vectorIds).toHaveLength(3);
    }, 50000);

    it('should query vectors and return nearest neighbors', async () => {
      const queryVector = [1.0, 0.1, 0.1];
      const results = await qdrant.query(testCollectionName, queryVector, 3);

      expect(results).toHaveLength(3);
      expect(results?.[0]?.score).toBeGreaterThan(0);
      expect(results?.[0]?.metadata).toBeDefined();
    }, 50000);

    it('should query vectors and return vector in results', async () => {
      const queryVector = [1.0, 0.1, 0.1];
      const results = await qdrant.query(testCollectionName, queryVector, 3, undefined, true);

      expect(results).toHaveLength(3);
      expect(results?.[0]?.vector).toBeDefined();
      expect(results?.[0]?.vector).toHaveLength(dimension);
    });

    it('should query vectors with metadata filter', async () => {
      const queryVector = [0.0, 1.0, 0.0];
      const filter = {
        must: [{ key: 'label', match: { value: 'y-axis' } }],
      };

      const results = await qdrant.query(testCollectionName, queryVector, 1, filter);

      expect(results).toHaveLength(1);
      expect(results?.[0]?.metadata?.label).toBe('y-axis');
    }, 50000);
  });

  describe('Error Handling', () => {
    it('should handle non-existent index query gracefully', async () => {
      const nonExistentIndex = 'non-existent-index';
      await expect(qdrant.query(nonExistentIndex, [1, 0, 0])).rejects.toThrow();
    }, 50000);

    it('should handle incorrect dimension vectors', async () => {
      const wrongDimVector = [[1, 0]]; // 2D vector for 3D index
      await expect(qdrant.upsert(testCollectionName, wrongDimVector)).rejects.toThrow();
    }, 50000);
  });

  describe('Performance Tests', () => {
    it('should handle batch upsert of 1000 vectors', async () => {
      const batchSize = 1000;
      const vectors = Array(batchSize)
        .fill(null)
        .map(() =>
          Array(dimension)
            .fill(null)
            .map(() => Math.random()),
        );
      const metadata = vectors.map((_, i) => ({ id: i }));

      const start = Date.now();
      const ids = await qdrant.upsert(testCollectionName, vectors, metadata);
      const duration = Date.now() - start;

      expect(ids).toHaveLength(batchSize);
      console.log(`Batch upsert of ${batchSize} vectors took ${duration}ms`);
    }, 300000);

    it('should perform multiple concurrent queries', async () => {
      const queryVector = [1, 0, 0];
      const numQueries = 10;

      const start = Date.now();
      const promises = Array(numQueries)
        .fill(null)
        .map(() => qdrant.query(testCollectionName, queryVector));

      const results = await Promise.all(promises);
      const duration = Date.now() - start;

      expect(results).toHaveLength(numQueries);
      console.log(`${numQueries} concurrent queries took ${duration}ms`);
    }, 50000);
  });
});
