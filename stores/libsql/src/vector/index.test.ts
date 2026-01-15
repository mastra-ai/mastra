import { createVectorTestSuite } from '@internal/storage-test-utils';
import { describe, beforeAll, it, expect } from 'vitest';

import { LibSQLVector } from './index.js';

// Shared vector store test suite
// LibSQL uses SQLite with in-memory database and shared cache
const libSQLVectorDB = new LibSQLVector({
  url: 'file::memory:?cache=shared',
  id: 'libsql-shared-test',
});

// Warmup the database connection before running the shared test suite
// This ensures the in-memory database is properly initialized
describe('LibSQLVector Setup', () => {
  beforeAll(async () => {
    // Create and immediately delete a test table to prime the connection
    const warmupIndex = '_libsql_warmup_test';
    console.log('[LIBSQL DEBUG] Warmup: Creating warmup index...');
    await libSQLVectorDB.createIndex({ indexName: warmupIndex, dimension: 3, metric: 'cosine' });
    console.log('[LIBSQL DEBUG] Warmup: Deleting warmup index...');
    await libSQLVectorDB.deleteIndex({ indexName: warmupIndex });
    console.log('[LIBSQL DEBUG] Warmup: Complete');
  });

  it('should initialize the database connection', () => {
    // This test exists to ensure the beforeAll warmup runs before the shared test suite
    expect(libSQLVectorDB).toBeDefined();
  });
});

createVectorTestSuite({
  vector: libSQLVectorDB,
  createIndex: async (indexName: string) => {
    console.log(`[LIBSQL DEBUG] createIndex called for: ${indexName}`);
    await libSQLVectorDB.createIndex({ indexName, dimension: 1536, metric: 'cosine' });
    console.log(`[LIBSQL DEBUG] createIndex completed for: ${indexName}`);
  },
  deleteIndex: async (indexName: string) => {
    console.log(`[LIBSQL DEBUG] deleteIndex called for: ${indexName}`);
    try {
      await libSQLVectorDB.deleteIndex({ indexName });
      console.log(`[LIBSQL DEBUG] deleteIndex completed for: ${indexName}`);
    } catch (error) {
      console.error(`[LIBSQL DEBUG] Error deleting index ${indexName}:`, error);
    }
  },
  disconnect: async () => {
    // LibSQL doesn't have a disconnect method, but we ensure cleanup
  },
  waitForIndexing: () => new Promise(resolve => setTimeout(resolve, 100)),
  testDomains: {
    // DEBUGGING: Enable domains one at a time to find interference
    // Round 1: filterOps only - PASSED
    // Round 2: filterOps + basicOps
    filterOps: true,
    basicOps: true,
    advancedOps: false,
    edgeCases: false,
    errorHandling: false,
    metadataFiltering: false,
    largeBatch: false,
  },
});
