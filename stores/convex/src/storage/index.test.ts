import {
  createTestSuite,
  createConfigValidationTests,
  createClientAcceptanceTests,
  createDomainDirectTests,
} from '@internal/storage-test-utils';
import { TABLE_MESSAGES } from '@mastra/core/storage';
import dotenv from 'dotenv';
import { describe, expect, it, vi } from 'vitest';

import { ConvexAdminClient } from './client';
import { ConvexDB } from './db';
import { ChannelsConvex } from './domains/channels';
import { MemoryConvex } from './domains/memory';
import { SchedulesConvex } from './domains/schedules';
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

  // Issue #12318: mastra_workflow_snapshots index references missing id field
  // The Convex schema defines an index 'by_record_id' on ['id'] for the workflow snapshots table.
  // The core TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT] uses a composite key (workflow_name, run_id)
  // and doesn't include an 'id' field. The Convex adapter adds 'id' explicitly to support the index,
  // and generates the id value at runtime as `${workflow_name}-${run_id}` in normalizeRecord().
  it('mastraWorkflowSnapshotsTable should include id field for by_record_id index', async () => {
    const { mastraWorkflowSnapshotsTable } = await import('../schema');

    // Verify the Convex table includes the id field (added explicitly in schema.ts)
    const convexValidator = (mastraWorkflowSnapshotsTable as any).validator;
    const convexFields = convexValidator ? Object.keys(convexValidator.fields || {}) : [];
    expect(convexFields).toContain('id');
  });

  it('mastraSchedulesTable should include scheduler state fields', async () => {
    const { mastraSchedulesTable } = await import('../schema');

    const convexValidator = (mastraSchedulesTable as any).validator;
    const convexFields = convexValidator ? Object.keys(convexValidator.fields || {}) : [];

    expect(convexFields).toEqual(
      expect.arrayContaining([
        'id',
        'target',
        'cron',
        'status',
        'next_fire_at',
        'last_fire_at',
        'last_run_id',
        'created_at',
        'updated_at',
        'workflow_id',
      ]),
    );

    const indexes = ((mastraSchedulesTable as any).indexes ?? []).map(
      (index: { indexDescriptor: string; fields: string[] }) => [index.indexDescriptor, index.fields],
    );
    expect(indexes).toEqual(
      expect.arrayContaining([
        ['by_workflow_status', ['workflow_id', 'status']],
        ['by_workflow_id', ['workflow_id']],
        ['by_owner_id', ['owner_id']],
      ]),
    );
  });

  it('mastraScheduleTriggersTable should include trigger history fields', async () => {
    const { mastraScheduleTriggersTable } = await import('../schema');

    const convexValidator = (mastraScheduleTriggersTable as any).validator;
    const convexFields = convexValidator ? Object.keys(convexValidator.fields || {}) : [];

    expect(convexFields).toEqual(
      expect.arrayContaining([
        'id',
        'schedule_id',
        'run_id',
        'scheduled_fire_at',
        'actual_fire_at',
        'outcome',
        'trigger_kind',
      ]),
    );
  });

  it('server entrypoint should re-export scheduler schema helpers', async () => {
    const serverExports = await import('../server');

    expect(serverExports.mastraSchedulesTable).toBeDefined();
    expect(serverExports.mastraScheduleTriggersTable).toBeDefined();
    expect(serverExports.TABLE_SCHEDULES).toBe('mastra_schedules');
    expect(serverExports.TABLE_SCHEDULE_TRIGGERS).toBe('mastra_schedule_triggers');
  });

  it('mastraChannelInstallationsTable should include channel installation fields and indexes', async () => {
    const { mastraChannelInstallationsTable } = await import('../schema');

    const convexValidator = (mastraChannelInstallationsTable as any).validator;
    const convexFields = convexValidator ? Object.keys(convexValidator.fields || {}) : [];

    expect(convexFields).toEqual(
      expect.arrayContaining([
        'id',
        'platform',
        'agentId',
        'status',
        'webhookId',
        'data',
        'configHash',
        'error',
        'createdAt',
        'updatedAt',
      ]),
    );

    const indexes = ((mastraChannelInstallationsTable as any).indexes ?? []).map(
      (index: { indexDescriptor: string; fields: string[] }) => [index.indexDescriptor, index.fields],
    );
    expect(indexes).toEqual(
      expect.arrayContaining([
        ['by_webhook', ['webhookId']],
        ['by_platform_agent', ['platform', 'agentId']],
        ['by_platform', ['platform']],
      ]),
    );
  });

  it('mastraChannelConfigTable should include platform config fields and indexes', async () => {
    const { mastraChannelConfigTable } = await import('../schema');

    const convexValidator = (mastraChannelConfigTable as any).validator;
    const convexFields = convexValidator ? Object.keys(convexValidator.fields || {}) : [];

    expect(convexFields).toEqual(expect.arrayContaining(['id', 'platform', 'data', 'updatedAt']));

    const indexes = ((mastraChannelConfigTable as any).indexes ?? []).map(
      (index: { indexDescriptor: string; fields: string[] }) => [index.indexDescriptor, index.fields],
    );
    expect(indexes).toEqual(expect.arrayContaining([['by_platform', ['platform']]]));
  });

  it('mastraBackgroundTasksTable should include background task fields and indexes', async () => {
    const { TABLE_BACKGROUND_TASKS, TABLE_SCHEMAS } = await import('@mastra/core/storage');
    const { mastraBackgroundTasksTable } = await import('../schema');

    const coreSchema = TABLE_SCHEMAS[TABLE_BACKGROUND_TASKS];
    const coreFields = Object.keys(coreSchema);

    const convexValidator = (mastraBackgroundTasksTable as any).validator;
    const convexFields = convexValidator ? Object.keys(convexValidator.fields || {}) : [];

    const missingFields = coreFields.filter(field => !convexFields.includes(field));

    expect(missingFields).toEqual([]);

    const indexes = ((mastraBackgroundTasksTable as any).indexes ?? []).map(
      (index: { indexDescriptor: string; fields: string[] }) => [index.indexDescriptor, index.fields],
    );
    expect(indexes).toEqual(
      expect.arrayContaining([
        ['by_record_id', ['id']],
        ['by_agent_status', ['agent_id', 'status']],
        ['by_status_created', ['status', 'createdAt']],
        ['by_resource', ['resource_id']],
      ]),
    );
  });

  it('server entrypoint should re-export channel schema helpers', async () => {
    const serverExports = await import('../server');

    expect(serverExports.mastraChannelInstallationsTable).toBeDefined();
    expect(serverExports.mastraChannelConfigTable).toBeDefined();
    expect(serverExports.TABLE_CHANNEL_INSTALLATIONS).toBe('mastra_channel_installations');
    expect(serverExports.TABLE_CHANNEL_CONFIG).toBe('mastra_channel_config');
  });

  it('server entrypoint should re-export background task schema helpers', async () => {
    const serverExports = await import('../server');

    expect(serverExports.mastraBackgroundTasksTable).toBeDefined();
    expect(serverExports.TABLE_BACKGROUND_TASKS).toBe('mastra_background_tasks');
  });

  it('cache tables should include indexes used by ConvexServerCache', async () => {
    const { mastraCacheTable, mastraCacheListItemsTable } = await import('../schema');
    const normalizeIndexes = (indexes: any[]) =>
      indexes.map(index =>
        Array.isArray(index) ? index : [index.indexDescriptor ?? index.name, index.fields ?? index.indexFields],
      );

    const cacheIndexes = normalizeIndexes((mastraCacheTable as any).indexes ?? []);
    expect(cacheIndexes).toEqual(
      expect.arrayContaining([
        ['by_key', ['key']],
        ['by_key_prefix', ['keyPrefix']],
      ]),
    );

    const listIndexes = normalizeIndexes((mastraCacheListItemsTable as any).indexes ?? []);
    expect(listIndexes).toEqual(
      expect.arrayContaining([
        ['by_key_prefix', ['keyPrefix']],
        ['by_key_index', ['key', 'index']],
      ]),
    );
  });
});

