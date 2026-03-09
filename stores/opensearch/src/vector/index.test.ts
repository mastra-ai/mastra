// To setup a Opensearch server, run the docker compose file in the opensearch directory
import { createVectorTestSuite } from '@internal/storage-test-utils';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { OpenSearchVector } from './index';

describe('OpenSearchVector', () => {
  let vectorDB: OpenSearchVector;
  const node = 'http://localhost:9200';

  beforeAll(async () => {
    // Initialize OpenSearchVector
    vectorDB = new OpenSearchVector({ node, id: 'opensearch-test' });
  });

  afterAll(async () => {
    // Clean up any remaining test indexes
    try {
      await vectorDB.deleteIndex({ indexName: 'duplicate-test' });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Error Handling', () => {
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

// Shared vector store test suite
const opensearchVector = new OpenSearchVector({ node: 'http://localhost:9200', id: 'opensearch-shared-test' });

createVectorTestSuite({
  vector: opensearchVector,
  createIndex: async (indexName, options) => {
    await opensearchVector.createIndex({ indexName, dimension: 1536, metric: options?.metric });
  },
  deleteIndex: async (indexName: string) => {
    await opensearchVector.deleteIndex({ indexName });
  },
  waitForIndexing: async () => {
    // OpenSearch indexes immediately with refresh: true
    await new Promise(resolve => setTimeout(resolve, 100));
  },
  supportsRegex: false,
  supportsContains: false,
  supportsNorOperator: false,
  supportsElemMatch: false,
  supportsSize: false,
  supportsEmptyLogicalOperators: false,
  // OpenSearch doesn't support advanced $not patterns like field-level $not
  supportsAdvancedNotSyntax: false,
});
