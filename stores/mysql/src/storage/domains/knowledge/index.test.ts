import { randomUUID } from 'node:crypto';
import { createKnowledgeStorageTests } from '@internal/storage-test-utils';
import {
  KnowledgeSchemaError,
  KNOWLEDGE_STORAGE_CONTRACT_VERSION,
  KNOWLEDGE_STORAGE_SCHEMA_VERSION,
  TABLE_KNOWLEDGE_SCHEMA,
} from '@mastra/core/storage';
import { createPool } from 'mysql2/promise';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { MySQLStore } from '../..';
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
    expect(ddl).toHaveLength(16);
    expect(ddl.every(statement => statement.includes('mastra_knowledge_'))).toBe(true);
  });

  it.each([false, true])('preserves incidental legacy schema on startup (populated: %s)', async populated => {
    const isolatedDatabase = `knowledge_rollout_${randomUUID().replaceAll('-', '')}`;
    const config = {
      host: process.env.MYSQL_HOST || 'localhost',
      port: Number(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_ADMIN_USER || 'root',
      password: process.env.MYSQL_ADMIN_PASSWORD || 'root',
    };
    const admin = createPool(config);
    let storage: MySQLStore | undefined;
    try {
      await admin.query(`CREATE DATABASE \`${isolatedDatabase}\``);
      storage = new MySQLStore({ ...config, id: 'rollout', database: isolatedDatabase });
      await storage.pool.query(
        'CREATE TABLE mastra_knowledge_nodes (id VARCHAR(255) PRIMARY KEY, type VARCHAR(255), INDEX legacy_type (type))',
      );
      await storage.pool.query('CREATE TABLE unrelated_sentinel (value TEXT)');
      await storage.pool.query("INSERT INTO unrelated_sentinel VALUES ('preserved')");
      if (populated) await storage.pool.query("INSERT INTO mastra_knowledge_nodes VALUES ('legacy', 'node')");
      const [before] = await storage.pool.query('SHOW CREATE TABLE mastra_knowledge_nodes');
      await storage.init();
      await expect(
        new KnowledgeMySQL({
          pool: storage.pool,
          operations: new StoreOperationsMySQL({ pool: storage.pool, database: isolatedDatabase }),
        }).init(),
      ).rejects.toBeInstanceOf(KnowledgeSchemaError);
      const [after] = await storage.pool.query('SHOW CREATE TABLE mastra_knowledge_nodes');
      expect(after).toEqual(before);
      const [tables] = await storage.pool.query(
        "SELECT table_name AS name FROM information_schema.tables WHERE table_schema=? AND table_name LIKE 'mastra_knowledge_%' ORDER BY table_name",
        [isolatedDatabase],
      );
      expect(tables).toEqual([{ name: 'mastra_knowledge_nodes' }]);
      const [nodes] = await storage.pool.query('SELECT * FROM mastra_knowledge_nodes');
      expect(nodes).toEqual(populated ? [{ id: 'legacy', type: 'node' }] : []);
      const [sentinel] = await storage.pool.query('SELECT value FROM unrelated_sentinel');
      expect(sentinel).toEqual([{ value: 'preserved' }]);
    } finally {
      await storage?.close();
      await admin.query(`DROP DATABASE IF EXISTS \`${isolatedDatabase}\``);
      await admin.end();
    }
  });

  it('persists the schema completion marker', async () => {
    const store = createStore();
    await store.init();
    const [rows] = await pool.query(`SELECT version FROM \`${TABLE_KNOWLEDGE_SCHEMA}\` WHERE id='canonical'`);
    expect(Number((rows as Array<{ version: number }>)[0]?.version)).toBe(KNOWLEDGE_STORAGE_SCHEMA_VERSION);
  });
});

afterAll(async () => {
  await pool.end();
});
