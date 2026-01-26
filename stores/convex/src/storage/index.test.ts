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
import { ObservabilityConvex } from './domains/observability';
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

  // Observability domain integration tests (Issue #12079)
  describe('Observability Domain Integration (Issue #12079)', () => {
    it('should create and retrieve a span', async () => {
      const observabilityDomain = new ObservabilityConvex({ client: createTestClient() });
      await observabilityDomain.init();

      const traceId = `trace-create-${Date.now()}`;
      const spanId = `span-create-${Date.now()}`;

      try {
        await observabilityDomain.createSpan({
          span: {
            traceId,
            spanId,
            name: 'test-span',
            spanType: 'AGENT_RUN' as any,
            isEvent: false,
            startedAt: new Date(),
          },
        });

        const span = await observabilityDomain.getSpan({ traceId, spanId });
        expect(span).toBeDefined();
        expect(span?.span.name).toBe('test-span');
        expect(span?.span.traceId).toBe(traceId);
        expect(span?.span.spanId).toBe(spanId);
      } finally {
        await observabilityDomain.batchDeleteTraces({ traceIds: [traceId] });
      }
    });

    it('should get root span for a trace', async () => {
      const observabilityDomain = new ObservabilityConvex({ client: createTestClient() });
      await observabilityDomain.init();

      const traceId = `trace-root-${Date.now()}`;
      const rootSpanId = `span-root-${Date.now()}`;
      const childSpanId = `span-child-${Date.now()}`;

      try {
        // Create root span (no parentSpanId)
        await observabilityDomain.createSpan({
          span: {
            traceId,
            spanId: rootSpanId,
            name: 'root-span',
            spanType: 'WORKFLOW_RUN' as any,
            isEvent: false,
            startedAt: new Date(),
          },
        });

        // Create child span
        await observabilityDomain.createSpan({
          span: {
            traceId,
            spanId: childSpanId,
            parentSpanId: rootSpanId,
            name: 'child-span',
            spanType: 'AGENT_RUN' as any,
            isEvent: false,
            startedAt: new Date(),
          },
        });

        const rootSpan = await observabilityDomain.getRootSpan({ traceId });
        expect(rootSpan).toBeDefined();
        expect(rootSpan?.span.name).toBe('root-span');
        expect(rootSpan?.span.spanId).toBe(rootSpanId);
      } finally {
        await observabilityDomain.batchDeleteTraces({ traceIds: [traceId] });
      }
    });

    it('should get all spans for a trace', async () => {
      const observabilityDomain = new ObservabilityConvex({ client: createTestClient() });
      await observabilityDomain.init();

      const traceId = `trace-full-${Date.now()}`;

      try {
        // Create multiple spans
        await observabilityDomain.batchCreateSpans({
          records: [
            {
              traceId,
              spanId: `span-1-${Date.now()}`,
              name: 'span-1',
              spanType: 'WORKFLOW_RUN' as any,
              isEvent: false,
              startedAt: new Date(),
            },
            {
              traceId,
              spanId: `span-2-${Date.now()}`,
              name: 'span-2',
              spanType: 'AGENT_RUN' as any,
              isEvent: false,
              startedAt: new Date(),
            },
          ],
        });

        const trace = await observabilityDomain.getTrace({ traceId });
        expect(trace).toBeDefined();
        expect(trace?.spans.length).toBe(2);
        expect(trace?.traceId).toBe(traceId);
      } finally {
        await observabilityDomain.batchDeleteTraces({ traceIds: [traceId] });
      }
    });

    it('should update a span', async () => {
      const observabilityDomain = new ObservabilityConvex({ client: createTestClient() });
      await observabilityDomain.init();

      const traceId = `trace-update-${Date.now()}`;
      const spanId = `span-update-${Date.now()}`;

      try {
        await observabilityDomain.createSpan({
          span: {
            traceId,
            spanId,
            name: 'original-name',
            spanType: 'AGENT_RUN' as any,
            isEvent: false,
            startedAt: new Date(),
          },
        });

        await observabilityDomain.updateSpan({
          traceId,
          spanId,
          updates: {
            name: 'updated-name',
            endedAt: new Date(),
          },
        });

        const span = await observabilityDomain.getSpan({ traceId, spanId });
        expect(span?.span.name).toBe('updated-name');
        expect(span?.span.endedAt).toBeDefined();
      } finally {
        await observabilityDomain.batchDeleteTraces({ traceIds: [traceId] });
      }
    });

    it('should list traces with pagination', async () => {
      const observabilityDomain = new ObservabilityConvex({ client: createTestClient() });
      await observabilityDomain.init();

      const traceIds = [`trace-list-1-${Date.now()}`, `trace-list-2-${Date.now()}`];

      try {
        // Create root spans for two traces
        for (const traceId of traceIds) {
          await observabilityDomain.createSpan({
            span: {
              traceId,
              spanId: `span-root-${traceId}`,
              name: `root-${traceId}`,
              spanType: 'WORKFLOW_RUN' as any,
              isEvent: false,
              startedAt: new Date(),
            },
          });
        }

        const result = await observabilityDomain.listTraces({
          pagination: { page: 0, perPage: 10 },
        });

        expect(result.pagination).toBeDefined();
        expect(result.spans).toBeDefined();
        expect(result.spans.length).toBeGreaterThanOrEqual(2);
      } finally {
        await observabilityDomain.batchDeleteTraces({ traceIds });
      }
    });

    it('should allow using deployment config directly', async () => {
      const observabilityDomain = new ObservabilityConvex({
        deploymentUrl: deploymentUrl!,
        adminAuthToken: adminKey!,
        ...(storageFunction ? { storageFunction } : {}),
      });

      expect(observabilityDomain).toBeDefined();
      await observabilityDomain.init();
    });
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

  it('mastraSpansTable should include all fields from TABLE_SCHEMAS[TABLE_SPANS]', async () => {
    const { TABLE_SCHEMAS, TABLE_SPANS } = await import('@mastra/core/storage');
    const { mastraSpansTable } = await import('../schema');

    const coreSchema = TABLE_SCHEMAS[TABLE_SPANS];
    const coreFields = Object.keys(coreSchema);

    const convexValidator = (mastraSpansTable as any).validator;
    const convexFields = convexValidator ? Object.keys(convexValidator.fields || {}) : [];

    const missingFields = coreFields.filter(field => !convexFields.includes(field));

    expect(missingFields).toEqual([]);
  });
});

