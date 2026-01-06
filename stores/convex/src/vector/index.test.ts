import { createVectorTestSuite } from '@internal/storage-test-utils';
import dotenv from 'dotenv';
import { describe, it, vi } from 'vitest';

import { ConvexVector } from './index';

dotenv.config();

vi.setConfig({
  testTimeout: 180_000,
  hookTimeout: 180_000,
});

const deploymentUrl = process.env.CONVEX_TEST_URL;
const adminKey = process.env.CONVEX_TEST_ADMIN_KEY;
const storageFunction = process.env.CONVEX_TEST_STORAGE_FUNCTION;

if (!deploymentUrl || !adminKey) {
  describe.skip('ConvexVector', () => {
    it('requires CONVEX_TEST_URL and CONVEX_TEST_ADMIN_KEY to run integration tests', () => undefined);
  });
} else {
  const vector = new ConvexVector({
    id: 'convex-vector-test',
    deploymentUrl,
    adminAuthToken: adminKey,
    ...(storageFunction ? { storageFunction } : {}),
  });

  createVectorTestSuite({
    vector,
    createIndex: async indexName => {
      await vector.createIndex({ indexName, dimension: 1536 });
    },
    deleteIndex: async indexName => {
      try {
        await vector.deleteIndex({ indexName });
      } catch {
        // ignore
      }
    },
  });
}
