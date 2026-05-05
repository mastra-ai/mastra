import { createClient } from '@clickhouse/client';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { MemoryStorageClickhouse } from './domains/memory';
import { ObservabilityStorageClickhouse } from './domains/observability';
import { ObservabilityStorageClickhouseVNext } from './domains/observability/v-next';
import { ScoresStorageClickhouse } from './domains/scores';
import { WorkflowsStorageClickhouse } from './domains/workflows';
import { ClickhouseStoreVNext } from '.';
import type { ClickhouseConfig } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const TEST_CONFIG: ClickhouseConfig = {
  id: 'clickhouse-vnext-test',
  url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USERNAME || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || 'password',
};

describe('ClickhouseStoreVNext', () => {
  describe('domain wiring', () => {
    const store = new ClickhouseStoreVNext(TEST_CONFIG);

    afterAll(async () => {
      await store.close();
    });

    it('wires the vNext observability domain', () => {
      expect(store.stores.observability).toBeInstanceOf(ObservabilityStorageClickhouseVNext);
    });

    it('does not use the legacy observability domain', () => {
      expect(store.stores.observability).not.toBeInstanceOf(ObservabilityStorageClickhouse);
    });

    it('keeps the standard ClickHouse memory, workflows, and scores domains', () => {
      expect(store.stores.memory).toBeInstanceOf(MemoryStorageClickhouse);
      expect(store.stores.workflows).toBeInstanceOf(WorkflowsStorageClickhouse);
      expect(store.stores.scores).toBeInstanceOf(ScoresStorageClickhouse);
    });

    it('exposes vNext observability through getStore()', async () => {
      const observability = await store.getStore('observability');
      expect(observability).toBeInstanceOf(ObservabilityStorageClickhouseVNext);
    });

    it('identifies as ClickhouseStoreVNext via the name field', () => {
      expect(store.name).toBe('ClickhouseStoreVNext');
    });
  });

  describe('configuration forms', () => {
    it('accepts a pre-configured ClickHouse client', async () => {
      const client = createClient({
        url: TEST_CONFIG.url,
        username: TEST_CONFIG.username,
        password: TEST_CONFIG.password,
      });
      const store = new ClickhouseStoreVNext({ id: 'vnext-client-config', client });

      try {
        expect(store.stores.observability).toBeInstanceOf(ObservabilityStorageClickhouseVNext);
      } finally {
        await store.close();
      }
    });

    it('rejects empty url like ClickhouseStore does', () => {
      expect(
        () =>
          new ClickhouseStoreVNext({
            id: 'invalid',
            url: '',
            username: 'default',
            password: 'password',
          }),
      ).toThrow(/url is required/i);
    });
  });

  describe('initialization', () => {
    it('runs init() end-to-end without throwing', async () => {
      const store = new ClickhouseStoreVNext({ ...TEST_CONFIG, id: 'vnext-init-test' });

      try {
        await expect(store.init()).resolves.not.toThrow();
      } finally {
        await store.close();
      }
    });
  });
});
