import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createClientAcceptanceTests,
  createConfigValidationTests,
  createDomainDirectTests,
  createMastraStorageTests,
  createTestSuite,
} from '@internal/storage-test-utils';

import type { SqliteClient } from '@mastra/libsql';
import { DatasetsLibSQL, ExperimentsLibSQL, MemoryLibSQL, ScoresLibSQL, WorkflowsLibSQL } from '@mastra/libsql';
import { afterAll, describe, it, vi } from 'vitest';

import { TursoSqliteClient } from './client';
import { getTursoDatabaseSupport } from './support';
import { TursoStore } from './index';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const support = getTursoDatabaseSupport();
if (support.supported) {
  registerNativeStorageTests();
} else {
  describe.skip('Turso native storage conformance', () => {
    it(`requires a supported native platform: ${support.reason ?? 'unsupported platform'}`, () => {});
  });
}

function registerNativeStorageTests() {
  const testDirectory = mkdtempSync(path.join(tmpdir(), 'mastra-turso-storage-'));
  const clients: SqliteClient[] = [];
  const stores: TursoStore[] = [];
  let clientId = 0;

  function createTestClient(): TursoSqliteClient {
    const client = new TursoSqliteClient({ path: path.join(testDirectory, `client-${clientId++}.db`) });
    clients.push(client);
    return client;
  }

  function trackStore(config: ConstructorParameters<typeof TursoStore>[0]): TursoStore {
    const store = new TursoStore(config);
    stores.push(store);
    return store;
  }

  const turso = trackStore({ id: 'turso-test-store', path: path.join(testDirectory, 'suite.db') });
  createTestSuite(turso);

  createConfigValidationTests({
    storeName: 'TursoStore',
    createStore: config => trackStore(config as ConstructorParameters<typeof TursoStore>[0]),
    validConfigs: [
      { description: 'path config', config: { id: 'test-store', path: ':memory:' } },
      {
        description: 'path config with connection options',
        config: { id: 'test-store', path: ':memory:', timeout: 5_000, defaultQueryTimeout: 5_000 },
      },
      {
        description: 'path config with retry options',
        config: { id: 'test-store', path: ':memory:', maxRetries: 10, initialBackoffMs: 200 },
      },
      { description: 'pre-configured client', config: { id: 'test-store', client: createTestClient() } },
      {
        description: 'client with retry options',
        config: { id: 'test-store', client: createTestClient(), maxRetries: 10, initialBackoffMs: 200 },
      },
      { description: 'disableInit', config: { id: 'test-store', path: ':memory:', disableInit: true } },
    ],
    invalidConfigs: [
      { description: 'empty id', config: { id: '', path: ':memory:' }, expectedError: /id must be provided/i },
      { description: 'empty path', config: { id: 'test-store', path: '' }, expectedError: /path must be provided/i },
    ],
  });

  createClientAcceptanceTests({
    storeName: 'TursoStore',
    expectedStoreName: 'TursoStore',
    createStoreWithClient: () => trackStore({ id: 'turso-client-test', client: createTestClient() }),
    createStoreWithClientAndOptions: () =>
      trackStore({
        id: 'turso-client-options-test',
        client: createTestClient(),
        maxRetries: 10,
        initialBackoffMs: 200,
      }),
  });

  createDomainDirectTests({
    storeName: 'Turso',
    createMemoryDomain: () => new MemoryLibSQL({ client: createTestClient() }),
    createWorkflowsDomain: () => new WorkflowsLibSQL({ client: createTestClient() }),
    createScoresDomain: () => new ScoresLibSQL({ client: createTestClient() }),
    createDatasetsDomain: () => new DatasetsLibSQL({ client: createTestClient() }),
    createExperimentsDomain: () => new ExperimentsLibSQL({ client: createTestClient() }),
    createMemoryDomainWithOptions: () =>
      new MemoryLibSQL({ client: createTestClient(), maxRetries: 10, initialBackoffMs: 200 }),
  });

  createMastraStorageTests({
    testNameSuffix: 'Turso',
    createDefaultStorage: () => trackStore({ id: `turso-default-${stores.length}`, client: createTestClient() }),
    createAlternateStorage: () => trackStore({ id: `turso-alternate-${stores.length}`, client: createTestClient() }),
  });

  afterAll(async () => {
    await Promise.allSettled(stores.map(store => store.close()));
    await Promise.allSettled(clients.map(client => client.close()));
    rmSync(testDirectory, { recursive: true, force: true });
  });
}
