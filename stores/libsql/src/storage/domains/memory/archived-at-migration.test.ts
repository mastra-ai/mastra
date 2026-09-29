import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LibSQLStore } from '../../index';

describe('threads archivedAt migration', () => {
  const tmpDir = mkdtempSync(path.join(tmpdir(), 'libsql-archived-'));
  const url = `file:${path.join(tmpDir, 'legacy.db')}`;
  let store: LibSQLStore;

  beforeAll(async () => {
    // Given a threads table created before archivedAt existed, holding one legacy row
    const client = createClient({ url });
    await client.execute(`CREATE TABLE mastra_threads (
      id TEXT PRIMARY KEY, resourceId TEXT NOT NULL, title TEXT NOT NULL, metadata TEXT,
      createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL)`);
    await client.execute(
      `INSERT INTO mastra_threads VALUES ('legacy-thread', 'legacy-resource', 'Legacy', '{}', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')`,
    );
    client.close();

    // When the store initializes
    store = new LibSQLStore({ id: 'archived-migration', url });
    await store.init();
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('adds the archivedAt column and reads legacy rows as non-archived', async () => {
    const client = createClient({ url });
    const columns = await client.execute(`PRAGMA table_info(mastra_threads)`);
    client.close();
    expect(columns.rows.map(r => r.name)).toContain('archivedAt');

    const memory = (await store.getStore('memory'))!;
    const thread = await memory.getThreadById({ threadId: 'legacy-thread' });
    expect(thread?.archivedAt ?? null).toBeNull();
    const active = await memory.listThreads({ filter: { resourceId: 'legacy-resource', archived: false } });
    expect(active.threads.map(t => t.id)).toEqual(['legacy-thread']);
  });
});
