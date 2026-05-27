import { randomUUID } from 'node:crypto';
import { createObservabilityVNextTests } from '@internal/storage-test-utils';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { PoolAdapter } from './client';
import { ObservabilityPG } from './domains/observability';
import { ObservabilityStoragePostgresVNext } from './domains/observability/v-next';
import { TEST_CONFIG } from './test-utils';
import { PostgresStore, PostgresStoreVNext } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const integrationEnabled = process.env.PG_VNEXT_INTEGRATION_TESTS === '1';
const TIMESCALE_URL = process.env.PG_VNEXT_TIMESCALE_URL ?? 'postgres://postgres:postgres@localhost:5435/mastra';

/**
 * The local `TEST_CONFIG` is a host-based primary config (typed as the union
 * `PostgresStoreConfig`, so we cast for the field reads). For tests we point
 * `observability` at the same DB instance — the constructor will log the
 * collision warning, which is fine in tests but exactly the production
 * anti-pattern callers should avoid.
 */
const hostConfig = TEST_CONFIG as {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
};
const observabilityFromTestConfig: Parameters<typeof PostgresStoreVNext>[0]['observability'] = {
  host: hostConfig.host,
  port: hostConfig.port,
  database: hostConfig.database,
  user: hostConfig.user,
  password: hostConfig.password,
  max: 2,
};
const primaryTestConfig = { ...TEST_CONFIG, max: 2 };

function parseConnectionString(url: string) {
  const parsed = new URL(url);
  return {
    connectionString: url,
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 5432,
    database: parsed.pathname.replace(/^\//, ''),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
}

describe('PostgresStoreVNext', () => {
  describe('domain wiring', () => {
    const store = new PostgresStoreVNext({ ...primaryTestConfig, observability: observabilityFromTestConfig });

    afterAll(async () => {
      await store.close();
    });

    it('wires the vNext observability domain', () => {
      expect(store.stores.observability).toBeInstanceOf(ObservabilityStoragePostgresVNext);
    });

    it('does not use the legacy observability domain', () => {
      expect(store.stores.observability).not.toBeInstanceOf(ObservabilityPG);
    });

    it('still subclasses PostgresStore', () => {
      expect(store).toBeInstanceOf(PostgresStore);
    });

    it('exposes vNext observability through getStore()', async () => {
      const observability = await store.getStore('observability');
      expect(observability).toBeInstanceOf(ObservabilityStoragePostgresVNext);
    });

    it('identifies as PostgresStoreVNext via the name field', () => {
      expect(store.name).toBe('PostgresStoreVNext');
    });

    it('declares the insert-only observability strategy', () => {
      const observability = store.stores.observability as ObservabilityStoragePostgresVNext;
      expect(observability.observabilityStrategy).toEqual({
        preferred: 'insert-only',
        supported: ['insert-only'],
      });
    });
  });

  describe('initialization', () => {
    it('runs init() end-to-end without throwing', async () => {
      const store = new PostgresStoreVNext({
        ...primaryTestConfig,
        id: 'pgvnext-init-test',
        observability: observabilityFromTestConfig,
      });

      try {
        await store.init();
        const observability = store.stores.observability as ObservabilityStoragePostgresVNext;
        expect(['native', 'partman', 'timescale']).toContain(observability.partitionMode);
      } finally {
        await store.close();
      }
    });

    it('honors an explicit partitioning.mode override', async () => {
      const store = new PostgresStoreVNext({
        ...primaryTestConfig,
        id: 'pgvnext-explicit-mode-test',
        observability: { ...observabilityFromTestConfig, partitioning: { mode: 'native' } },
      });
      try {
        await store.init();
        const observability = store.stores.observability as ObservabilityStoragePostgresVNext;
        expect(observability.partitionMode).toBe('native');
      } finally {
        await store.close();
      }
    });
  });
});

describe.skipIf(!integrationEnabled)('PostgresStoreVNext / shared observability suite', () => {
  let sharedSchema: string | undefined;
  let sharedClient: PoolAdapter | undefined;
  let sharedPool: Pool | undefined;
  let sharedStorage: ObservabilityStoragePostgresVNext | undefined;

  beforeAll(async () => {
    const connection = parseConnectionString(TIMESCALE_URL);
    sharedSchema = `pgvnext_shared_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
    sharedPool = new Pool({ connectionString: connection.connectionString, max: 2 });
    sharedClient = new PoolAdapter(sharedPool);
    await sharedClient.none('CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE');
    await sharedClient.none(`CREATE SCHEMA IF NOT EXISTS "${sharedSchema}"`);

    sharedStorage = new ObservabilityStoragePostgresVNext({
      client: sharedClient,
      schemaName: sharedSchema,
    });
    await sharedStorage.init();
  });
  afterAll(async () => {
    try {
      if (sharedClient && sharedSchema) {
        await sharedClient.none(`DROP SCHEMA IF EXISTS "${sharedSchema}" CASCADE`);
      }
      if (sharedPool) {
        await sharedPool.end();
      }
    } finally {
      sharedStorage = undefined;
      sharedSchema = undefined;
      sharedClient = undefined;
      sharedPool = undefined;
    }
  });

  createObservabilityVNextTests({
    getStorage: async () => {
      if (!sharedStorage) {
        throw new Error('shared observability storage was not initialized');
      }
      return sharedStorage;
    },
    capabilities: {
      label: 'Postgres vNext',
      preferredStrategy: 'insert-only',
    },
    cleanup: async storage => {
      await storage.dangerouslyClearAll();
    },
  });
});
