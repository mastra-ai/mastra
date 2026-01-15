import { createVectorTestSuite } from '@internal/storage-test-utils';

import { LibSQLVector } from './index.js';

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
    await libSQLVectorDB.deleteIndex({ indexName });
  },
  disconnect: async () => {
    // LibSQL doesn't have a disconnect method, but we ensure cleanup
  },
  waitForIndexing: () => new Promise(resolve => setTimeout(resolve, 100)),
  testDomains: {
    // Disable large batch - libsql does individual INSERTs which is too slow
    largeBatch: false,
    // Disable concurrency - libsql with shared cache doesn't handle concurrent writes well
    concurrency: false,
  },
});
