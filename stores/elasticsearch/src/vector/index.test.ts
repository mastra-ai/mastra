// To setup an ElasticSearch server, run the docker compose file in the elasticsearch directory
import { createVectorTestSuite } from '@internal/storage-test-utils';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { ElasticSearchVector } from './index';

describe('ElasticSearchVector', () => {
  let vectorDB: ElasticSearchVector;
  const url = 'http://localhost:9200';

  beforeAll(async () => {
    // Initialize ElasticSearchVector
    vectorDB = new ElasticSearchVector({ url, id: 'elasticsearch-test' });
  });

  describe('Error Handling', () => {
    it('should handle duplicate index creation gracefully', async () => {
      const infoSpy = vi.spyOn(vectorDB['logger'], 'info');
      const warnSpy = vi.spyOn(vectorDB['logger'], 'warn');

      const duplicateIndexName = `duplicate-test-${Date.now()}`;
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
const elasticSearchVector = new ElasticSearchVector({
  url: 'http://localhost:9200',
  id: 'elasticsearch-shared-test',
});

createVectorTestSuite({
  vector: elasticSearchVector,
  createIndex: async (indexName, options) => {
    await elasticSearchVector.createIndex({ indexName, dimension: 1536, metric: options?.metric });
  },
  deleteIndex: async (indexName: string) => {
    await elasticSearchVector.deleteIndex({ indexName });
  },
  waitForIndexing: async () => {
    // ElasticSearch uses refresh: true for immediate visibility, but add small
    // buffer for test environment stability and potential replica sync
    await new Promise(resolve => setTimeout(resolve, 100));
  },
  supportsRegex: false,
  supportsContains: false,
  supportsNorOperator: false,
  supportsElemMatch: false,
  supportsSize: false,
  supportsEmptyLogicalOperators: false,
  // Elasticsearch doesn't support advanced $not patterns like field-level $not
  supportsAdvancedNotSyntax: false,
  // Cosine similarity doesn't support zero magnitude vectors (division by zero)
  supportsZeroVectors: false,
});
