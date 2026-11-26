import { randomUUID } from 'node:crypto';
import { Client as ElasticSearchClient } from '@elastic/elasticsearch';
import {
  createTestSuite,
  createConfigValidationTests,
  createClientAcceptanceTests,
  createDomainDirectTests,
} from '@internal/storage-test-utils';
import { TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { MemoryElasticSearch } from './domains/memory';
import { ScoresElasticSearch } from './domains/scores';
import { getKey } from './domains/utils';
import { WorkflowsElasticSearch } from './domains/workflows';
import { ElasticSearchStore } from './store';
import type { ElasticSearchConfig } from './types';

vi.setConfig({ testTimeout: 200_000, hookTimeout: 200_000 });

const url = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';

createTestSuite(
  new ElasticSearchStore({
    id: 'elasticsearch-test-store',
    url,
  }),
  { workflowResultsNoopWhenRunMissing: false },
);

// Configuration validation tests
createConfigValidationTests({
  storeName: 'ElasticSearchStore',
  createStore: config => new ElasticSearchStore(config as ElasticSearchConfig),
  validConfigs: [
    {
      description: 'url config',
      config: { id: 'test-store', url },
    },
    {
      description: 'disableInit with url config',
      config: { id: 'test-store', url, disableInit: true },
    },
  ],
  invalidConfigs: [
    {
      description: 'empty url',
      config: { id: 'test-store', url: '' },
      expectedError: /client.*or.*url/i,
    },
    {
      description: 'missing url and client',
      config: { id: 'test-store' },
      expectedError: /client.*or.*url/i,
    },
  ],
});

// Pre-configured client acceptance + domain direct tests
let sharedClient: ElasticSearchClient;

beforeAll(() => {
  sharedClient = new ElasticSearchClient({ node: url });
});

afterAll(async () => {
  await sharedClient.close();
});

createClientAcceptanceTests({
  storeName: 'ElasticSearchStore',
  expectedStoreName: 'ElasticSearch',
  createStoreWithClient: () =>
    new ElasticSearchStore({
      id: 'elasticsearch-client-test',
      client: sharedClient,
    }),
});

createDomainDirectTests({
  storeName: 'ElasticSearch',
  createMemoryDomain: () => new MemoryElasticSearch({ client: sharedClient }),
  createWorkflowsDomain: () => new WorkflowsElasticSearch({ client: sharedClient }),
  createScoresDomain: () => new ScoresElasticSearch({ client: sharedClient }),
});

describe('ElasticSearchStore connection options', () => {
  it('should connect using a url', async () => {
    const storage = new ElasticSearchStore({ id: 'url-test', url });

    await storage.init();
    const memory = await storage.getStore('memory');
    expect(memory).toBeDefined();
    await storage.close();
  });

  it('should expose the underlying client via getClient()', async () => {
    const storage = new ElasticSearchStore({ id: 'getclient-test', url });

    await storage.init();
    const client = storage.getClient();
    expect(client).toBeDefined();
    expect(typeof client.index).toBe('function');
    expect(typeof client.search).toBe('function');
    await storage.close();
  });

  it('should not close a user-provided client', async () => {
    const client = new ElasticSearchClient({ node: url });
    const storage = new ElasticSearchStore({ id: 'external-client-test', client });

    await storage.init();
    await storage.close();

    // Client is still usable after storage.close()
    const info = await client.info();
    expect(info.cluster_name).toBeDefined();
    await client.close();
  });
});

describe('ElasticSearch domain with client config', () => {
  it('should allow domains to use client config directly', async () => {
    const client = new ElasticSearchClient({ node: url });
    const memoryDomain = new MemoryElasticSearch({ client });

    expect(memoryDomain).toBeDefined();
    await memoryDomain.init();

    const thread = {
      id: `thread-client-test-${Date.now()}`,
      resourceId: 'test-resource',
      title: 'Test Client Thread',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const savedThread = await memoryDomain.saveThread({ thread });
    expect(savedThread.id).toBe(thread.id);

    await memoryDomain.deleteThread({ threadId: thread.id });
    await client.close();
  });
});

describe('Elasticsearch workflow snapshot resourceId compatibility', () => {
  const namespace = 'workflows';

  const workflowSnapshot = (runId: string, status: WorkflowRunState['status'] = 'suspended'): WorkflowRunState =>
    ({
      runId,
      status,
      value: {},
      context: {},
      activePaths: [],
      activeStepsPath: {},
      serializedStepGraph: [],
      suspendedPaths: {},
      resumeLabels: {},
      waitingPaths: {},
      requestContext: {},
      timestamp: Date.now(),
    }) as WorkflowRunState;

  // Canonical and legacy document IDs are built directly from `getKey` so the
  // raw fixtures stay independent of whatever `processRecord` writes.
  const canonicalKey = (workflowName: string, runId: string) =>
    getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace, workflow_name: workflowName, run_id: runId });

  const legacyKey = (workflowName: string, runId: string, resourceId: string) =>
    getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace, workflow_name: workflowName, run_id: runId, resourceId });

  const store = () => new WorkflowsElasticSearch({ client: sharedClient });

  // Seed a raw document exactly as an earlier adapter version wrote it.
  const seedRaw = async (key: string, record: Record<string, unknown>) => {
    await sharedClient.index({
      index: TABLE_WORKFLOW_SNAPSHOT,
      id: key,
      document: { key, doc: JSON.stringify(record) },
      refresh: true,
    });
  };

  const seedLegacy = (
    workflowName: string,
    runId: string,
    resourceId: string,
    status: 'suspended' | 'running',
    createdAt: Date,
  ) =>
    seedRaw(legacyKey(workflowName, runId, resourceId), {
      namespace,
      workflow_name: workflowName,
      run_id: runId,
      resourceId,
      snapshot: workflowSnapshot(runId, status),
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
    });

  const seedCanonical = (
    workflowName: string,
    runId: string,
    resourceId: string,
    status: 'suspended' | 'running',
    createdAt: Date,
  ) =>
    seedRaw(canonicalKey(workflowName, runId), {
      namespace,
      workflow_name: workflowName,
      run_id: runId,
      resourceId,
      snapshot: workflowSnapshot(runId, status),
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
    });

  // Every stored document for one exact run: the canonical id plus any legacy
  // `:resourceId:` ids. Scoped to the run so neighbouring runs never leak in.
  const runKeys = async (workflowName: string, runId: string): Promise<string[]> => {
    const response = await sharedClient.search<{ key: string }>({
      index: TABLE_WORKFLOW_SNAPSHOT,
      size: 100,
      _source: ['key'],
      query: {
        bool: {
          should: [
            { term: { key: canonicalKey(workflowName, runId) } },
            { wildcard: { key: `${canonicalKey(workflowName, runId)}:resourceId:*` } },
          ],
          minimum_should_match: 1,
        },
      },
    });
    return response.hits.hits.map(hit => hit._source!.key).sort();
  };

  const documentExists = async (key: string) => sharedClient.exists({ index: TABLE_WORKFLOW_SNAPSHOT, id: key });

  // Reset the workflow snapshot table (and create it with the right mapping)
  // before each case; the shared suite above has already finished.
  beforeEach(async () => {
    await store().dangerouslyClearAll();
  });

  it('round-trips a resourceId-scoped run through load, get, update, list and delete', async () => {
    const workflows = store();
    const workflowName = `wf-resourceId-${randomUUID()}`;
    const runId = randomUUID();
    const createdAt = new Date('2025-01-01T00:00:00Z');

    await workflows.persistWorkflowSnapshot({
      workflowName,
      runId,
      resourceId: 'r1',
      snapshot: workflowSnapshot(runId),
      createdAt,
    });

    expect((await workflows.loadWorkflowSnapshot({ namespace, workflowName, runId }))?.status).toBe('suspended');
    expect((await workflows.getWorkflowRunById({ workflowName, runId }))?.resourceId).toBe('r1');
    expect((await workflows.getWorkflowRunById({ runId }))?.resourceId).toBe('r1');

    await workflows.updateWorkflowState({ workflowName, runId, opts: { status: 'running' } });
    await workflows.updateWorkflowResults({
      workflowName,
      runId,
      stepId: 's1',
      result: { status: 'success', output: 1 } as any,
      requestContext: {},
    });

    const loaded = await workflows.loadWorkflowSnapshot({ namespace, workflowName, runId });
    expect(loaded?.status).toBe('running');
    expect(loaded?.context.s1).toBeDefined();

    const run = await workflows.getWorkflowRunById({ workflowName, runId });
    expect(run?.resourceId).toBe('r1');
    expect(run?.createdAt.toISOString()).toBe(createdAt.toISOString());
    expect(await runKeys(workflowName, runId)).toHaveLength(1);
    expect(await documentExists(canonicalKey(workflowName, runId))).toBe(true);

    const listed = await workflows.listWorkflowRuns({ workflowName, resourceId: 'r1' });
    expect(listed.total).toBe(1);
    expect(listed.runs.map(r => r.runId)).toEqual([runId]);

    await workflows.deleteWorkflowRunById({ workflowName, runId });
    expect(await workflows.loadWorkflowSnapshot({ namespace, workflowName, runId })).toBeNull();
    expect(await runKeys(workflowName, runId)).toHaveLength(0);
  });

  it('reads, updates and deletes a run stored under a legacy resourceId key', async () => {
    const workflows = store();
    const workflowName = `wf-resourceId-${randomUUID()}`;
    const runId = randomUUID();
    const createdAt = new Date('2025-01-01T00:00:00Z');

    await seedLegacy(workflowName, runId, 'r1', 'suspended', createdAt);

    // The raw fixture itself is visible through the client.
    expect(await runKeys(workflowName, runId)).toEqual([legacyKey(workflowName, runId, 'r1')]);

    expect((await workflows.loadWorkflowSnapshot({ namespace, workflowName, runId }))?.status).toBe('suspended');
    expect((await workflows.getWorkflowRunById({ workflowName, runId }))?.resourceId).toBe('r1');

    await workflows.updateWorkflowState({ workflowName, runId, opts: { status: 'running' } });
    await workflows.updateWorkflowResults({
      workflowName,
      runId,
      stepId: 's1',
      result: { status: 'success', output: 1 } as any,
      requestContext: {},
    });

    const run = await workflows.getWorkflowRunById({ workflowName, runId });
    expect((run?.snapshot as WorkflowRunState).status).toBe('running');
    expect(run?.createdAt.toISOString()).toBe(createdAt.toISOString());
    expect(run?.resourceId).toBe('r1');

    const listed = await workflows.listWorkflowRuns({ workflowName, resourceId: 'r1' });
    expect(listed.total).toBe(1);
    expect(listed.runs.map(r => r.runId)).toEqual([runId]);

    await workflows.deleteWorkflowRunById({ workflowName, runId });
    expect(await workflows.loadWorkflowSnapshot({ namespace, workflowName, runId })).toBeNull();
    expect(await runKeys(workflowName, runId)).toHaveLength(0);
  });

  it('prefers the canonical document when legacy and canonical resourceId copies coexist', async () => {
    const workflows = store();
    const workflowName = `wf-resourceId-${randomUUID()}`;
    const runId = randomUUID();
    const legacyCreatedAt = new Date('2024-01-01T00:00:00Z');
    const canonicalCreatedAt = new Date('2025-06-01T00:00:00Z');

    await seedLegacy(workflowName, runId, 'r1', 'suspended', legacyCreatedAt);
    await seedCanonical(workflowName, runId, 'r1', 'running', canonicalCreatedAt);
    expect(await runKeys(workflowName, runId)).toHaveLength(2);

    const run = await workflows.getWorkflowRunById({ workflowName, runId });
    expect((run?.snapshot as WorkflowRunState).status).toBe('running');
    expect(run?.createdAt.toISOString()).toBe(canonicalCreatedAt.toISOString());
    expect(run?.resourceId).toBe('r1');

    const all = await workflows.listWorkflowRuns({ workflowName });
    expect(all.total).toBe(1);
    expect((all.runs[0]!.snapshot as WorkflowRunState).status).toBe('running');

    const byResource = await workflows.listWorkflowRuns({ workflowName, resourceId: 'r1' });
    expect(byResource.total).toBe(1);
    expect(byResource.runs.map(r => r.runId)).toEqual([runId]);

    const paged = await workflows.listWorkflowRuns({ workflowName, perPage: 1, page: 0 });
    expect(paged.total).toBe(1);
    expect(paged.runs.map(r => r.runId)).toEqual([runId]);
  });

  it('never loads or deletes a neighbouring run when resolving legacy resourceId keys', async () => {
    const workflows = store();
    const workflowName = `wf-resourceId-${randomUUID()}`;
    const runId = randomUUID();
    const neighbourRunId = randomUUID();
    const createdAt = new Date('2025-01-01T00:00:00Z');

    await seedLegacy(workflowName, runId, 'r1', 'suspended', createdAt);
    await seedCanonical(workflowName, neighbourRunId, 'r2', 'running', createdAt);

    expect((await workflows.getWorkflowRunById({ workflowName, runId }))?.runId).toBe(runId);

    await workflows.deleteWorkflowRunById({ workflowName, runId });
    expect(await runKeys(workflowName, runId)).toHaveLength(0);

    expect((await workflows.loadWorkflowSnapshot({ namespace, workflowName, runId: neighbourRunId }))?.status).toBe(
      'running',
    );
    expect(await runKeys(workflowName, neighbourRunId)).toHaveLength(1);
  });

  it('keeps a run separate from a run whose id extends it when resolving legacy resourceId keys', async () => {
    const workflows = store();
    const workflowName = `wf-resourceId-${randomUUID()}`;
    // `extendedRunId` starts with `runId`, so a loose prefix match would merge them.
    const runId = `run-${randomUUID()}`;
    const extendedRunId = `${runId}-extra`;
    const createdAt = new Date('2025-01-01T00:00:00Z');

    await seedLegacy(workflowName, runId, 'r1', 'suspended', createdAt);
    await seedLegacy(workflowName, extendedRunId, 'r1', 'running', createdAt);

    expect((await workflows.loadWorkflowSnapshot({ namespace, workflowName, runId }))?.status).toBe('suspended');
    expect((await workflows.loadWorkflowSnapshot({ namespace, workflowName, runId: extendedRunId }))?.status).toBe(
      'running',
    );

    await workflows.deleteWorkflowRunById({ workflowName, runId });
    expect(await runKeys(workflowName, runId)).toHaveLength(0);
    expect(await runKeys(workflowName, extendedRunId)).toHaveLength(1);
    expect((await workflows.loadWorkflowSnapshot({ namespace, workflowName, runId: extendedRunId }))?.status).toBe(
      'running',
    );
  });
});
