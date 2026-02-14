import { describe, it, expect, beforeAll, inject } from 'vitest';
import { MastraClient } from '@mastra/client-js';

export interface VectorTestConfig {
  testNameSuffix?: string;
  vectorName?: string;
}

export function createVectorTests(config: VectorTestConfig = {}) {
  const { testNameSuffix, vectorName = 'testVector' } = config;
  const suiteName = testNameSuffix
    ? `Vector Client JS E2E Tests (${testNameSuffix})`
    : 'Vector Client JS E2E Tests';

  let client: MastraClient;
  const indexName = `test_index_${Date.now()}`;

  describe(suiteName, () => {
    beforeAll(async () => {
      const baseUrl = inject('baseUrl');
      client = new MastraClient({ baseUrl, retries: 0 });
    });

    describe('createIndex and getIndexes', () => {
      it('should create a vector index', async () => {
        const vector = client.getVector(vectorName);
        const result = await vector.createIndex({
          indexName,
          dimension: 3,
          metric: 'cosine',
        });
        expect(result).toBeDefined();
      });

      it('should list indexes including the created one', async () => {
        const vector = client.getVector(vectorName);
        // Server returns string[] directly
        const result: any = await vector.getIndexes();
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result).toContain(indexName);
      });

      it('should get index details', async () => {
        const vector = client.getVector(vectorName);
        const details = await vector.details(indexName);
        expect(details).toBeDefined();
        expect(details.dimension).toBe(3);
        expect(details.metric).toBe('cosine');
      });
    });

    describe('upsert and query', () => {
      it('should upsert vectors', async () => {
        const vector = client.getVector(vectorName);
        // Server returns { ids: string[] }
        const result: any = await vector.upsert({
          indexName,
          vectors: [
            [1.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 1.0],
          ],
          metadata: [{ label: 'x-axis' }, { label: 'y-axis' }, { label: 'z-axis' }],
        });
        expect(result).toBeDefined();
        expect(result.ids).toBeDefined();
        expect(Array.isArray(result.ids)).toBe(true);
        expect(result.ids.length).toBe(3);
      });

      it('should query vectors and return closest matches', async () => {
        const vector = client.getVector(vectorName);
        // Server returns QueryResult[] directly
        const results: any = await vector.query({
          indexName,
          queryVector: [1.0, 0.0, 0.0],
          topK: 2,
        });
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBe(2);
        // The closest match should be the x-axis vector
        expect(results[0].metadata?.label).toBe('x-axis');
      });

      it('should query vectors with topK=1', async () => {
        const vector = client.getVector(vectorName);
        const results: any = await vector.query({
          indexName,
          queryVector: [0.0, 1.0, 0.0],
          topK: 1,
        });
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBe(1);
        expect(results[0].metadata?.label).toBe('y-axis');
      });
    });

    describe('deleteIndex', () => {
      it('should delete the vector index', async () => {
        const vector = client.getVector(vectorName);
        const result = await vector.delete(indexName);
        expect(result).toBeDefined();

        // Verify index is gone - server returns string[] directly
        const indexes: any = await vector.getIndexes();
        expect(Array.isArray(indexes)).toBe(true);
        expect(indexes).not.toContain(indexName);
      });
    });

    describe('error handling', () => {
      it('should throw for non-existent vector store', async () => {
        const vector = client.getVector('nonexistent-vector');
        await expect(vector.getIndexes()).rejects.toThrow();
      });
    });
  });
}

declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string;
    port: number;
  }
}
