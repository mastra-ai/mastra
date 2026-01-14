import { createVectorTestSuite } from '@internal/storage-test-utils';
import { vi, describe, it, expect, beforeAll, afterAll, test } from 'vitest';
import { S3Vectors } from './';

// ====== Vitest timeouts: keep generous but tests should run faster without manual waits ======
vi.setConfig({ testTimeout: 300000, hookTimeout: 300000 });

// ====== Runtime config (bucket & region) ======
const vectorBucketName = process.env.S3_VECTORS_BUCKET_NAME;
const region = process.env.AWS_REGION || process.env.S3_VECTORS_REGION;
const runIntegrationTests = !!vectorBucketName && vectorBucketName.trim() !== '' && !!region && region.trim() !== '';

// Helper to construct S3Vectors
function makeVector() {
  if (!vectorBucketName) {
    throw new Error('Set S3_VECTORS_BUCKET_NAME environment variable.');
  }
  return new S3Vectors({
    vectorBucketName,
    clientConfig: region ? { region } : undefined,
  });
}

// ====== Simplified helpers ======

// Create index (no polling)
async function createIndex(vectorDB: S3Vectors, indexName: string, dimension: number, metric: 'cosine' | 'euclidean') {
  await vectorDB.createIndex({ indexName, dimension, metric });
}

// Delete index (best-effort, no polling)
async function deleteIndex(vectorDB: S3Vectors, indexName: string) {
  try {
    await vectorDB.deleteIndex({ indexName });
  } catch {
    // already deleted is fine
  }
}

// ====== Tests ======
(runIntegrationTests ? describe : describe.skip)('S3Vectors Integration Tests', () => {
  let vectorDB: S3Vectors;

  beforeAll(async () => {
    vectorDB = makeVector();
    await vectorDB.connect();
  }, 500000);

  afterAll(async () => {
    await vectorDB.disconnect();
  });

  describe('Index operations (S3 specific)', () => {
    it('normalizes index names: "_" -> "-" and lowercases', async () => {
      const raw = 'My_Index';
      const normalized = 'my-index';
      try {
        await createIndex(vectorDB, raw, 4, 'cosine');
        const names = await vectorDB.listIndexes();
        expect(names).toContain(normalized);
      } finally {
        await deleteIndex(vectorDB, raw); // delete accepts raw; impl normalizes internally
        await deleteIndex(vectorDB, normalized); // in case caller normalizes first
      }
    });

    it('duplicate createIndex: same dimension is a no-op; different metric call is ignored and does not mutate the existing index', async () => {
      const idx = `dup-${Date.now()}`;
      try {
        // 1) Initial creation (cosine)
        await createIndex(vectorDB, idx, 4, 'cosine');

        // 2) Same parameters -> should not throw (no-op)
        await expect(createIndex(vectorDB, idx, 4, 'cosine')).resolves.not.toThrow();

        // 3) Different metric -> should not throw (treated as no-op); existing index must remain unchanged
        await expect(createIndex(vectorDB, idx, 4, 'euclidean')).resolves.not.toThrow();

        // Verify the existing index preserves the original metric
        const stats = await vectorDB.describeIndex({ indexName: idx });
        expect(stats.dimension).toBe(4);
        expect(stats.metric).toBe('cosine'); // unchanged
      } finally {
        await deleteIndex(vectorDB, idx);
      }
    });
  });
});

// ====== Shared test suite (factory pattern) ======
// Run only when integration env is present; otherwise register a skipped suite for visibility.
if (runIntegrationTests) {
  const s3Vector = makeVector();

  createVectorTestSuite({
    vector: s3Vector,
    connect: async () => {
      await s3Vector.connect();
    },
    disconnect: async () => {
      await s3Vector.disconnect();
    },
    createIndex: async (indexName: string) => {
      await s3Vector.createIndex({ indexName, dimension: 4, metric: 'cosine' });
    },
    deleteIndex: async (indexName: string) => {
      try {
        await s3Vector.deleteIndex({ indexName });
      } catch (error) {
        console.error(`Error deleting index ${indexName}:`, error);
      }
    },
    // Strong consistency: no indexing wait needed
    waitForIndexing: async () => {},
  });
} else {
  // Register a skipped suite so test reporters show *why* this part didn’t run.
  describe.skip('S3Vectors – Shared vector test suite', () => {
    it('skipped: integration env vars not set (S3_VECTORS_BUCKET_NAME / AWS_REGION)', () => {
      // no-op
    });
  });
}
