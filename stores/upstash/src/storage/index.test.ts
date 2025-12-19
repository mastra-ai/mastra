import {
  createTestSuite,
  createConfigValidationTests,
  createClientAcceptanceTests,
  createDomainDirectTests,
} from '@internal/storage-test-utils';
import { Redis } from '@upstash/redis';
import { describe, expect, it, vi } from 'vitest';

import { StoreMemoryUpstash } from './domains/memory';
import { StoreScoresUpstash } from './domains/scores';
import { StoreWorkflowsUpstash } from './domains/workflows';
import { UpstashStore } from './index';

vi.setConfig({ testTimeout: 200_000, hookTimeout: 200_000 });

const TEST_CONFIG = {
  url: 'http://localhost:8079',
  token: 'test_token',
};

// Helper to create a fresh client for each test
const createTestClient = () =>
  new Redis({
    url: TEST_CONFIG.url,
    token: TEST_CONFIG.token,
  });

createTestSuite(
  new UpstashStore({
    id: 'upstash-test-store',
    ...TEST_CONFIG,
  }),
);

// Configuration validation tests
createConfigValidationTests({
  storeName: 'UpstashStore',
  createStore: config => new UpstashStore(config as any),
  validConfigs: [
    {
      description: 'URL/token config',
      config: { id: 'test-store', url: 'http://localhost:8079', token: 'test-token' },
    },
    { description: 'pre-configured client', config: { id: 'test-store', client: createTestClient() } },
    {
      description: 'disableInit with URL config',
      config: { id: 'test-store', url: 'http://localhost:8079', token: 'test-token', disableInit: true },
    },
    {
      description: 'disableInit with client config',
      config: { id: 'test-store', client: createTestClient(), disableInit: true },
    },
  ],
  invalidConfigs: [
    {
      description: 'empty url',
      config: { id: 'test-store', url: '', token: 'test-token' },
      expectedError: /url is required/i,
    },
    {
      description: 'empty token',
      config: { id: 'test-store', url: 'http://localhost:8079', token: '' },
      expectedError: /token is required/i,
    },
  ],
});

// Pre-configured client acceptance tests
createClientAcceptanceTests({
  storeName: 'UpstashStore',
  expectedStoreName: 'Upstash',
  createStoreWithClient: () =>
    new UpstashStore({
      id: 'upstash-client-test',
      client: createTestClient(),
    }),
});

// Domain-level pre-configured client tests
createDomainDirectTests({
  storeName: 'Upstash',
  createMemoryDomain: () => new StoreMemoryUpstash({ client: createTestClient() }),
  createWorkflowsDomain: () => new StoreWorkflowsUpstash({ client: createTestClient() }),
  createScoresDomain: () => new StoreScoresUpstash({ client: createTestClient() }),
});

// Additional Upstash-specific tests
describe('Upstash Domain with URL/token config', () => {
  it('should allow domains to use url/token config directly', async () => {
    const memoryDomain = new StoreMemoryUpstash({
      url: TEST_CONFIG.url,
      token: TEST_CONFIG.token,
    });

    expect(memoryDomain).toBeDefined();
    await memoryDomain.init();

    const thread = {
      id: `thread-url-test-${Date.now()}`,
      resourceId: 'test-resource',
      title: 'Test URL Thread',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const savedThread = await memoryDomain.saveThread({ thread });
    expect(savedThread.id).toBe(thread.id);

    await memoryDomain.deleteThread({ threadId: thread.id });
  });
});
