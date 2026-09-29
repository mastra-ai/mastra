import { createPool } from 'mysql2/promise';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MySQLStore } from '../../index';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const host = process.env.MYSQL_HOST || 'localhost';
const port = Number(process.env.MYSQL_PORT) || 3306;
const database = `archived_migration_${Date.now()}`;

describe('threads archivedAt migration', () => {
  let admin: Pool;
  let store: MySQLStore;

  beforeAll(async () => {
    admin = createPool({ host, port, user: 'root', password: process.env.MYSQL_ROOT_PASSWORD || 'root' });
    await admin.query(`CREATE DATABASE \`${database}\``);
    // Given a threads table created before archivedAt existed, holding one legacy row
    await admin.query(`CREATE TABLE \`${database}\`.mastra_threads (
      id VARCHAR(255) PRIMARY KEY, resourceId VARCHAR(255) NOT NULL, title TEXT NOT NULL, metadata JSON,
      createdAt DATETIME(3) NOT NULL, updatedAt DATETIME(3) NOT NULL)`);
    await admin.query(
      `INSERT INTO \`${database}\`.mastra_threads VALUES ('legacy-thread', 'legacy-resource', 'Legacy', '{}', NOW(3), NOW(3))`,
    );

    // When the store initializes
    store = new MySQLStore({
      id: 'archived-migration',
      host,
      port,
      user: 'root',
      password: process.env.MYSQL_ROOT_PASSWORD || 'root',
      database,
    });
    await store.init();
  });

  afterAll(async () => {
    await store?.close();
    await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await admin.end();
  });

  it('adds the archivedAt column and reads legacy rows as non-archived', async () => {
    const [columns] = await admin.query<RowDataPacket[]>(
      `SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE table_schema = ? AND table_name = 'mastra_threads'`,
      [database],
    );
    expect(columns.map(c => c.name)).toContain('archivedAt');

    const memory = (await store.getStore('memory'))!;
    const thread = await memory.getThreadById({ threadId: 'legacy-thread' });
    expect(thread?.archivedAt ?? null).toBeNull();
    const active = await memory.listThreads({ filter: { resourceId: 'legacy-resource', archived: false } });
    expect(active.threads.map(t => t.id)).toEqual(['legacy-thread']);
  });
});