describe('ConvexStore domains', () => {
  it('exposes channels storage for channel provider support', async () => {
    const store = new ConvexStore({
      id: 'convex-domain-test',
      deploymentUrl: 'https://test.convex.cloud',
      adminAuthToken: 'test-token',
    });

    expect(store.stores.channels).toBeInstanceOf(ChannelsConvex);
  });

  it('exposes schedules storage for workflow scheduler support', async () => {
    const store = new ConvexStore({
      id: 'convex-domain-test',
      deploymentUrl: 'https://test.convex.cloud',
      adminAuthToken: 'test-token',
    });

    expect(store.stores.schedules).toBeInstanceOf(SchedulesConvex);
  });
});

describe('ConvexDB schedule operations', () => {
  it('requires schedule ids before normalizing records', async () => {
    const callStorage = vi.fn();
    const db = new ConvexDB({ callStorage } as unknown as ConvexAdminClient);

    await expect(db.createSchedule({ cron: '* * * * *' })).rejects.toThrow('Schedule is missing an id');

    expect(callStorage).not.toHaveBeenCalled();
  });

  it('requires schedule trigger ids before normalizing records', async () => {
    const callStorage = vi.fn();
    const db = new ConvexDB({ callStorage } as unknown as ConvexAdminClient);

    await expect(db.recordScheduleTrigger({ schedule_id: 'schedule-1' })).rejects.toThrow(
      'Schedule trigger is missing an id',
    );

    expect(callStorage).not.toHaveBeenCalled();
  });
});

