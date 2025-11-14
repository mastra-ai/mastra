import { createTestSuite } from '@internal/storage-test-utils';
import { Mastra } from '@mastra/core/mastra';

import { LibSQLStore } from './index';

const TEST_DB_URL = 'file::memory:?cache=shared';

const libsql = new LibSQLStore({
  id: 'libsql-test-store',
  url: TEST_DB_URL,
});

const mastra = new Mastra({
  storage: libsql,
});

createTestSuite(mastra.getStorage()!);
