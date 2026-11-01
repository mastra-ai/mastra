import { randomUUID } from 'node:crypto';
import type { MemoryStorage, RunFence } from '@mastra/core/storage';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '../../index';
import { connectionString, TEST_CONFIG } from '../../test-utils';

const ROUNDS = 25;

describe('PostgreSQL thread metadata writes across processes', () => {
  const schemaName = `thread_meta_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  let stores: PostgresStore[];
  let a: MemoryStorage;
  let b: MemoryStorage;

  beforeAll(async () => {
    // Each PostgresStore has its own pool, so two stores stand in for two processes.
    stores = [0, 1].map(i => new PostgresStore({ ...TEST_CONFIG, id: `${schemaName}-${i}`, schemaName }));
    await stores[0]!.init();
    await stores[1]!.init();
    [a, b] = (await Promise.all(stores.map(store => store.getStore('memory')))) as MemoryStorage[];
  });

  afterAll(async () => {
    await Promise.all(stores.map(store => store.close().catch(() => {})));
    const pool = new Pool({ connectionString });
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await pool.end();
  });

  async function createThread(resourceId = 'resource') {
    const now = new Date();
    const thread = {
      id: randomUUID(),
      resourceId,
      title: 'thread',
      metadata: { seed: true },
      createdAt: now,
      updatedAt: now,
    };
    await a.saveThread({ thread });
    return thread;
  }

  function expectAllKeys(metadata: Record<string, unknown> | undefined) {
    const expected: Record<string, unknown> = { seed: true };
    for (let i = 0; i < ROUNDS; i++) {
      expected[`a${i}`] = i;
      expected[`b${i}`] = i;
    }
    expect(metadata).toEqual(expected);
  }

  it('updateThread keeps every key when two processes write concurrently', async () => {
    const { id } = await createThread();
    for (let i = 0; i < ROUNDS; i++) {
      await Promise.all([
        a.updateThread({ id, metadata: { [`a${i}`]: i } }),
        b.updateThread({ id, metadata: { [`b${i}`]: i } }),
      ]);
    }
    expectAllKeys((await a.getThreadById({ threadId: id }))?.metadata);
  });

  it('updateThreadMetadata keeps every key when two processes write whole objects concurrently', async () => {
    const { id } = await createThread();
    for (let i = 0; i < ROUNDS; i++) {
      await Promise.all([
        a.updateThreadMetadata({ id, update: thread => ({ ...thread.metadata, [`a${i}`]: i }) }),
        b.updateThreadMetadata({ id, update: thread => ({ ...thread.metadata, [`b${i}`]: i }) }),
      ]);
    }
    expectAllKeys((await a.getThreadById({ threadId: id }))?.metadata);
  });

  it('updateThread still updates the title alone and rejects a missing thread', async () => {
    const { id } = await createThread();
    const updated = await a.updateThread({ id, title: 'renamed' });
    expect(updated.title).toBe('renamed');
    expect(updated.metadata).toEqual({ seed: true });
    await expect(a.updateThread({ id: randomUUID(), title: 'x' })).rejects.toThrow(/not found/);
  });

  it('updateThread leaves non-object metadata untouched on a title-only update', async () => {
    const { id } = await createThread();
    const pool = new Pool({ connectionString });
    try {
      await pool.query(`UPDATE "${schemaName}".mastra_threads SET metadata = '[1,2]' WHERE id = $1`, [id]);
    } finally {
      await pool.end();
    }
    expect((await a.updateThread({ id, title: 'renamed' })).metadata).toEqual([1, 2]);
    expect((await a.updateThread({ id, metadata: { k: 1 } })).metadata).toEqual({ k: 1 });
  });

  it('updateThreadMetadata respects resourceId, missing threads, and no-op updates', async () => {
    const thread = await createThread('owner');
    expect(await a.updateThreadMetadata({ id: thread.id, resourceId: 'other', update: () => ({ x: 1 }) })).toBeNull();
    expect(await a.updateThreadMetadata({ id: randomUUID(), update: () => ({ x: 1 }) })).toBeNull();

    const before = await a.getThreadById({ threadId: thread.id });
    const unchanged = await a.updateThreadMetadata({ id: thread.id, update: () => undefined });
    expect(unchanged?.metadata).toEqual({ seed: true });
    expect(unchanged?.updatedAt).toEqual(before?.updatedAt);

    const merged = await a.updateThreadMetadata({ id: thread.id, resourceId: 'owner', update: () => ({ x: 1 }) });
    expect(merged?.metadata).toEqual({ seed: true, x: 1 });
  });

  it('updateThreadMetadata rejects a stale fence', async () => {
    const { id } = await createThread();
    const runId = randomUUID();
    const fenceA: RunFence = { runId, generation: 1, ownerId: 'a' };
    const fenceB: RunFence = { runId, generation: 2, ownerId: 'b' };
    expect(await a.raiseRunFence(fenceA)).toBe(true);
    await a.updateThreadMetadata({ id, fence: fenceA, update: () => ({ fenced: 'a' }) });
    expect(await b.raiseRunFence(fenceB)).toBe(true);

    await expect(a.updateThreadMetadata({ id, fence: fenceA, update: () => ({ fenced: 'stale' }) })).rejects.toThrow();
    expect((await b.getThreadById({ threadId: id }))?.metadata).toEqual({ seed: true, fenced: 'a' });
  });
});