describe('ConvexDB loadMany', () => {
  it('dedupes and chunks ids before calling storage', async () => {
    const callStorage = vi.fn(async request => request.ids.map((id: string) => ({ id })));
    const db = new ConvexDB({ callStorage } as unknown as ConvexAdminClient);
    const ids = [...Array.from({ length: 205 }, (_, index) => `message-${index}`), 'message-0', 'message-100'];

    await expect(db.loadMany(TABLE_MESSAGES, ids)).resolves.toHaveLength(205);

    expect(callStorage).toHaveBeenCalledTimes(21);
    expect(callStorage).toHaveBeenNthCalledWith(1, {
      op: 'loadMany',
      tableName: TABLE_MESSAGES,
      ids: ids.slice(0, 10),
    });
    expect(callStorage).toHaveBeenNthCalledWith(20, {
      op: 'loadMany',
      tableName: TABLE_MESSAGES,
      ids: ids.slice(190, 200),
    });
    expect(callStorage).toHaveBeenNthCalledWith(21, {
      op: 'loadMany',
      tableName: TABLE_MESSAGES,
      ids: ids.slice(200, 205),
    });
  });

  it('skips storage calls for empty id lists', async () => {
    const callStorage = vi.fn();
    const db = new ConvexDB({ callStorage } as unknown as ConvexAdminClient);

    await expect(db.loadMany(TABLE_MESSAGES, [])).resolves.toEqual([]);

    expect(callStorage).not.toHaveBeenCalled();
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

// Index optimization tests (Issue #12792)
if (!deploymentUrl || !adminKey) {
  describe.skip('WorkflowsConvex - Index Optimization', () => {
    it('requires CONVEX_TEST_URL and CONVEX_TEST_ADMIN_KEY to run index optimization tests', () => undefined);
  });
} else {
  describe('WorkflowsConvex - Index Optimization', () => {
    const workflowsDomain = new WorkflowsConvex({
      deploymentUrl,
      adminAuthToken: adminKey,
      ...(storageFunction ? { storageFunction } : {}),
    });

    const createSnapshot = (status: 'running' | 'success' | 'waiting' | 'pending' | 'failed') => ({
      status,
      context: {},
      activePaths: [],
      activeStepsPath: {},
      timestamp: Date.now(),
      suspendedPaths: {},
      resumeLabels: {},
      serializedStepGraph: [],
      value: {},
      waitingPaths: {},
      runId: '',
    });

    it('should filter by status after index-based query', async () => {
      const testWorkflowName = `test-workflow-${Date.now()}`;

      // Create test data
      await workflowsDomain.persistWorkflowSnapshot({
        workflowName: testWorkflowName,
        runId: 'run-1',
        snapshot: createSnapshot('running'),
      });
      await workflowsDomain.persistWorkflowSnapshot({
        workflowName: testWorkflowName,
        runId: 'run-2',
        snapshot: createSnapshot('success'),
      });
      await workflowsDomain.persistWorkflowSnapshot({
        workflowName: testWorkflowName,
        runId: 'run-3',
        snapshot: createSnapshot('running'),
      });

      const result = await workflowsDomain.listWorkflowRuns({
        workflowName: testWorkflowName,
        status: 'running',
      });

      expect(result.runs).toHaveLength(2);
      expect(
        result.runs.every(run => {
          const snapshot = typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot;
          return snapshot.status === 'running';
        }),
      ).toBe(true);
      expect(result.total).toBe(2);

      // Cleanup
      await workflowsDomain.deleteWorkflowRunById({ runId: 'run-1', workflowName: testWorkflowName });
      await workflowsDomain.deleteWorkflowRunById({ runId: 'run-2', workflowName: testWorkflowName });
      await workflowsDomain.deleteWorkflowRunById({ runId: 'run-3', workflowName: testWorkflowName });
    });

    it('should handle query for single workflow with many runs', async () => {
      const testWorkflowName = `heavy-workflow-${Date.now()}`;

      // Create 150 runs for a single workflow (smaller than 1000 for faster tests)
      for (let i = 0; i < 150; i++) {
        await workflowsDomain.persistWorkflowSnapshot({
          workflowName: testWorkflowName,
          runId: `run-${i}`,
          snapshot: createSnapshot(i % 5 === 0 ? 'running' : 'success'),
        });
      }

      // Should efficiently query using index
      const result = await workflowsDomain.listWorkflowRuns({
        workflowName: testWorkflowName,
        status: 'running',
      });

      expect(result.runs.length).toBe(30); // 30 running runs
      expect(result.total).toBe(30);

      // Cleanup
      for (let i = 0; i < 150; i++) {
        await workflowsDomain.deleteWorkflowRunById({ runId: `run-${i}`, workflowName: testWorkflowName });
      }
    });

    it('should handle pagination with index hints', async () => {
      const testWorkflowName = `paginated-workflow-${Date.now()}`;

      // Create 25 running runs
      for (let i = 0; i < 25; i++) {
        await workflowsDomain.persistWorkflowSnapshot({
          workflowName: testWorkflowName,
          runId: `run-${i}`,
          snapshot: createSnapshot('running'),
        });
      }

      // Get first page
      const page1 = await workflowsDomain.listWorkflowRuns({
        workflowName: testWorkflowName,
        status: 'running',
        perPage: 10,
        page: 0,
      });

      expect(page1.runs.length).toBe(10);
      expect(page1.total).toBe(25);

      // Get second page
      const page2 = await workflowsDomain.listWorkflowRuns({
        workflowName: testWorkflowName,
        status: 'running',
        perPage: 10,
        page: 1,
      });

      expect(page2.runs.length).toBe(10);
      expect(page2.total).toBe(25);

      // Verify no overlap
      const page1Ids = new Set(page1.runs.map(r => r.runId));
      const page2Ids = new Set(page2.runs.map(r => r.runId));
      const intersection = [...page1Ids].filter(id => page2Ids.has(id));
      expect(intersection).toHaveLength(0);

      // Cleanup
      for (let i = 0; i < 25; i++) {
        await workflowsDomain.deleteWorkflowRunById({ runId: `run-${i}`, workflowName: testWorkflowName });
      }
    });
  });
}
