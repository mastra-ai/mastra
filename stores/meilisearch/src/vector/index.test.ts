// To set up a Meilisearch server, run the docker-compose file in this directory:
//   docker compose up -d
import { createVectorTestSuite } from '@internal/storage-test-utils';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { MeilisearchVector } from './index';

const HOST = process.env.MEILISEARCH_HOST || 'http://localhost:7700';
const API_KEY = process.env.MEILISEARCH_API_KEY || 'masterKey';

describe('MeilisearchVector', () => {
  let vectorDB: MeilisearchVector;

  beforeAll(() => {
    vectorDB = new MeilisearchVector({ id: 'meilisearch-test', host: HOST, apiKey: API_KEY });
  });

  afterAll(async () => {
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
        await vectorDB.createIndex({ indexName: duplicateIndexName, dimension, metric: 'cosine' });

        // Same dimensions - should not throw
        await expect(
          vectorDB.createIndex({ indexName: duplicateIndexName, dimension, metric: 'cosine' }),
        ).resolves.not.toThrow();

        expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('already exists with'));

        // Different dimensions - should throw
        await expect(
          vectorDB.createIndex({ indexName: duplicateIndexName, dimension: dimension + 1, metric: 'cosine' }),
        ).rejects.toThrow(
          `Index "${duplicateIndexName}" already exists with ${dimension} dimensions, but ${dimension + 1} dimensions were requested`,
        );
      } finally {
        infoSpy.mockRestore();
        warnSpy.mockRestore();
        await vectorDB.deleteIndex({ indexName: duplicateIndexName });
      }
    }, 60000);

    it('should warn when a non-cosine metric is requested', async () => {
      const warnSpy = vi.spyOn(vectorDB['logger'], 'warn');
      const indexName = `metric-warn-test-${Date.now()}`;
      try {
        await vectorDB.createIndex({ indexName, dimension: 3, metric: 'euclidean' });
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('only supports cosine'));
        const stats = await vectorDB.describeIndex({ indexName });
        expect(stats.metric).toBe('cosine');
      } finally {
        warnSpy.mockRestore();
        await vectorDB.deleteIndex({ indexName });
      }
    }, 60000);
  });
});

// Shared vector store conformance suite.
const meilisearchVector = new MeilisearchVector({ id: 'meilisearch-shared-test', host: HOST, apiKey: API_KEY });

createVectorTestSuite({
  vector: meilisearchVector,
  createIndex: async (indexName, options) => {
    await meilisearchVector.createIndex({ indexName, dimension: 1536, metric: options?.metric });
  },
  deleteIndex: async (indexName: string) => {
    await meilisearchVector.deleteIndex({ indexName });
  },
  waitForIndexing: async () => {
    // Mutations already await their Meilisearch task (waitTask), so reads are
    // consistent. A tiny buffer keeps parity with other store suites.
    await new Promise(resolve => setTimeout(resolve, 50));
  },
  // --- Meilisearch capability profile ---
  // Genuinely unsupported domains:
  supportsRegex: false, // no regex filter
  supportsContains: false, // CONTAINS needs the experimental containsFilter flag
  supportsElemMatch: false, // no per-element object matching
  supportsSize: false, // no array-length filter
  // Cosine similarity rejects zero-magnitude vectors (division by zero).
  supportsZeroVectors: false,
});
