import {
  createClientAcceptanceTests,
  createConfigValidationTests,
  createDomainDirectTests,
  createObservationalMemoryConcurrencyTests,
  createTestSuite,
} from '@internal/storage-test-utils';
import { Surreal } from 'surrealdb';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { SurrealDBConnector } from '../shared/connector';
import { MemoryStorageSurrealDB } from './domains/memory';
import { ScoresStorageSurrealDB } from './domains/scores';
import { WorkflowsStorageSurrealDB } from './domains/workflows';
import { connectedClient, SURREALDB_URL, testConfig } from './test-utils';
import { SurrealDBStore } from './index';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

createTestSuite(new SurrealDBStore(testConfig('shared_suite')));

createConfigValidationTests({
  storeName: 'SurrealDBStore',
  createStore: config => new SurrealDBStore(config as any),
  validConfigs: [
    {
      description: 'URL with username and password',
      config: { id: 'test-store', url: 'ws://localhost:8000', username: 'root', password: 'root' },
    },
    {
      description: 'URL with a database-level user',
      config: {
        id: 'test-store',
        url: 'ws://localhost:8000',
        username: 'app',
        password: 'secret',
        namespace: 'app',
        database: 'app',
        authLevel: 'database',
      },
    },
    {
      description: 'URL with a token',
      config: { id: 'test-store', url: 'https://example.surreal.cloud', token: 'token' },
    },
    {
      description: 'an existing Surreal instance',
      config: { id: 'test-store', db: new Surreal() },
    },
    {
      description: 'disableInit',
      config: { id: 'test-store', url: 'ws://localhost:8000', username: 'root', password: 'root', disableInit: true },
    },
  ],
  invalidConfigs: [
    {
      description: 'empty id',
      config: { id: '', url: 'ws://localhost:8000', username: 'root', password: 'root' },
      expectedError: /id must be provided/i,
    },
    {
      description: 'empty url',
      config: { id: 'test-store', url: '', username: 'root', password: 'root' },
      expectedError: /url must be provided/i,
    },
    {
      description: 'url without credentials',
      config: { id: 'test-store', url: 'ws://localhost:8000' },
      expectedError: /username and password, a token, or an existing Surreal instance/i,
    },
  ],
});

let sharedClient: Surreal;
beforeAll(async () => {
  sharedClient = await connectedClient('client_acceptance');
});
afterAll(async () => {
  await sharedClient?.close();
});

createClientAcceptanceTests({
  storeName: 'SurrealDBStore',
  expectedStoreName: 'SurrealDBStore',
  createStoreWithClient: () => new SurrealDBStore({ id: 'surrealdb-client-test', db: sharedClient }),
  createStoreWithClientAndOptions: () =>
    new SurrealDBStore({ id: 'surrealdb-client-test', db: sharedClient, disableInit: true }),
});

describe('SurrealDBStore with a caller-managed client', () => {
  it('keeps the namespace a client selected and adds the default database', async () => {
    const namespace = process.env.SURREALDB_NAMESPACE || 'mastra_test';
    const client = new Surreal({ codecOptions: { useNativeDates: true } });
    await client.connect(SURREALDB_URL, {
      authentication: {
        username: process.env.SURREALDB_USERNAME || 'root',
        password: process.env.SURREALDB_PASSWORD || 'root',
      },
    });
    await client.query(`DEFINE NAMESPACE IF NOT EXISTS ${namespace}`).collect();
    await client.use({ namespace });
    const store = new SurrealDBStore({ id: 'surrealdb-namespace-only', db: client });
    try {
      await store.init();

      const [selection] = await client.query('RETURN [session::ns(), session::db()]').collect<[string[]]>();
      expect(selection).toEqual([namespace, 'mastra']);
    } finally {
      await store.close();
      await client.close();
    }
  });

  it('selects the default namespace and database on a client with none selected', async () => {
    const client = new Surreal({ codecOptions: { useNativeDates: true } });
    await client.connect(SURREALDB_URL, {
      authentication: {
        username: process.env.SURREALDB_USERNAME || 'root',
        password: process.env.SURREALDB_PASSWORD || 'root',
      },
    });
    const store = new SurrealDBStore({ id: 'surrealdb-no-selection', db: client });
    try {
      await store.init();
      const memory = (await store.getStore('memory'))!;
      const threadId = `no-selection-${Date.now()}`;
      const now = new Date();
      await memory.saveThread({
        thread: { id: threadId, resourceId: 'resource-1', title: 'Thread', createdAt: now, updatedAt: now },
      });

      const [selection] = await client.query('RETURN [session::ns(), session::db()]').collect<[string[]]>();
      expect(selection).toEqual(['mastra', 'mastra']);
      expect((await memory.getThreadById({ threadId }))?.resourceId).toBe('resource-1');
    } finally {
      await store.close();
      await client.close();
    }
  });

  it('keeps the client on the namespace and database it selected', async () => {
    const client = await connectedClient('own_selection');
    // A separate connection, so the check does not go through the store's client.
    const reader = await connectedClient('own_selection');
    const store = new SurrealDBStore({ id: 'surrealdb-own-selection', db: client });
    try {
      await store.init();
      const memory = (await store.getStore('memory'))!;
      const threadId = `own-selection-${Date.now()}`;
      const now = new Date();
      await memory.saveThread({
        thread: { id: threadId, resourceId: 'resource-1', title: 'Thread', createdAt: now, updatedAt: now },
      });

      const [selection] = await client.query('RETURN [session::ns(), session::db()]').collect<[string[]]>();
      expect(selection).toEqual([process.env.SURREALDB_NAMESPACE || 'mastra_test', 'own_selection']);

      const [row] = await reader
        .query(`SELECT VALUE resourceId FROM ONLY type::record('mastra_threads', $id)`, { id: threadId })
        .collect<[string | undefined]>();
      expect(row).toBe('resource-1');
    } finally {
      await store.close();
      await reader.close();
      await client.close();
    }
  });
});

