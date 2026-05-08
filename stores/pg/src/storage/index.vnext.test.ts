import { afterAll, describe, expect, it, vi } from 'vitest';

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
        partitioning: { mode: 'native' },
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
