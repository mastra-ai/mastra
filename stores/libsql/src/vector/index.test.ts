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
    try {
      await libSQLVectorDB.deleteIndex({ indexName });
    } catch {
      // Ignore cleanup errors
    }
  },
  waitForIndexing: async () => {},
  testDomains: {
    largeBatch: false,
  },
});
