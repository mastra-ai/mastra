import { createTestSuite } from '@internal/storage-test-utils';
import type { TestSuiteOptions } from '@internal/storage-test-utils';
import { vi } from 'vitest';
import { dsqlTests, TEST_CONFIG, canRunDSQLTests } from './test-utils';
import { DSQLStore } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

/**
 * Aurora DSQL specific test options.
 * These options skip tests that are not supported or may fail due to DSQL limitations:
 * - advancedOptions: DSQL doesn't support USING clause (non-btree index methods like brin, gin, hash, spgist)
 * - storageParameters: DSQL doesn't support WITH clause (fillfactor, etc.)
 *
 */
const DSQL_TEST_OPTIONS: TestSuiteOptions = {
  skipOperationsTests: {
    indexManagement: {
      advancedOptions: true,
      storageParameters: true,
    },
  },
};

// Run integration tests only when DSQL_HOST is set and DSQL_INTEGRATION=true
if (canRunDSQLTests()) {
  createTestSuite(new DSQLStore(TEST_CONFIG), DSQL_TEST_OPTIONS);
  dsqlTests();
}
