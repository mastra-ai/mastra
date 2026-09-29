import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '../../index';
import { connectionString, TEST_CONFIG } from '../../test-utils';

const schemaName = `archived_migration_${Date.now()}`;

describe('threads archivedAt migration', () => {
  let pool: Pool;
  let store: PostgresStore;

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    // Given a threads table created before archivedAt existed, holding one legacy row
    await pool.query(`
      CREATE TABLE "${schemaName}".mastra_threads (
        id TEXT PRIMARY KEY,
        "resourceId" TEXT NOT NULL,
        title TEXT NOT NULL,
        metadata JSONB,
        "createdAt" TIMESTAMP NOT NULL,
        "createdAtZ" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL,
        "updatedAtZ" TIMESTAMPTZ DEFAULT NOW()
      )`);
    await pool.query(
      `INSERT INTO "${schemaName}".mastra_threads (id, "resourceId", title, metadata, "createdAt", "updatedAt")
       VALUES ('legacy-thread', 'legacy-resource', 'Legacy', '{}', NOW(), NOW())`,
    );

    // When the store initializes
    store = new PostgresStore({ ...TEST_CONFIG, id: 'archived-migration', schemaName });
    await store.init();
  });

  afterAll(async () => {
    await store?.close();
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await pool.end();
  });

  it('adds the archivedAt column', async () => {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'mastra_threads'`,
      [schemaName],
    );
    expect(rows.map(r => r.column_name)).toContain('archivedAt');
  });

  it('reads legacy rows as non-archived', async () => {
    const memory = (await store.getStore('memory'))!;
    const thread = await memory.getThreadById({ threadId: 'legacy-thread' });
    expect(thread?.archivedAt ?? null).toBeNull();

    const active = await memory.listThreads({ filter: { resourceId: 'legacy-resource', archived: false } });
    expect(active.threads.map(t => t.id)).toEqual(['legacy-thread']);
  });

  it('can archive a legacy row', async () => {
    const memory = (await store.getStore('memory'))!;
    const archivedAt = new Date('2024-06-01T00:00:00.000Z');
    await memory.updateThread({ id: 'legacy-thread', archivedAt });
    const thread = await memory.getThreadById({ threadId: 'legacy-thread' });
    expect(new Date(thread!.archivedAt!).getTime()).toBe(archivedAt.getTime());
  });
});
