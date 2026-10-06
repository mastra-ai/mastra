import { randomUUID } from 'node:crypto';
import { createKnowledgeStorageTests } from '@internal/storage-test-utils';
import {
  KNOWLEDGE_STORAGE_CONTRACT_VERSION,
  KNOWLEDGE_STORAGE_SCHEMA_VERSION,
  KnowledgeConflictError,
  KnowledgeSchemaError,
  TABLE_KNOWLEDGE_ACCESS_STATE,
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

  it('serializes concurrent fenced scope deletes into one winner and conflicts, never lock deadlocks', async () => {
    const store = createStore();
    await store.init();
    for (let round = 0; round < 5; round++) {
      const scopes = await Promise.all(
        [0, 1, 2].map(() => store.createNode({ name: `Empty scope ${randomUUID()}`, isScope: true, scopeIds: [] })),
      );
      const epoch = await store.getAccessEpoch();
      const results = await Promise.allSettled(
        scopes.map(scope =>
          store.deleteNode({ id: scope.id, version: scope.version, deletedBy: 'test', expectedAccessEpoch: epoch }),
        ),
      );
      expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
      for (const result of results) {
        if (result.status === 'rejected') expect(result.reason).toBeInstanceOf(KnowledgeConflictError);
      }
    }
  });

  it('rejects a fenced mutation when a grant change commits while it waits on the access epoch', async () => {
    const store = createStore();
    await store.init();
    const scope = await store.createNode({ name: `Fence scope ${randomUUID()}`, isScope: true, scopeIds: [] });
    const node = await store.createNode({ name: `Fenced ${randomUUID()}`, scopeIds: [scope.id] });
    const epoch = await store.getAccessEpoch();
    const grantChange = await pool.getConnection();
    try {
      await grantChange.beginTransaction();
      await grantChange.query(`UPDATE \`${TABLE_KNOWLEDGE_ACCESS_STATE}\` SET epoch=epoch+1 WHERE id='global'`);
      const mutation = store.updateNode({
        id: node.id,
        version: node.version,
        name: 'Renamed',
        expectedAccessEpoch: epoch,
      });
      const settled = mutation.then(
        () => 'committed',
        () => 'rejected',
      );
      await new Promise(resolve => setTimeout(resolve, 300));
      await grantChange.commit();
      await settled;
      await expect(mutation).rejects.toBeInstanceOf(KnowledgeConflictError);
    } finally {
      grantChange.release();
    }
    expect((await store.getNode(node.id))?.name).toBe(node.name);
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
