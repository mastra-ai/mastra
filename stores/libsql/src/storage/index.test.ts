import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  createTestSuite,
  createConfigValidationTests,
  createClientAcceptanceTests,
  createDomainDirectTests,
} from '@internal/storage-test-utils';
import { createClient } from '@libsql/client';
import { Mastra } from '@mastra/core/mastra';
import { TABLE_MESSAGES, TABLE_THREADS } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { DatasetsLibSQL } from './domains/datasets';
import { ExperimentsLibSQL } from './domains/experiments';
import { MemoryLibSQL } from './domains/memory';
import { ScoresLibSQL } from './domains/scores';
import { WorkflowsLibSQL } from './domains/workflows';
import { LibSQLStore } from './index';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const TEST_DB_URL = process.env.LIBSQL_TEST_URL ?? 'file::memory:?cache=shared';

// Helper to create a fresh client for each test
const createTestClient = () => createClient({ url: TEST_DB_URL });

// Main storage test suite
const libsql = new LibSQLStore({
  id: 'libsql-test-store',
  url: TEST_DB_URL,
});

const mastra = new Mastra({
  storage: libsql,
});

createTestSuite(mastra.getStorage()!);

describe('LibSQLStore domain wiring', () => {
  it('initializes domains exposed by the composite store', async () => {
    const store = new LibSQLStore({ id: 'libsql-domain-wiring', url: 'file::memory:?cache=shared' });
    await store.init();

    expect(store.stores.favorites).toBeDefined();
    await expect(store.getStore('favorites')).resolves.toBe(store.stores.favorites);
    expect(store.stores.harness).toBeDefined();
    await expect(store.getStore('harness')).resolves.toBe(store.stores.harness);
  });

  it('uses atomic Harness initialization only for owned persistent-file URLs', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mastra-libsql-harness-wiring-'));
    const ownedUrl = pathToFileURL(join(directory, 'owned.db')).href;
    const injectedUrl = pathToFileURL(join(directory, 'injected.db')).href;
    const ownedStore = new LibSQLStore({ id: 'libsql-owned-harness-init', url: ownedUrl });
    const ownedClient = (ownedStore as unknown as { client: ReturnType<typeof createClient> }).client;
    // @libsql/client >= 0.18.0 pools file: connections; the atomic init opens
    // its critical section through client.transaction('write') rather than a
    // raw BEGIN IMMEDIATE on a pooled borrow.
    const ownedTransaction = vi.spyOn(ownedClient, 'transaction');
    const injectedClient = createClient({ url: injectedUrl });
    const injectedExecute = vi.spyOn(injectedClient, 'execute');
    const injectedTransaction = vi.spyOn(injectedClient, 'transaction');
    const injectedStore = new LibSQLStore({ id: 'libsql-injected-harness-init', client: injectedClient });
    const statementSql = (statement: Parameters<typeof ownedClient.execute>[0]) =>
      typeof statement === 'string' ? statement : statement.sql;

    try {
      await ownedStore.stores.harness!.init();
      expect(ownedTransaction).toHaveBeenCalledWith('write');

      await injectedStore.stores.harness!.init();
      expect(injectedTransaction).not.toHaveBeenCalled();
      expect(injectedExecute.mock.calls.some(([statement]) => statementSql(statement).startsWith('BEGIN'))).toBe(false);
    } finally {
      await ownedStore.close();
      await injectedStore.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe('LibSQLStore workspace authorIds filtering', () => {
  it('lists owned and legacy unowned workspaces without returning other authors', async () => {
    const store = new LibSQLStore({ id: 'libsql-workspace-author-ids', url: 'file::memory:?cache=shared' });
    await store.init();
    const workspaces = await store.getStore('workspaces');
    const marker = `author-ids-${Date.now()}`;

    await workspaces!.create({
      workspace: { id: `${marker}-mine`, name: 'Mine', authorId: 'user-a', metadata: { marker } },
    });
    await workspaces!.create({ workspace: { id: `${marker}-legacy`, name: 'Legacy', metadata: { marker } } });
    await workspaces!.create({
      workspace: { id: `${marker}-other`, name: 'Other', authorId: 'user-b', metadata: { marker } },
    });

    const result = await workspaces!.listResolved({
      page: 0,
      perPage: 10,
      orderBy: { field: 'createdAt', direction: 'ASC' },
      authorIds: ['user-a', null],
      metadata: { marker },
    });

    expect(result.workspaces.map(workspace => workspace.id)).toEqual([`${marker}-mine`, `${marker}-legacy`]);
    expect(result.total).toBe(2);
  });
});

// Configuration validation tests
createConfigValidationTests({
  storeName: 'LibSQLStore',
  createStore: config => new LibSQLStore(config as any),
  validConfigs: [
    { description: 'URL config', config: { id: 'test-store', url: TEST_DB_URL } },
    {
      description: 'URL config with authToken',
      config: { id: 'test-store', url: 'libsql://my-db.turso.io', authToken: 'test-token' },
    },
    {
      description: 'URL config with retry options',
      config: { id: 'test-store', url: TEST_DB_URL, maxRetries: 10, initialBackoffMs: 200 },
    },
    { description: 'pre-configured client', config: { id: 'test-store', client: createTestClient() } },
    {
      description: 'client with retry options',
      config: { id: 'test-store', client: createTestClient(), maxRetries: 10, initialBackoffMs: 200 },
    },
    { description: 'disableInit with URL config', config: { id: 'test-store', url: TEST_DB_URL, disableInit: true } },
    {
      description: 'disableInit with client config',
      config: { id: 'test-store', client: createTestClient(), disableInit: true },
    },
  ],
  invalidConfigs: [
    { description: 'empty id', config: { id: '', url: TEST_DB_URL }, expectedError: /id must be provided/i },
  ],
});

// Pre-configured client acceptance tests
createClientAcceptanceTests({
  storeName: 'LibSQLStore',
  expectedStoreName: 'LibSQLStore',
  createStoreWithClient: () =>
    new LibSQLStore({
      id: 'libsql-client-test',
      client: createTestClient(),
    }),
  createStoreWithClientAndOptions: () =>
    new LibSQLStore({
      id: 'libsql-client-options-test',
      client: createTestClient(),
      maxRetries: 10,
      initialBackoffMs: 200,
    }),
});

// Domain-level pre-configured client tests
createDomainDirectTests({
  storeName: 'LibSQL',
  createMemoryDomain: () => new MemoryLibSQL({ client: createTestClient() }),
  createWorkflowsDomain: () => new WorkflowsLibSQL({ client: createTestClient() }),
  createScoresDomain: () => new ScoresLibSQL({ client: createTestClient() }),
  createDatasetsDomain: () => new DatasetsLibSQL({ client: createTestClient() }),
  createExperimentsDomain: () => new ExperimentsLibSQL({ client: createTestClient() }),
  createMemoryDomainWithOptions: () =>
    new MemoryLibSQL({
      client: createTestClient(),
      maxRetries: 10,
      initialBackoffMs: 200,
    }),
});

describe('MemoryLibSQL', () => {
  it('clears storage when the resources table has not been migrated yet', async () => {
    const client = createTestClient();
    try {
      const memory = new MemoryLibSQL({ client });
      await client.execute(`CREATE TABLE IF NOT EXISTS ${TABLE_THREADS} (
        id TEXT PRIMARY KEY,
        resourceId TEXT NOT NULL,
        title TEXT NOT NULL,
        metadata TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`);
      await client.execute(`CREATE TABLE IF NOT EXISTS ${TABLE_MESSAGES} (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        content TEXT NOT NULL,
        role TEXT NOT NULL,
        type TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        resourceId TEXT
      )`);

      await expect(memory.dangerouslyClearAll()).resolves.toBeUndefined();
    } finally {
      client.close();
    }
  });
});

describe('MemoryLibSQL error propagation (no empty-on-error)', () => {
  // These reads used to swallow DB errors and return an empty page, so an outage
  // looked exactly like "no data". They should throw instead. Each test makes the
  // first execute() (the COUNT) reject, and we also check the cause is the original
  // error so a broken mock can't pass as a real outage.
  const expectOutage = async (run: (memory: MemoryLibSQL) => Promise<unknown>, idPattern: RegExp) => {
    const client = createTestClient();
    const memory = new MemoryLibSQL({ client });
    const execSpy = vi.spyOn(client, 'execute').mockRejectedValueOnce(new Error('simulated backend outage'));
    try {
      const err: any = await run(memory).then(
        () => {
          throw new Error('expected the read to reject, but it resolved');
        },
        e => e,
      );
      expect(err).toMatchObject({ id: expect.stringMatching(idPattern) });
      expect(String(err?.cause?.message ?? err?.message)).toContain('simulated backend outage');
    } finally {
      execSpy.mockRestore();
      client.close();
    }
  };

  it('listThreads re-throws backend failures instead of returning empty', async () => {
    await expectOutage(memory => memory.listThreads({}), /LIST_THREADS.*FAILED/);
  });

  it('listMessages re-throws backend failures instead of returning empty', async () => {
    await expectOutage(memory => memory.listMessages({ threadId: 'thread-err' }), /LIST_MESSAGES.*FAILED/);
  });

  it('listMessagesByResourceId re-throws backend failures instead of returning empty', async () => {
    await expectOutage(
      memory => memory.listMessagesByResourceId({ resourceId: 'res-err' }),
      /LIST_MESSAGES_BY_RESOURCE_ID.*FAILED/,
    );
  });
});

describe('LibSQLStore notifications domain', () => {
  it('exposes notifications through the composite store', async () => {
    const client = createTestClient();
    try {
      const store = new LibSQLStore({ id: 'libsql-notifications-test', client, maxRetries: 1, initialBackoffMs: 10 });
      await store.init();

      const notifications = await store.getStore('notifications');
      expect(notifications).toBeDefined();

      const record = await notifications!.createNotification({
        id: 'notification-1',
        threadId: 'thread-1',
        resourceId: 'resource-1',
        agentId: 'agent-1',
        source: 'mastracode',
        kind: 'manual',
        summary: 'Composite notification',
      });

      expect(record.id).toBe('notification-1');
      await expect(
        notifications!.getNotification({ threadId: 'thread-1', id: 'notification-1' }),
      ).resolves.toMatchObject({
        summary: 'Composite notification',
      });
    } finally {
      client.close();
    }
  });
});

describe('LibSQLStore harness domain', () => {
  it('exposes harness sessions through the composite store', async () => {
    const client = createTestClient();
    try {
      const store = new LibSQLStore({ id: 'libsql-harness-test', client, maxRetries: 1, initialBackoffMs: 10 });
      await store.init();

      const harness = await store.getStore('harness');
      expect(harness).toBeDefined();

      await harness!.saveSession(
        {
          id: 'session-1',
          ownerId: 'owner-1',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          origin: 'top-level',
          ownsThread: false,
          modeId: 'mode-1',
          modelId: '__GATEWAY_OPENAI_MODEL__',
          subagentModelOverrides: {},
          permissionRules: { categories: {}, tools: {} },
          sessionGrants: { categories: [], tools: [] },
          tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          pendingQueue: [],
          state: { from: 'composite' },
          createdAt: new Date('2026-01-01T00:00:00.000Z').getTime(),
          lastActivityAt: new Date('2026-01-01T00:00:00.000Z').getTime(),
          version: 0,
        },
        { ownerId: 'owner-1', ifVersion: 0 },
      );

      await expect(harness!.loadSession({ harnessName: 'default', sessionId: 'session-1' })).resolves.toMatchObject({
        id: 'session-1',
        state: { from: 'composite' },
      });
    } finally {
      client.close();
    }
  });
});
