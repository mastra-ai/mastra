import { describe, it, expect } from '@jest/globals';
import dotenv from 'dotenv';

import { PineconeVector } from './';

dotenv.config();

const PINECONE_API_KEY = process.env.PINECONE_API_KEY!;

// if (!PINECONE_API_KEY) {
//   throw new Error('Please set PINECONE_API_KEY and PINECONE_ENVIRONMENT in .env file');
// }
// TODO: skip until we the secrets on Github
describe.skip('PineconeVector Integration Tests', () => {
  let pineconeVector: PineconeVector;
  const testIndexName = 'test-index-' + Date.now(); // Unique index name for each test run
  const dimension = 3;

  beforeAll(async () => {
    pineconeVector = new PineconeVector(PINECONE_API_KEY);
    // Create test index
    await pineconeVector.createIndex(testIndexName, dimension);
    // Wait for index to be ready
    await new Promise(resolve => setTimeout(resolve, 60000));
  }, 500000);

  afterAll(async () => {
    // Cleanup: delete test index
    await pineconeVector.deleteIndex(testIndexName);
  }, 500000);

  describe('Index Operations', () => {
    it('should list indexes including our test index', async () => {
      const indexes = await pineconeVector.listIndexes();
      expect(indexes).toContain(testIndexName);
    }, 500000);

    it('should describe index with correct properties', async () => {
      const stats = await pineconeVector.describeIndex(testIndexName);
      expect(stats.dimension).toBe(dimension);
      expect(stats.metric).toBe('cosine');
      expect(typeof stats.count).toBe('number');
    }, 500000);
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
      vectorIds = await pineconeVector.upsert(testIndexName, testVectors, testMetadata);
      expect(vectorIds).toHaveLength(3);
      // Wait for vectors to be indexed
      await new Promise(resolve => setTimeout(resolve, 5000));
    }, 500000);

    it.skip('should query vectors and return nearest neighbors', async () => {
      const queryVector = [1.0, 0.1, 0.1];
      const results = await pineconeVector.query(testIndexName, queryVector, 3);

      expect(results).toHaveLength(3);
      expect(results[0]!.score).toBeGreaterThan(0);
      expect(results[0]!.metadata).toBeDefined();
    }, 500000);

    it.skip('should query vectors with metadata filter', async () => {
      const queryVector = [0.0, 1.0, 0.0];
      const filter = { label: 'y-axis' };

      const results = await pineconeVector.query(testIndexName, queryVector, 1, filter);

      expect(results).toHaveLength(1);
      expect(results?.[0]?.metadata?.label).toBe('y-axis');
    }, 500000);

    it('should query vectors and return vectors in retsults', async () => {
      const queryVector = [0.0, 1.0, 0.0];
      const results = await pineconeVector.query(testIndexName, queryVector, 1, undefined, true);

      expect(results).toHaveLength(1);
      expect(results?.[0]?.vector).toBeDefined();
      expect(results?.[0]?.vector).toHaveLength(dimension);
    }, 500000);
  });

  describe('Error Handling', () => {
    it('should handle non-existent index query gracefully', async () => {
      const nonExistentIndex = 'non-existent-index';
      await expect(pineconeVector.query(nonExistentIndex, [1, 0, 0])).rejects.toThrow();
    }, 500000);

    it('should handle incorrect dimension vectors', async () => {
      const wrongDimVector = [[1, 0]]; // 2D vector for 3D index
      await expect(pineconeVector.upsert(testIndexName, wrongDimVector)).rejects.toThrow();
    }, 500000);
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
      const ids = await pineconeVector.upsert(testIndexName, vectors, metadata);
      const duration = Date.now() - start;

      expect(ids).toHaveLength(batchSize);
      console.log(`Batch upsert of ${batchSize} vectors took ${duration}ms`);
    }, 300000); // 5 minute timeout

    it('should perform multiple concurrent queries', async () => {
      const queryVector = [1, 0, 0];
      const numQueries = 10;

      const start = Date.now();
      const promises = Array(numQueries)
        .fill(null)
        .map(() => pineconeVector.query(testIndexName, queryVector));

      const results = await Promise.all(promises);
      const duration = Date.now() - start;

      expect(results).toHaveLength(numQueries);
      console.log(`${numQueries} concurrent queries took ${duration}ms`);
    }, 500000);
  });
});
