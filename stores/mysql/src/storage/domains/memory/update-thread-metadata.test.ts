import type { MemoryStorage } from '@mastra/core/storage';
import { createPool } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MySQLStore } from '../../index';

const ROOT_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_ROOT_USER || 'root',
  password: process.env.MYSQL_ROOT_PASSWORD || 'root',
};

const database = `update_thread_meta_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

describe('MemoryMySQL.updateThread metadata', () => {
  let storeA: MySQLStore;
  let storeB: MySQLStore;
  let a: MemoryStorage;
  let b: MemoryStorage;

  beforeAll(async () => {
    const admin = createPool({ ...ROOT_CONFIG, connectionLimit: 1 });
    await admin.query(`CREATE DATABASE \`${database}\``);
    await admin.end();
    // Each MySQLStore has its own pool, so two stores stand in for two processes.
    storeA = new MySQLStore({ ...ROOT_CONFIG, database, id: 'update-thread-meta-a' });
    storeB = new MySQLStore({ ...ROOT_CONFIG, database, id: 'update-thread-meta-b' });
    await storeA.init();
    await storeB.init();
    a = (await storeA.getStore('memory'))!;
    b = (await storeB.getStore('memory'))!;
  });

  afterAll(async () => {
    await Promise.all([storeA?.close(), storeB?.close()].map(p => p?.catch(() => {})));
    const admin = createPool({ ...ROOT_CONFIG, connectionLimit: 1 });
    await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await admin.end();
  });

  const seed = (id: string) =>
    a.saveThread({
      thread: {
        id,
        resourceId: 'resource-1',
        title: 'Original title',
        metadata: { seeded: true },
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    });

  it('keeps a metadata write that lands while a title-only update is in flight', async () => {
    await seed('thread-race');
    // Process B commits new metadata just before process A's thread UPDATE runs.
    const pool = (a as any).pool;
    const execute = pool.execute.bind(pool);
    let raced = false;
    vi.spyOn(pool, 'execute').mockImplementation((async (sql: string, args?: unknown[]) => {
      if (!raced && /^\s*UPDATE\s+`?mastra_threads/i.test(sql)) {
        raced = true;
        await b.updateThread({ id: 'thread-race', metadata: { progress: 'observed' } });
      }
      return execute(sql, args);
    }) as any);

    const updated = await a.updateThread({ id: 'thread-race', title: 'New title' });
    vi.restoreAllMocks();

    expect(raced).toBe(true);
    const stored = await a.getThreadById({ threadId: 'thread-race' });
    expect(stored?.title).toBe('New title');
    expect(stored?.metadata).toEqual({ seeded: true, progress: 'observed' });
    expect(updated.title).toBe('New title');
    expect(updated.metadata).toEqual({ seeded: true, progress: 'observed' });
  });

  it('still merges metadata when it is passed', async () => {
    await seed('thread-merge');
    const updated = await a.updateThread({ id: 'thread-merge', metadata: { added: 1 } });

    expect(updated.title).toBe('Original title');
    expect(updated.metadata).toEqual({ seeded: true, added: 1 });
    expect((await a.getThreadById({ threadId: 'thread-merge' }))?.metadata).toEqual({ seeded: true, added: 1 });
  });

  it('throws not found for a title-only update of a missing thread', async () => {
    await expect(a.updateThread({ id: 'missing', title: 'x' })).rejects.toThrow('Thread missing not found');
  });
});
