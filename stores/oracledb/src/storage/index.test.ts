import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  createClientAcceptanceTests,
  createConfigValidationTests,
  createDomainDirectTests,
} from '../../../_test-utils/src';
import { createAgentsTests } from '../../../_test-utils/src/domains/agents';
import { createMemoryTest } from '../../../_test-utils/src/domains/memory';
import { createObservabilityTests } from '../../../_test-utils/src/domains/observability';
import { createScoresTest } from '../../../_test-utils/src/domains/scores';
import { createWorkflowsTests } from '../../../_test-utils/src/domains/workflows';
import { OraclePoolManager } from '../shared/connection';
import type { OracleMigration } from './migrations';
import { MemoryOracle, OracleStore, ScoresOracle, WorkflowsOracle } from '.';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const runIntegration = process.env.RUN_ORACLE_STORAGE_INTEGRATION === 'true';
const describeIntegration = runIntegration ? describe : describe.skip;
// Fallback literals keep the config-validation tests hermetic: CI runs them
// without any Oracle environment, and they never open a real connection. The
// integration suite below always runs with the real env vars set.
const connection = {
  user: process.env.ORACLE_DATABASE_USER ?? 'mastra_test',
  password: process.env.ORACLE_DATABASE_PASSWORD ?? 'mastra_test_password',
  connectString: process.env.ORACLE_DATABASE_CONNECT_STRING ?? 'localhost:1521/FREEPDB1',
};

function storeConfig(id: string) {
  return {
    id,
    ...connection,
    skipDefaultIndexes: true,
    migrationTableName: 'ORACLE_TEST_MIGRATIONS',
  };
}

describeIntegration('OracleStore shared storage suite', () => {
  const poolManager = runIntegration ? new OraclePoolManager(connection) : ({} as unknown as OraclePoolManager);
  const store = runIntegration
    ? new OracleStore({ id: 'oracle-shared-storage-suite', poolManager, skipDefaultIndexes: true })
    : new OracleStore({ id: 'oracle-placeholder', poolManager: {} as any });
  beforeAll(async () => {
    await store.init();
  });

  afterAll(async () => {
    await Promise.all(
      ['workflows', 'memory', 'scores', 'observability', 'agents'].map(async domainName => {
        const domain = await store.getStore(domainName as any);
        await domain?.dangerouslyClearAll?.();
      }),
    );
    await poolManager.close();
  });

  createWorkflowsTests({ storage: store });
  createMemoryTest({ storage: store });
  createScoresTest({ storage: store, capabilities: { listScoresBySpan: true, toolMocks: false } });
  createObservabilityTests({ storage: store });
  createAgentsTests({ storage: store });

  createClientAcceptanceTests({
    storeName: 'OracleStore',
    expectedStoreName: 'OracleStore',
    createStoreWithClient: () =>
      new OracleStore({
        id: `oracle-client-acceptance-${Date.now()}`,
        poolManager,
        skipDefaultIndexes: true,
      }),
    createStoreWithClientAndOptions: () =>
      new OracleStore({
        id: `oracle-client-options-${Date.now()}`,
        poolManager,
        skipDefaultIndexes: true,
        messageBatchSize: 25,
      }),
  });

  createDomainDirectTests({
    storeName: 'OracleDB',
    createMemoryDomain: () => new MemoryOracle({ poolManager, skipDefaultIndexes: true }),
    createWorkflowsDomain: () => new WorkflowsOracle({ poolManager, skipDefaultIndexes: true }),
    createScoresDomain: () => new ScoresOracle({ poolManager, skipDefaultIndexes: true }),
    createMemoryDomainWithOptions: () =>
      new MemoryOracle({
        poolManager,
        skipDefaultIndexes: true,
        messageBatchSize: 25,
      }),
  });
});

createConfigValidationTests({
  storeName: 'OracleStore',
  createStore: config => new OracleStore(config as any),
  usesMastraError: true,
  validConfigs: [
    {
      description: 'user/password/connectString config',
      config: storeConfig('oracle-valid-config'),
    },
    {
      description: 'external auth config without password',
      config: {
        id: 'oracle-valid-external-auth-config',
        user: connection.user,
        connectString: connection.connectString,
        externalAuth: true,
      },
    },
    {
      description: 'external auth config without user or password',
      config: {
        id: 'oracle-valid-external-auth-no-user-config',
        connectString: connection.connectString,
        externalAuth: true,
      },
    },
    {
      description: 'preconfigured pool manager',
      config: {
        id: 'oracle-valid-pool-manager-config',
        poolManager: {} as OraclePoolManager,
      },
    },
  ],
  invalidConfigs: [
    {
      description: 'missing credentials',
      config: { id: 'oracle-invalid-missing-credentials' },
      expectedError: /Provide either an Oracle pool or user\/connectString credentials/,
    },
    {
      description: 'password missing without external auth',
      config: {
        id: 'oracle-invalid-missing-password',
        user: connection.user,
        connectString: connection.connectString,
      },
      expectedError: /Password is required unless externalAuth is enabled/,
    },
    {
      description: 'invalid schema identifier',
      config: {
        id: 'oracle-invalid-schema',
        ...connection,
        schemaName: 'bad-schema',
      },
      expectedError: /schema name/i,
    },
  ],
});

