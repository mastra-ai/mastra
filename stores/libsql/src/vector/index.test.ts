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
    await libSQLVectorDB.createIndex({ indexName: warmupIndex, dimension: 3, metric: 'cosine' });
    await libSQLVectorDB.deleteIndex({ indexName: warmupIndex });
  });

  it('should initialize the database connection', () => {
    // This test exists to ensure the beforeAll warmup runs before the shared test suite
    expect(libSQLVectorDB).toBeDefined();
  });
});

createVectorTestSuite({
  vector: libSQLVectorDB,
  createIndex: async (indexName: string) => {
    await libSQLVectorDB.createIndex({ indexName, dimension: 1536, metric: 'cosine' });
  },
  deleteIndex: async (indexName: string) => {
    try {
      await libSQLVectorDB.deleteIndex({ indexName });
    } catch (error) {
      console.error(`Error deleting index ${indexName}:`, error);
    }
  },
  disconnect: async () => {
    // LibSQL doesn't have a disconnect method, but we ensure cleanup
  },
  waitForIndexing: () => new Promise(resolve => setTimeout(resolve, 100)),
  testDomains: {
    // Skip large batch tests - libsql does individual INSERTs in a loop
    // which is too slow for 1000+ vectors
    largeBatch: false,
  },
});
