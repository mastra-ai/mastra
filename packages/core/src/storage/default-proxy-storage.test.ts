import { DefaultProxyStorage } from './default-proxy-storage';
import { createTestSuite } from './test-utils/storage';

// Test database configuration
const TEST_DB_URL = 'file::memory:?cache=shared'; // Use in-memory SQLite for tests

createTestSuite(
  new DefaultProxyStorage({
    config: { url: TEST_DB_URL },
  }),
);
