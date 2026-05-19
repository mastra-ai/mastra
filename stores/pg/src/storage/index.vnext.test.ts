import { createObservabilityTests } from '@internal/storage-test-utils';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { ObservabilityPG } from './domains/observability';
import { ObservabilityStoragePostgresVNext } from './domains/observability/v-next';
import { TEST_CONFIG } from './test-utils';
import { PostgresStore, PostgresStoreVNext } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

describe('PostgresStoreVNext', () => {
  describe('domain wiring', () => {
    const store = new PostgresStoreVNext(TEST_CONFIG);

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
      const store = new PostgresStoreVNext({ ...TEST_CONFIG, id: 'pgvnext-init-test' });

      try {
        await expect(store.init()).resolves.not.toThrow();
        const observability = store.stores.observability as ObservabilityStoragePostgresVNext;
        expect(['native', 'partman', 'timescale']).toContain(observability.partitionMode);
      } finally {
        await store.close();
      }
    });

    it('honors an explicit partitioning.mode override', async () => {
      const store = new PostgresStoreVNext({
        ...TEST_CONFIG,
        id: 'pgvnext-explicit-mode-test',
        observability: { partitioning: { mode: 'native' } },
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

  describe('dual-connection config', () => {
    it('accepts a separate observability connection string', async () => {
      const primary = (TEST_CONFIG as { connectionString?: string }).connectionString;
      const host = (TEST_CONFIG as { host?: string }).host;
      // Same target intentionally — collision warning is emitted but the
      // store should still construct + init cleanly so tests of the new
      // shape don't require a second Postgres instance.
      const store = new PostgresStoreVNext({
        ...TEST_CONFIG,
        id: 'pgvnext-dual-conn',
        observability: primary
          ? { connectionString: primary }
          : host
            ? {
                host,
                port: (TEST_CONFIG as { port?: number }).port,
                database: (TEST_CONFIG as { database?: string }).database!,
                user: (TEST_CONFIG as { user?: string }).user!,
                password: (TEST_CONFIG as { password?: string }).password!,
              }
            : {},
      });
      try {
        await store.init();
        expect(store.stores.observability).toBeInstanceOf(ObservabilityStoragePostgresVNext);
      } finally {
        await store.close();
      }
    });
  });
});

// Run the shared observability test suite against the vNext adapter so
// updateSpan/batchUpdateSpans get skipped via the insert-only gate while
// every other listTraces/listLogs/listMetrics/listScores/listFeedback path
// (including the delta-polling and feedback userId tests) runs end-to-end.
const sharedSuiteStore = new PostgresStoreVNext({ ...TEST_CONFIG, id: 'pgvnext-shared-suite' });

describe('PostgresStoreVNext / shared observability suite', () => {
  beforeAll(async () => {
    await sharedSuiteStore.init();
  });
  afterAll(async () => {
    await sharedSuiteStore.close();
  });

  // Only run the observability tests here so we don't double-run the suite
  // that index.test.ts already covers for the legacy PostgresStore.
  createObservabilityTests({ storage: sharedSuiteStore });
});
