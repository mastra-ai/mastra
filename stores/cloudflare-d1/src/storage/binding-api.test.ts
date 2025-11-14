import { createTestSuite } from '@internal/storage-test-utils';
import dotenv from 'dotenv';
import { Miniflare } from 'miniflare';
import { vi } from 'vitest';
import { D1Store } from '.';

dotenv.config();

// Increase timeout for all tests in this file
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

// Create a Miniflare instance with D1
const mf = new Miniflare({
  modules: true,
  script: 'export default {};',
  d1Databases: { TEST_DB: ':memory:' }, // Use in-memory SQLite for tests
});

// Get the D1 database from Miniflare
const d1Database = await mf.getD1Database('TEST_DB');

createTestSuite(
  new D1Store({
    id: 'd1-test-store',
    binding: d1Database,
    tablePrefix: 'test_',
  }),
);
