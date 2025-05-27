import { createTestSuite } from '@internal/storage-test-utils';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from './index';

// Test database configuration
const TEST_DB_URL = 'file::memory:?cache=shared'; // Use in-memory SQLite for tests

const mastra = new Mastra({
  storage: new LibSQLStore({
    url: TEST_DB_URL,
  }),
});

createTestSuite(mastra.getStorage()!);
