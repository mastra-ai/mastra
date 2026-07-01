import { createSampleThreadWithParams } from '@internal/storage-test-utils';
import type { StorageThreadType } from '@mastra/core/memory';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LibSQLStore } from './index';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

/**
 * Fresh, isolated in-memory DB per test. A bare `:memory:` url gives each
 * `LibSQLStore` its own private in-memory database (no shared cache), so seeded
 * rows never leak across cases.
 */
function newStore(id: string) {
  return new LibSQLStore({ id, url: ':memory:' });
}

const DAY = 24 * 60 * 60 * 1000;

async function seedThread(store: LibSQLStore, id: string, ageDays: number): Promise<StorageThreadType> {
  const at = new Date(Date.now() - ageDays * DAY);
  const memory = store.stores.memory!;
  const thread = createSampleThreadWithParams(id, `resource-${id}`, at, at) as StorageThreadType;
  await memory.saveThread({ thread });
  return thread;
}

async function threadIds(store: LibSQLStore): Promise<string[]> {
  const memory = store.stores.memory!;
  const { threads } = await memory.listThreads({ perPage: false });
  return threads.map(t => t.id).sort();
}

describe('LibSQL retention', () => {
  let store: LibSQLStore;

  beforeEach(async () => {
    store = newStore(`retention-${Math.random().toString(36).slice(2)}`);
    await store.init();
  });

  describe('prune()', () => {
    it('deletes rows older than maxAge and keeps newer ones', async () => {
      await seedThread(store, 'old-1', 40);
      await seedThread(store, 'old-2', 40);
      await seedThread(store, 'new-1', 5);

      const results = await store.stores.memory!.prune({ threads: { maxAge: '30d' } });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ domain: 'memory', table: 'mastra_threads', done: true });
      expect(results[0]!.deleted).toBe(2);
      expect(await threadIds(store)).toEqual(['new-1']);
    });

    it('keeps a row exactly at the cutoff and deletes one just past it (strict <)', async () => {
      // Seeded ages are relative to Date.now(); a 30d-old row sits ~at the cutoff.
      // Use a clearly-older and a clearly-newer row to avoid millisecond flakiness.
      await seedThread(store, 'boundary-older', 31);
      await seedThread(store, 'boundary-newer', 29);

      await store.stores.memory!.prune({ threads: { maxAge: '30d' } });

      expect(await threadIds(store)).toEqual(['boundary-newer']);
    });

    it('leaves unset tables untouched (unset = keep forever)', async () => {
      await seedThread(store, 'old-1', 90);

      // No policy for threads => nothing deleted.
      const results = await store.stores.memory!.prune({});
      expect(results).toEqual([]);
      expect(await threadIds(store)).toEqual(['old-1']);
    });

    it('deletes across multiple batches when over batchSize', async () => {
      for (let i = 0; i < 5; i++) await seedThread(store, `old-${i}`, 40);

      const results = await store.stores.memory!.prune({ threads: { maxAge: '30d', batchSize: 2 } });

      expect(results[0]!.deleted).toBe(5);
      expect(results[0]!.done).toBe(true);
      expect(await threadIds(store)).toEqual([]);
    });

    it('is bounded and resumable via maxRows', async () => {
      for (let i = 0; i < 5; i++) await seedThread(store, `old-${i}`, 40);

      const first = await store.stores.memory!.prune({ threads: { maxAge: '30d' } }, { maxRows: 2 });
      expect(first[0]!.deleted).toBe(2);
      expect(first[0]!.done).toBe(false);
      expect((await threadIds(store)).length).toBe(3);

      const second = await store.stores.memory!.prune({ threads: { maxAge: '30d' } });
      expect(second[0]!.deleted).toBe(3);
      expect(second[0]!.done).toBe(true);
      expect(await threadIds(store)).toEqual([]);
    });

    it('is bounded by maxBatches', async () => {
      for (let i = 0; i < 5; i++) await seedThread(store, `old-${i}`, 40);

      const results = await store.stores.memory!.prune({ threads: { maxAge: '30d', batchSize: 1 } }, { maxBatches: 2 });

      expect(results[0]!.deleted).toBe(2);
      expect(results[0]!.done).toBe(false);
      expect((await threadIds(store)).length).toBe(3);
    });

    it('stops on a pre-aborted signal and reports done:false', async () => {
      for (let i = 0; i < 3; i++) await seedThread(store, `old-${i}`, 40);

      const controller = new AbortController();
      controller.abort();

      const results = await store.stores.memory!.prune({ threads: { maxAge: '30d' } }, { signal: controller.signal });

      expect(results[0]).toMatchObject({ deleted: 0, done: false });
      expect((await threadIds(store)).length).toBe(3);
    });
  });

  describe('composite prune()', () => {
    it('routes per-table policies to the memory domain via retention config', async () => {
      const configured = new LibSQLStore({
        id: `retention-cfg-${Math.random().toString(36).slice(2)}`,
        url: ':memory:',
        retention: { memory: { threads: { maxAge: '30d' } } },
      });
      await configured.init();
      await seedThread(configured, 'old-1', 40);
      await seedThread(configured, 'new-1', 5);

      const results = await configured.prune();

      expect(results.map(r => r.table)).toContain('mastra_threads');
      expect(await threadIds(configured)).toEqual(['new-1']);
    });

    it('is a no-op returning [] when no retention is configured', async () => {
      await seedThread(store, 'old-1', 90);
      expect(await store.prune()).toEqual([]);
      expect(await threadIds(store)).toEqual(['old-1']);
    });
  });

  describe('vacuum()', () => {
    it('runs VACUUM once for the underlying file and reports vacuumed:true', async () => {
      const results = await store.vacuum();
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ vacuumed: true });
    });

    it('skips VACUUM on a remote/embedded-replica connection', async () => {
      const remote = new LibSQLStore({
        id: 'retention-remote',
        url: 'libsql://example.turso.io',
        authToken: 'token',
      });
      const [result] = await remote.vacuum();
      expect(result).toMatchObject({ vacuumed: false });
      expect(result!.skipped).toBeTruthy();
    });
  });
});
