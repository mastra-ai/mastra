import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryStorageDO } from './index';

// Minimal stand-in for the Durable Object `SqlStorage` API backed by real SQLite.
function makeSql(db: DatabaseSync) {
  return {
    exec(query: string, ...params: unknown[]) {
      const stmt = db.prepare(query);
      const rows =
        stmt.columns().length > 0 ? stmt.all(...(params as never[])) : (stmt.run(...(params as never[])), []);
      return { toArray: () => rows };
    },
  };
}

describe('MemoryStorageDO thread archiving', () => {
  let db: DatabaseSync;
  let memory: MemoryStorageDO;

  beforeEach(async () => {
    db = new DatabaseSync(':memory:');
    memory = new MemoryStorageDO({ sql: makeSql(db) as never });
    await memory.init();
  });

  async function givenThread(id: string) {
    const createdAt = new Date('2024-01-01T00:00:00.000Z');
    await memory.saveThread({
      thread: { id, resourceId: 'resource-1', title: id, metadata: {}, createdAt, updatedAt: createdAt },
    });
  }

  async function ids(archived?: boolean) {
    const { threads, total } = await memory.listThreads({ filter: { resourceId: 'resource-1', archived } });
    return { ids: threads.map(t => t.id).sort(), total };
  }

  it('filters threads by archive state without bumping updatedAt', async () => {
    await givenThread('a');
    await givenThread('b');
    const archivedAt = new Date('2024-02-01T00:00:00.000Z');

    const updated = await memory.updateThread({ id: 'a', archivedAt });

    expect(updated.updatedAt.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    expect((await memory.getThreadById({ threadId: 'a' }))?.archivedAt?.toISOString()).toBe(archivedAt.toISOString());
    expect(await ids(true)).toEqual({ ids: ['a'], total: 1 });
    expect(await ids(false)).toEqual({ ids: ['b'], total: 1 });
    expect(await ids()).toEqual({ ids: ['a', 'b'], total: 2 });
  });

  it('keeps archivedAt on title updates and clears it on null', async () => {
    await givenThread('a');
    await memory.updateThread({ id: 'a', archivedAt: new Date() });

    await memory.updateThread({ id: 'a', title: 'renamed' });
    expect((await memory.getThreadById({ threadId: 'a' }))?.archivedAt).toBeInstanceOf(Date);

    await memory.updateThread({ id: 'a', archivedAt: null });
    expect((await memory.getThreadById({ threadId: 'a' }))?.archivedAt).toBeNull();
  });

  it('migrates a legacy threads table so existing rows read as non-archived', async () => {
    const legacy = new DatabaseSync(':memory:');
    legacy.exec(
      `CREATE TABLE mastra_threads (id TEXT PRIMARY KEY, resourceId TEXT, title TEXT, metadata TEXT, createdAt TEXT, updatedAt TEXT)`,
    );
    legacy
      .prepare(`INSERT INTO mastra_threads VALUES (?, ?, ?, ?, ?, ?)`)
      .run('legacy', 'resource-1', 'old', '{}', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z');

    const store = new MemoryStorageDO({ sql: makeSql(legacy) as never });
    await store.init();

    const columns = legacy.prepare(`PRAGMA table_info(mastra_threads)`).all() as { name: string }[];
    expect(columns.map(c => c.name)).toContain('archivedAt');
    expect((await store.getThreadById({ threadId: 'legacy' }))?.archivedAt).toBeNull();
    const { threads } = await store.listThreads({ filter: { archived: false } });
    expect(threads.map(t => t.id)).toEqual(['legacy']);
  });
});
