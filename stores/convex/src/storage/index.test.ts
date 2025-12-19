import {
  createTestSuite,
  createConfigValidationTests,
  createClientAcceptanceTests,
  createDomainDirectTests,
} from '@internal/storage-test-utils';
import dotenv from 'dotenv';
import { describe, expect, it, vi } from 'vitest';

import { ConvexAdminClient } from './client';
import { MemoryConvex } from './domains/memory';
import { ScoresConvex } from './domains/scores';
import { WorkflowsConvex } from './domains/workflows';
import { ConvexStore } from './index';

dotenv.config();

vi.setConfig({
  testTimeout: 180_000,
  hookTimeout: 180_000,
});

const deploymentUrl = process.env.CONVEX_TEST_URL;
const adminKey = process.env.CONVEX_TEST_ADMIN_KEY;
const storageFunction = process.env.CONVEX_TEST_STORAGE_FUNCTION;

// Helper to create a fresh client for each test
const createTestClient = () =>
  new ConvexAdminClient({
    deploymentUrl: deploymentUrl!,
    adminAuthToken: adminKey!,
    ...(storageFunction ? { storageFunction } : {}),
  });

if (!deploymentUrl || !adminKey) {
  describe.skip('ConvexStore', () => {
    it('requires CONVEX_TEST_URL and CONVEX_TEST_ADMIN_KEY to run integration tests', () => undefined);
  });
} else {
  const store = new ConvexStore({
    id: `convex-store-test`,
    deploymentUrl,
    adminAuthToken: adminKey,
    ...(storageFunction ? { storageFunction } : {}),
  });

  createTestSuite(store);

  // Pre-configured client acceptance tests
  createClientAcceptanceTests({
    storeName: 'ConvexStore',
    expectedStoreName: 'ConvexStore',
    createStoreWithClient: () =>
      new ConvexStore({
        id: 'convex-client-test',
        client: createTestClient(),
      }),
    createStoreWithClientAndOptions: () =>
      new ConvexStore({
        id: 'convex-client-opts-test',
        name: 'CustomConvexStore',
        client: createTestClient(),
      }),
  });

  // Domain-level pre-configured client tests
  createDomainDirectTests({
    storeName: 'Convex',
    createMemoryDomain: () => new MemoryConvex({ client: createTestClient() }),
    createWorkflowsDomain: () => new WorkflowsConvex({ client: createTestClient() }),
    createScoresDomain: () => new ScoresConvex({ client: createTestClient() }),
  });

  // Additional Convex-specific tests
  describe('Convex Domain with deployment config', () => {
    it('should allow domains to use deployment config directly', async () => {
      const memoryDomain = new MemoryConvex({
        deploymentUrl,
        adminAuthToken: adminKey,
        ...(storageFunction ? { storageFunction } : {}),
      });

      expect(memoryDomain).toBeDefined();
      await memoryDomain.init();

      const thread = {
        id: `thread-config-test-${Date.now()}`,
        resourceId: 'test-resource',
        title: 'Test Config Thread',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const savedThread = await memoryDomain.saveThread({ thread });
      expect(savedThread.id).toBe(thread.id);

      await memoryDomain.deleteThread({ threadId: thread.id });
    });
  });
}

// Configuration validation tests (run even without credentials)
createConfigValidationTests({
  storeName: 'ConvexStore',
  createStore: config => new ConvexStore(config as any),
  validConfigs: [
    {
      description: 'deployment config',
      config: { id: 'test-store', deploymentUrl: 'https://test.convex.cloud', adminAuthToken: 'test-token' },
    },
    {
      description: 'deployment config with storageFunction',
      config: {
        id: 'test-store',
        deploymentUrl: 'https://test.convex.cloud',
        adminAuthToken: 'test-token',
        storageFunction: 'custom/storage:handle',
      },
    },
    {
      description: 'pre-configured client',
      config: {
        id: 'test-store',
        client: new ConvexAdminClient({ deploymentUrl: 'https://test.convex.cloud', adminAuthToken: 'test-token' }),
      },
    },
    {
      description: 'client with custom name',
      config: {
        id: 'test-store',
        name: 'CustomConvexStore',
        client: new ConvexAdminClient({ deploymentUrl: 'https://test.convex.cloud', adminAuthToken: 'test-token' }),
      },
    },
    {
      description: 'disableInit with deployment config',
      config: {
        id: 'test-store',
        deploymentUrl: 'https://test.convex.cloud',
        adminAuthToken: 'test-token',
        disableInit: true,
      },
    },
    {
      description: 'disableInit with client config',
      config: {
        id: 'test-store',
        client: new ConvexAdminClient({ deploymentUrl: 'https://test.convex.cloud', adminAuthToken: 'test-token' }),
        disableInit: true,
      },
    },
  ],
  invalidConfigs: [
    {
      description: 'empty deploymentUrl',
      config: { id: 'test-store', deploymentUrl: '', adminAuthToken: 'test-token' },
      expectedError: /deploymentUrl is required/,
    },
    {
      description: 'empty adminAuthToken',
      config: { id: 'test-store', deploymentUrl: 'https://test.convex.cloud', adminAuthToken: '' },
      expectedError: /adminAuthToken is required/,
    },
  ],
});
