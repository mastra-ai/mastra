import { createTestSuite } from '@internal/storage-test-utils';
import { vi } from 'vitest';
import { LanceStorage } from './index';

// Increase timeout for all tests in this file to 30 seconds
vi.setConfig({ testTimeout: 200_000, hookTimeout: 200_000 });

const storage = await LanceStorage.create('lance-test-storage', 'LanceTestStorage', 'test');

createTestSuite(storage);
