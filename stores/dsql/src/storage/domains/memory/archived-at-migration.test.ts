import type { MemoryStorage } from '@mastra/core/storage';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DSQLStore } from '../../index';
import { canRunDSQLTests, createTestPool, TEST_CONFIG } from '../../test-utils';

const schemaName = `archived_migration_${Date.now()}`;

describe.runIf(canRunDSQLTests())('DSQL threads archivedAt migration', () => {
  let pool: Pool;
  let store: DSQLStore;
  let memory: MemoryStorage;

  beforeAll(async () => {
    pool = createTestPool();
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    // Given a threads table created before archivedAt existed, holding one legacy row
    await pool.query(`
      CREATE TABLE "${schemaName}".mastra_threads (
        id TEXT PRIMARY KEY,
        "resourceId" TEXT NOT NULL,
        title TEXT NOT NULL,
        metadata TEXT,
        "createdAt" TIMESTAMP NOT NULL,
        "createdAtZ" TIMESTAMPTZ,
        "updatedAt" TIMESTAMP NOT NULL,
        "updatedAtZ" TIMESTAMPTZ
      )`);
    await pool.query(
      `INSERT INTO "${schemaName}".mastra_threads (id, "resourceId", title, metadata, "createdAt", "createdAtZ", "updatedAt", "updatedAtZ")
       VALUES ('legacy-thread', 'legacy-resource', 'Legacy', '{}', NOW(), NOW(), NOW(), NOW())`,
    );

    // When the store initializes
    store = new DSQLStore({ ...TEST_CONFIG, id: 'dsql-archived-migration', schemaName });
    await store.init();
    memory = (await store.getStore('memory'))!;
  });

  afterAll(async () => {
    await store?.close();
    await pool?.query(`DROP TABLE IF EXISTS "${schemaName}".mastra_threads`);
    await pool?.query(`DROP SCHEMA IF EXISTS "${schemaName}"`);
    await pool?.end();
  });

  it('adds the archivedAt column and reads legacy rows as non-archived', async () => {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'mastra_threads'`,
      [schemaName],
    );
    expect(rows.map(r => r.column_name)).toContain('archivedAt');

    const thread = await memory.getThreadById({ threadId: 'legacy-thread' });
    expect(thread?.archivedAt ?? null).toBeNull();

    const { threads } = await memory.listThreads({ filter: { resourceId: 'legacy-resource', archived: false } });
    expect(threads.map(t => t.id)).toEqual(['legacy-thread']);
  });
});
