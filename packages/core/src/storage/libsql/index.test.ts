import { createTestSuite } from '../test-utils/storage';

import { DefaultStorage } from './index';

// Test database configuration
const TEST_DB_URL = 'file::memory:'; // Use in-memory SQLite for tests

createTestSuite(
  new DefaultStorage({
    config: { url: TEST_DB_URL },
  }),
);
