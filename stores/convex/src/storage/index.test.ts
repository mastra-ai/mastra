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

  createTestSuite(store, { listScoresBySpan: false });

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

// Schema sync tests - ensure Convex schema matches core TABLE_SCHEMAS
// This test verifies that the hardcoded schema in @mastra/convex/schema stays in sync
// with the canonical schema definitions in @mastra/core/storage
describe('Convex Schema Sync', () => {
  it('mastraThreadsTable should include all fields from TABLE_SCHEMAS[TABLE_THREADS]', async () => {
    // Import the core schema - this defines the canonical field list
    const { TABLE_SCHEMAS, TABLE_THREADS } = await import('@mastra/core/storage');
    // Import the Convex schema - this is what users actually use
    const { mastraThreadsTable } = await import('../schema');

    const coreThreadSchema = TABLE_SCHEMAS[TABLE_THREADS];
    const coreFields = Object.keys(coreThreadSchema);

    // Get the Convex table validator to check its fields
    // The validator is stored internally in the table definition
    const convexValidator = (mastraThreadsTable as any).validator;
    const convexFields = convexValidator ? Object.keys(convexValidator.fields || {}) : [];

    // Check that all core fields exist in Convex schema
    const missingFields = coreFields.filter(field => !convexFields.includes(field));

    expect(missingFields).toEqual([]);
  });

  it('mastraMessagesTable should include all fields from TABLE_SCHEMAS[TABLE_MESSAGES]', async () => {
    const { TABLE_SCHEMAS, TABLE_MESSAGES } = await import('@mastra/core/storage');
    const { mastraMessagesTable } = await import('../schema');

    const coreSchema = TABLE_SCHEMAS[TABLE_MESSAGES];
    const coreFields = Object.keys(coreSchema);

    const convexValidator = (mastraMessagesTable as any).validator;
    const convexFields = convexValidator ? Object.keys(convexValidator.fields || {}) : [];

    const missingFields = coreFields.filter(field => !convexFields.includes(field));

    expect(missingFields).toEqual([]);
  });

  it('mastraResourcesTable should include all fields from TABLE_SCHEMAS[TABLE_RESOURCES]', async () => {
    const { TABLE_SCHEMAS, TABLE_RESOURCES } = await import('@mastra/core/storage');
    const { mastraResourcesTable } = await import('../schema');

    const coreSchema = TABLE_SCHEMAS[TABLE_RESOURCES];
    const coreFields = Object.keys(coreSchema);

    const convexValidator = (mastraResourcesTable as any).validator;
    const convexFields = convexValidator ? Object.keys(convexValidator.fields || {}) : [];

    const missingFields = coreFields.filter(field => !convexFields.includes(field));

    expect(missingFields).toEqual([]);
  });
});

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
      description: 'deployment config with authToken (recommended for runtime)',
      config: { id: 'test-store', deploymentUrl: 'https://test.convex.cloud', authToken: 'jwt-token' },
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
      description: 'pre-configured client with authToken',
      config: {
        id: 'test-store',
        client: new ConvexAdminClient({ deploymentUrl: 'https://test.convex.cloud', authToken: 'jwt-token' }),
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
      expectedError: /Either adminAuthToken or authToken is required/,
    },
  ],
});
