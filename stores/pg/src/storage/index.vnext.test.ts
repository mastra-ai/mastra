import { createObservabilityVNextTests } from '@internal/storage-test-utils';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { ObservabilityPG } from './domains/observability';
import { ObservabilityStoragePostgresVNext } from './domains/observability/v-next';
import { TEST_CONFIG } from './test-utils';
import { PostgresStore, PostgresStoreVNext } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const SHARED_SUITE_PARTITION_NOW = new Date('2026-01-02T12:00:00.000Z');

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
};

describe('PostgresStoreVNext', () => {
  describe('domain wiring', () => {
    const store = new PostgresStoreVNext({ ...TEST_CONFIG, observability: observabilityFromTestConfig });

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
        ...TEST_CONFIG,
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
        ...TEST_CONFIG,
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

// Run the shared observability test suite against the vNext adapter so
// updateSpan/batchUpdateSpans get skipped via the insert-only gate while
// every other listTraces/listLogs/listMetrics/listScores/listFeedback path
// (including the delta-polling and feedback userId tests) runs end-to-end.
const sharedSuiteStore = new PostgresStoreVNext({
  ...TEST_CONFIG,
  id: 'pgvnext-shared-suite',
  observability: observabilityFromTestConfig,
});

describe('PostgresStoreVNext / shared observability suite', () => {
  let dateNowSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeAll(async () => {
    dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(SHARED_SUITE_PARTITION_NOW.getTime());
    await sharedSuiteStore.init();
  });
  afterAll(async () => {
    try {
      await sharedSuiteStore.close();
    } finally {
      dateNowSpy?.mockRestore();
    }
  });

  createObservabilityVNextTests({
    getStorage: async () => {
      const observability = await sharedSuiteStore.getStore('observability');
      if (!observability) {
        throw new Error('observability store was not initialized');
      }
      return observability;
    },
    capabilities: {
      label: 'Postgres vNext',
      preferredStrategy: 'insert-only',
    },
  });
});
