import { createKnowledgeStorageTests } from '@internal/storage-test-utils';
import {
  KNOWLEDGE_STORAGE_CONTRACT_VERSION,
  KNOWLEDGE_STORAGE_SCHEMA_VERSION,
  KnowledgeSchemaError,
  TABLE_KNOWLEDGE_SCHEMA,
} from '@mastra/core/storage';
import { createPool } from 'mysql2/promise';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { StoreOperationsMySQL } from '../operations';
import { KnowledgeMySQL, mysqlSql } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const database = process.env.MYSQL_DB || 'mastra';
const pool = createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'mastra',
  password: process.env.MYSQL_PASSWORD || 'mastra',
  database,
  connectionLimit: 10,
  dateStrings: true,
});
const operations = new StoreOperationsMySQL({ pool, database });

function createStore() {
  return new KnowledgeMySQL({ pool, operations });
}

createKnowledgeStorageTests(createStore);

describe('MySQL canonical Knowledge support', () => {
  it('normalizes canonical SQL without rewriting string literals', () => {
    expect(mysqlSql(`SELECT nodeId FROM "mastra_knowledge_nodes" WHERE name='nodeId'`)).toBe(
      `SELECT nodeId FROM \`mastra_knowledge_nodes\` WHERE name='nodeId'`,
    );
    expect(mysqlSql('INSERT INTO "mastra_knowledge_schema" (id) VALUES (?) ON DUPLICATE KEY UPDATE id=id')).toBe(
      'INSERT INTO `mastra_knowledge_schema` (id) VALUES (?) ON DUPLICATE KEY UPDATE id=id',
    );
    expect(mysqlSql('SELECT json(o.scopeIds) AS scopeIdsJson FROM "outbox" o')).toBe(
      'SELECT o.scopeIds AS scopeIdsJson FROM `outbox` o',
    );
    expect(mysqlSql('VALUES (jsonb(?))')).toBe('VALUES (?)');
  });

  it('advertises the canonical contract and exports every managed table', () => {
    const store = createStore();
    expect(store.getCapabilities()).toEqual({
      supported: true,
      contractVersion: KNOWLEDGE_STORAGE_CONTRACT_VERSION,
      schemaVersion: KNOWLEDGE_STORAGE_SCHEMA_VERSION,
    });
    const ddl = KnowledgeMySQL.getExportDDL();
    expect(ddl).toHaveLength(15);
    expect(ddl.every(statement => statement.includes('mastra_knowledge_'))).toBe(true);
  });

  it('persists the schema completion marker', async () => {
    const store = createStore();
    await store.init();
    const [rows] = await pool.query(`SELECT version FROM \`${TABLE_KNOWLEDGE_SCHEMA}\` WHERE id='canonical'`);
    expect(Number((rows as Array<{ version: number }>)[0]?.version)).toBe(KNOWLEDGE_STORAGE_SCHEMA_VERSION);
  });

  it('explicitly resets retired Knowledge tables and leaves other storage untouched', async () => {
    const preserved = `knowledge_reset_preserved_${process.pid}`;
    await createStore().init();
    await pool.query(`DELETE FROM \`${TABLE_KNOWLEDGE_SCHEMA}\``);
    await pool.query('CREATE TABLE IF NOT EXISTS mastra_knowledge_cursors (id VARCHAR(64) PRIMARY KEY)');
    await pool.query(`CREATE TABLE \`${preserved}\` (id VARCHAR(64) PRIMARY KEY)`);
    try {
      await pool.query(`INSERT INTO \`${preserved}\` (id) VALUES ('kept')`);
      const store = createStore();
      await expect(store.init()).rejects.toBeInstanceOf(KnowledgeSchemaError);

      await store.dangerouslyReset();

      const [tables] = await pool.query(
        "SELECT table_name AS tableName FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'mastra_knowledge_cursors'",
      );
      expect(tables).toEqual([]);
      const [marker] = await pool.query(`SELECT version FROM \`${TABLE_KNOWLEDGE_SCHEMA}\` WHERE id='canonical'`);
      expect(Number((marker as Array<{ version: number }>)[0]?.version)).toBe(KNOWLEDGE_STORAGE_SCHEMA_VERSION);
      const [rows] = await pool.query(`SELECT id FROM \`${preserved}\``);
      expect((rows as Array<{ id: string }>).map(row => row.id)).toEqual(['kept']);
    } finally {
      await pool.query(`DROP TABLE IF EXISTS \`${preserved}\``);
    }
  });
});

afterAll(async () => {
  await pool.end();
});