// Tests for GitHub Issue #12079: Observability domain support
// https://github.com/mastra-ai/mastra/issues/12079
describe('ConvexStore Observability Support (Issue #12079)', () => {
  it('should have observability domain available for trace persistence', async () => {
    const testStore = new ConvexStore({
      id: 'observability-test',
      deploymentUrl: 'https://test.convex.cloud',
      adminAuthToken: 'test-token',
    });

    const observability = await testStore.getStore('observability');
    expect(observability).toBeDefined();
    expect(observability).toBeInstanceOf(ObservabilityConvex);
  });

  it('should export mastraSpansTable from schema', async () => {
    const { TABLE_SPANS } = await import('@mastra/core/storage');
    const schemaExports = await import('../schema');

    expect(TABLE_SPANS).toBe('mastra_ai_spans');
    expect(schemaExports).toHaveProperty('mastraSpansTable');
    expect(schemaExports).toHaveProperty('TABLE_SPANS');
  });

  it('should export ObservabilityConvex domain class', async () => {
    const storageExports = await import('./index');
    expect(storageExports).toHaveProperty('ObservabilityConvex');
  });

  it('ObservabilityConvex should have correct tracing strategy', () => {
    const domain = new ObservabilityConvex({
      deploymentUrl: 'https://test.convex.cloud',
      adminAuthToken: 'test-token',
    });

    const strategy = domain.tracingStrategy;
    expect(strategy.preferred).toBe('batch-with-updates');
    expect(strategy.supported).toContain('batch-with-updates');
    expect(strategy.supported).toContain('insert-only');
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
