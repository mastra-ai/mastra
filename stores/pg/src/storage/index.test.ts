import { createTestSuite } from '@internal/storage-test-utils';
import { vi } from 'vitest';
import { pgTests, TEST_CONFIG } from './test-utils';
import { PostgresStore } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

createTestSuite(new PostgresStore(TEST_CONFIG));
createTestSuite(new PostgresStore({ ...TEST_CONFIG, schemaName: 'my_schema' }));

pgTests();
