import { Miniflare } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { D1Store } from '../../index';

describe('threads archivedAt migration', () => {
  const mf = new Miniflare({ modules: true, script: 'export default {};', d1Databases: { TEST_DB: ':memory:' } });
  let store: D1Store;
  let db: Awaited<ReturnType<Miniflare['getD1Database']>>;

  beforeAll(async () => {
    db = await mf.getD1Database('TEST_DB');
    // Given a threads table created before archivedAt existed, holding one legacy row
    await db
      .prepare(
        `CREATE TABLE legacy_mastra_threads (id TEXT PRIMARY KEY, resourceId TEXT NOT NULL, title TEXT NOT NULL, metadata TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL)`,
      )
      .run();
    const now = new Date().toISOString();
    await db
      .prepare(`INSERT INTO legacy_mastra_threads VALUES ('legacy-thread', 'legacy-resource', 'Legacy', '{}', ?, ?)`)
      .bind(now, now)
      .run();

    // When the store initializes
    store = new D1Store({ id: 'archived-migration', binding: db as any, tablePrefix: 'legacy_' });
    await store.init();
  });

  afterAll(async () => {
    await mf.dispose();
  });

  it('adds the archivedAt column and reads legacy rows as non-archived', async () => {
    const columns = await db.prepare(`PRAGMA table_info(legacy_mastra_threads)`).all<{ name: string }>();
    expect(columns.results.map(c => c.name)).toContain('archivedAt');

    const memory = (await store.getStore('memory'))!;
    const thread = await memory.getThreadById({ threadId: 'legacy-thread' });
    expect(thread?.archivedAt ?? null).toBeNull();
    const active = await memory.listThreads({ filter: { resourceId: 'legacy-resource', archived: false } });
    expect(active.threads.map(t => t.id)).toEqual(['legacy-thread']);
  });
});