const domainConnector = new SurrealDBConnector(testConfig('domain_direct'));
createDomainDirectTests({
  storeName: 'SurrealDB',
  createMemoryDomain: () => new MemoryStorageSurrealDB({ connector: domainConnector }),
  createWorkflowsDomain: () => new WorkflowsStorageSurrealDB({ connector: domainConnector }),
  createScoresDomain: () => new ScoresStorageSurrealDB({ connector: domainConnector }),
});

createObservationalMemoryConcurrencyTests({
  label: 'SurrealDB (two connections)',
  createStores: async () => {
    // Each store has its own connection, so two stores stand in for two processes.
    const stores = [0, 1].map(i => new SurrealDBStore(testConfig('om_concurrency', { id: `om-concurrency-${i}` })));
    await stores[0]!.init();
    await stores[1]!.init();
    const [a, b] = await Promise.all(stores.map(async store => (await store.getStore('memory'))!));
    return {
      a: a!,
      b: b!,
      cleanup: async () => {
        await Promise.all(stores.map(store => store.close().catch(() => {})));
      },
    };
  },
});

describe('SurrealDBStore', () => {
  const store = new SurrealDBStore(testConfig('store_specific'));

  beforeAll(async () => {
    await store.init();
  });

  afterAll(async () => {
    await store.close();
  });

  it('keeps createdAt and resourceId when a run is persisted again without them', async () => {
    const workflows = (await store.getStore('workflows'))!;
    const createdAt = new Date('2024-01-01T00:00:00.000Z');
    const snapshot = { runId: 'run-keep', status: 'running', context: {}, value: {} } as any;

    await workflows.persistWorkflowSnapshot({
      workflowName: 'wf-keep',
      runId: 'run-keep',
      resourceId: 'resource-1',
      snapshot,
      createdAt,
    });
    await workflows.persistWorkflowSnapshot({ workflowName: 'wf-keep', runId: 'run-keep', snapshot });
    await workflows.updateWorkflowState({ workflowName: 'wf-keep', runId: 'run-keep', opts: { status: 'success' } });

    const run = await workflows.getWorkflowRunById({ workflowName: 'wf-keep', runId: 'run-keep' });
    expect(run?.resourceId).toBe('resource-1');
    expect(run?.createdAt.toISOString()).toBe(createdAt.toISOString());
    expect((run?.snapshot as any).status).toBe('success');
  });

  it('applies concurrent step results to the same run without losing any', async () => {
    const workflows = (await store.getStore('workflows'))!;
    const snapshot = { runId: 'run-parallel', status: 'running', context: {}, value: {} } as any;
    await workflows.persistWorkflowSnapshot({ workflowName: 'wf-parallel', runId: 'run-parallel', snapshot });

    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        workflows.updateWorkflowResults({
          workflowName: 'wf-parallel',
          runId: 'run-parallel',
          stepId: `step-${i}`,
          result: { status: 'success', output: i } as any,
          requestContext: {},
        }),
      ),
    );

    const stored = await workflows.loadWorkflowSnapshot({ workflowName: 'wf-parallel', runId: 'run-parallel' });
    expect(Object.keys(stored!.context).filter(key => key.startsWith('step-'))).toHaveLength(10);
  });

  it('merges concurrent working memory updates atomically', async () => {
    const memory = (await store.getStore('memory'))!;
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        memory.mergeResourceWorkingMemory({
          resourceId: 'resource-merge',
          merge: existing => `${existing ?? ''}[${i}]`,
        }),
      ),
    );

    const resource = await memory.getResourceById({ resourceId: 'resource-merge' });
    for (let i = 0; i < 10; i++) expect(resource?.workingMemory).toContain(`[${i}]`);
  });

  it('removes thread-scoped observational memory with the thread', async () => {
    const memory = (await store.getStore('memory'))!;
    const thread = {
      id: 'thread-om-delete',
      resourceId: 'resource-om',
      title: 't',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await memory.saveThread({ thread });
    await memory.initializeObservationalMemory({
      threadId: thread.id,
      resourceId: thread.resourceId,
      scope: 'thread',
      config: {},
    });

    await memory.deleteThread({ threadId: thread.id });
    expect(await memory.getObservationalMemory(thread.id, thread.resourceId)).toBeNull();
  });
});