describe('OracleStore facade', () => {
  it('coalesces in-flight init and migrate calls', async () => {
    const store = new OracleStore({
      id: 'oracle-store-promise-coalescing',
      poolManager: { getPool: vi.fn(), close: vi.fn() } as any,
    });
    const domainInits = Object.values(store.stores).map(domain =>
      vi.spyOn(domain as { init: () => Promise<void> }, 'init').mockResolvedValue(undefined),
    );
    let resolveRun: (value: Array<{ id: string; status: string }>) => void = () => undefined;
    const migrationRegistry = {
      run: vi.fn(
        () =>
          new Promise<Array<{ id: string; status: string }>>(resolve => {
            resolveRun = resolve;
          }),
      ),
      list: vi.fn(),
    };
    (store as any).migrationRegistry = migrationRegistry;

    const firstInit = store.init();
    const secondInit = store.init();
    expect(migrationRegistry.run).toHaveBeenCalledTimes(1);
    resolveRun([{ id: 'R001_MEMORY_SCHEMA', status: 'applied' }]);
    await Promise.all([firstInit, secondInit]);

    const firstMigrate = store.migrate();
    const secondMigrate = store.migrate();
    expect(migrationRegistry.run).toHaveBeenCalledTimes(2);
    resolveRun([{ id: 'R001_MEMORY_SCHEMA', status: 'reapplied' }]);
    await expect(Promise.all([firstMigrate, secondMigrate])).resolves.toEqual([
      [{ id: 'R001_MEMORY_SCHEMA', status: 'reapplied' }],
      [{ id: 'R001_MEMORY_SCHEMA', status: 'reapplied' }],
    ]);
    for (const init of domainInits) {
      expect(init).not.toHaveBeenCalled();
    }
  });

  it('waits for an in-flight init before running a forced migrate', async () => {
    const store = new OracleStore({
      id: 'oracle-store-migrate-waits-for-init',
      poolManager: { getPool: vi.fn(), close: vi.fn() } as any,
    });
    const domainInits = Object.values(store.stores).map(domain =>
      vi.spyOn(domain as { init: () => Promise<void> }, 'init').mockResolvedValue(undefined),
    );
    const resolvers: Array<(value: Array<{ id: string; status: string }>) => void> = [];
    const migrationRegistry = {
      run: vi.fn(
        () =>
          new Promise<Array<{ id: string; status: string }>>(resolve => {
            resolvers.push(resolve);
          }),
      ),
      list: vi.fn(),
    };
    (store as any).migrationRegistry = migrationRegistry;

    // migrate() starts while init() is still in flight, a genuine overlap
    // (unlike the coalescing test above, where migrate() starts after init()
    // has already resolved).
    const initPromise = store.init();
    const migratePromise = store.migrate();

    expect(migrationRegistry.run).toHaveBeenCalledTimes(1);
    expect(migrationRegistry.run.mock.calls[0]?.[1]).toEqual({ forceRepeatable: false });

    resolvers[0]?.([{ id: 'R001_MEMORY_SCHEMA', status: 'applied' }]);
    await initPromise;

    // The forced run must only start after init() settles, and it must be
    // its own forced (forceRepeatable: true) run rather than reusing init's.
    await vi.waitFor(() => expect(migrationRegistry.run).toHaveBeenCalledTimes(2));
    expect(migrationRegistry.run.mock.calls[1]?.[1]).toEqual({ forceRepeatable: true });

    resolvers[1]?.([{ id: 'R001_MEMORY_SCHEMA', status: 'reapplied' }]);
    await expect(migratePromise).resolves.toEqual([{ id: 'R001_MEMORY_SCHEMA', status: 'reapplied' }]);

    for (const init of domainInits) {
      expect(init).not.toHaveBeenCalled();
    }
  });

  it('runs repeatable domain migrations once for init and again for explicit migrate', async () => {
    const pool = {};
    const poolManager = {
      getPool: vi.fn(async () => pool),
      close: vi.fn(async () => undefined),
    };
    const store = new OracleStore({
      id: 'oracle-store-unit',
      poolManager: poolManager as any,
      schemaName: 'APP_SCHEMA',
      skipDefaultIndexes: true,
      vectorRegistryTableName: 'LOCAL_VECTOR_REGISTRY',
      indexes: [{ name: 'LOCAL_THREADS_RESOURCE_IDX', table: 'mastra_threads', columns: ['resourceId'] }],
    });
    const domainInits = Object.values(store.stores).map(domain =>
      vi.spyOn(domain as { init: () => Promise<void> }, 'init').mockResolvedValue(undefined),
    );
    const migrationRegistry = {
      run: vi.fn(async (migrations: OracleMigration[], options: { forceRepeatable?: boolean }) => {
        for (const migration of migrations) {
          expect(migration.kind).toBe('repeatable');
          expect(migration.checksum).toMatch(/^[A-F0-9]{64}$/);
          await migration.run();
        }
        return migrations.map(migration => ({
          id: migration.id,
          name: migration.name,
          status: options.forceRepeatable ? 'reapplied' : 'applied',
        }));
      }),
      list: vi.fn(async () => [
        {
          id: 'R001_MEMORY_SCHEMA',
          name: 'Memory domain schema',
          kind: 'repeatable',
          checksum: 'checksum',
          appliedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]),
    };
    (store as any).migrationRegistry = migrationRegistry;

    await store.init();
    await store.init();
    const migrationResults = await store.migrate();
    const migrations = await store.listMigrations();

    expect(migrationRegistry.run).toHaveBeenCalledTimes(2);
    expect(migrationRegistry.run.mock.calls[0]?.[1]).toEqual({ forceRepeatable: false });
    expect(migrationRegistry.run.mock.calls[1]?.[1]).toEqual({ forceRepeatable: true });
    for (const init of domainInits) {
      expect(init).toHaveBeenCalledTimes(2);
    }
    expect(migrationResults[0]).toMatchObject({ status: 'reapplied' });
    expect(migrations[0]).toMatchObject({ id: 'R001_MEMORY_SCHEMA' });
    await expect(store.getPool()).resolves.toBe(pool);
    expect(store.getPoolManager()).toBe(poolManager);
    expect(store.db).toBeTruthy();

    await store.disconnect();
    await store.close();
    expect(poolManager.close).not.toHaveBeenCalled();
  });

  it('wraps migration failures and resets in-flight migration state', async () => {
    const store = new OracleStore({
      id: 'oracle-store-unit-error',
      poolManager: { getPool: vi.fn(), close: vi.fn() } as any,
    });
    (store as any).migrationRegistry = {
      run: vi.fn(async () => {
        throw new Error('migration failed');
      }),
      list: vi.fn(),
    };

    await expect(store.migrate()).rejects.toThrow(/migration failed/i);
    expect((store as any).migrationPromise).toBeUndefined();
    expect((store as any).initPromise).toBeUndefined();
  });
});

describe('OracleStore first-PR domains', () => {
  it('exposes only the selected storage domains', () => {
    const store = new OracleStore({
      id: 'first-pr-domain-test',
      pool: {} as any,
    });

    expect(Object.keys(store.stores).sort()).toEqual([
      'agents',
      'mcpClients',
      'memory',
      'observability',
      'scorerDefinitions',
      'scores',
      'workflows',
    ]);
  });

  it('registers only selected storage migrations', () => {
    const store = new OracleStore({
      id: 'first-pr-migrations-test',
      pool: {} as any,
    });

    const migrations = (
      store as unknown as {
        storageMigrations: () => Array<{ id: string }>;
      }
    ).storageMigrations();

    expect(migrations.map(migration => migration.id)).toEqual([
      'R001_MEMORY_SCHEMA',
      'R002_WORKFLOWS_SCHEMA',
      'R003_OBSERVABILITY_SCHEMA',
      'R004_SCORES_SCHEMA',
      'R005_SCORER_DEFINITIONS_SCHEMA',
      'R006_MCP_CLIENTS_SCHEMA',
      'R007_AGENTS_SCHEMA',
    ]);
  });

  it('assigns stable checksums to repeatable storage migrations', () => {
    const store = new OracleStore({
      id: 'repeatable-checksum-test',
      pool: {} as any,
    });

    const migrations = (
      store as unknown as {
        storageMigrations: () => Array<{ checksum?: string }>;
      }
    ).storageMigrations();

    expect(migrations.every(migration => /^[A-F0-9]{64}$/.test(migration.checksum ?? ''))).toBe(true);
  });

  it('rejects invalid message batch sizes at construction time', () => {
    expect(
      () =>
        new OracleStore({
          id: 'invalid-message-batch',
          pool: {} as any,
          messageBatchSize: 0,
        }),
    ).toThrow(/messageBatchSize/i);
  });
});
