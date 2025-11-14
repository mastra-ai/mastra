import { createTestSuite } from '@internal/storage-test-utils';
import { vi } from 'vitest';
import { UpstashStore } from './index';

// Increase timeout for all tests in this file to 30 seconds
vi.setConfig({ testTimeout: 200_000, hookTimeout: 200_000 });

createTestSuite(
  new UpstashStore({
    id: 'upstash-test-store',
    url: 'http://localhost:8079',
    token: 'test_token',
  }),
);
