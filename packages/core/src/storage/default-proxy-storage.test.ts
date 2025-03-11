import { DefaultProxyStorage } from './defaultProxyStorage';
import { createTestSuite } from './test-utils/storage';

// Test database configuration
const TEST_DB_URL = 'file::memory:'; // Use in-memory SQLite for tests

createTestSuite(
  new DefaultProxyStorage({
    config: { url: TEST_DB_URL },
  }),
);
