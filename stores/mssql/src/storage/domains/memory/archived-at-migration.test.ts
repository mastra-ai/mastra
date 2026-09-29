import sql from 'mssql';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MSSQLStore } from '../../index';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const config = {
  server: process.env.MSSQL_HOST || 'localhost',
  port: Number(process.env.MSSQL_PORT) || 1433,
  database: process.env.MSSQL_DB || 'master',
  user: process.env.MSSQL_USER || 'sa',
  password: process.env.MSSQL_PASSWORD || 'Your_password123',
};

describe.runIf(process.env.ENABLE_TESTS === 'true')('threads archivedAt migration', () => {
  const schemaName = `archived_migration_${Date.now()}`;
  let pool: sql.ConnectionPool;
  let store: MSSQLStore;

  beforeAll(async () => {
    pool = new sql.ConnectionPool({ ...config, options: { encrypt: true, trustServerCertificate: true } });
    await pool.connect();
    await pool.request().query(`CREATE SCHEMA ${schemaName}`);
    // Given a threads table created before archivedAt existed, holding one legacy row
    await pool.request().query(`CREATE TABLE [${schemaName}].[mastra_threads] (
      id NVARCHAR(255) PRIMARY KEY, [resourceId] NVARCHAR(255) NOT NULL, title NVARCHAR(MAX) NOT NULL,
      metadata NVARCHAR(MAX), [createdAt] DATETIME2 NOT NULL, [updatedAt] DATETIME2 NOT NULL)`);
    await pool
      .request()
      .query(
        `INSERT INTO [${schemaName}].[mastra_threads] VALUES ('legacy-thread', 'legacy-resource', 'Legacy', '{}', SYSUTCDATETIME(), SYSUTCDATETIME())`,
      );

    // When the store initializes
    store = new MSSQLStore({ id: 'archived-migration', ...config, schemaName });
    await store.init();
  });

  afterAll(async () => {
    await store?.close();
    const tables = await pool
      .request()
      .query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = '${schemaName}'`);
    for (const row of tables.recordset) {
      await pool.request().query(`DROP TABLE [${schemaName}].[${row.TABLE_NAME}]`);
    }
    await pool.request().query(`DROP SCHEMA ${schemaName}`);
    await pool.close();
  });

  it('adds the archivedAt column and reads legacy rows as non-archived', async () => {
    const columns = await pool
      .request()
      .query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '${schemaName}' AND TABLE_NAME = 'mastra_threads'`,
      );
    expect(columns.recordset.map(c => c.COLUMN_NAME)).toContain('archivedAt');

    const memory = (await store.getStore('memory'))!;
    const thread = await memory.getThreadById({ threadId: 'legacy-thread' });
    expect(thread?.archivedAt ?? null).toBeNull();
    const active = await memory.listThreads({ filter: { resourceId: 'legacy-resource', archived: false } });
    expect(active.threads.map(t => t.id)).toEqual(['legacy-thread']);
  });
});
