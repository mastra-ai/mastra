import { createVectorTestSuite } from '@internal/storage-test-utils';

import { LibSQLVector } from './index.js';

// Shared vector store test suite
// LibSQL uses SQLite with in-memory database and shared cache
const libSQLVectorDB = new LibSQLVector({
  url: 'file::memory:?cache=shared',
  id: 'libsql-shared-test',
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
