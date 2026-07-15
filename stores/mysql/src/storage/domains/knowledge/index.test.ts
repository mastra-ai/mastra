import { createKnowledgeStorageTests } from '@internal/storage-test-utils';
import { createPool } from 'mysql2/promise';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { StoreOperationsMySQL } from '../operations';
import { KnowledgeMySQL } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const database = process.env.MYSQL_DB || 'mastra';
const pool = createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'mastra',
  password: process.env.MYSQL_PASSWORD || 'mastra',
  database,
  connectionLimit: 10,
});
const operations = new StoreOperationsMySQL({ pool, database });
const createStore = () => new KnowledgeMySQL({ pool, operations });
createKnowledgeStorageTests(createStore);

describe('MySQL knowledge concurrency and indexes', () => {
  it('creates required indexes idempotently and exports its schema', async () => {
    const store = createStore();
    await store.init();
    await store.init();
    const [rows] = await pool.query(
      "SELECT DISTINCT INDEX_NAME AS indexName FROM information_schema.statistics WHERE table_schema=? AND table_name IN ('mastra_knowledge_records','mastra_knowledge_semantic_outbox')",
      [database],
    );
    const indexes = (rows as Array<{ indexName: string }>).map(row => row.indexName);
    expect(indexes).toContain('idx_knowledge_records_identity');
    expect(indexes).toContain('idx_knowledge_outbox_idempotency');
    const ddl = KnowledgeMySQL.getExportDDL();
    expect(ddl).toHaveLength(14);
    expect(ddl.join('\n')).toContain('idx_knowledge_outbox_idempotency');
    expect(ddl.join('\n')).toMatch(/PRIMARY KEY \(`sourceThreadId`, `agent`\)/);

    const connection = await pool.getConnection();
    try {
      await connection.query('SET FOREIGN_KEY_CHECKS=0');
      for (const table of [
        'mastra_knowledge_mentions',
        'mastra_knowledge_facts',
        'mastra_knowledge_records',
        'mastra_knowledge_cursors',
        'mastra_knowledge_activity',
        'mastra_knowledge_semantic_outbox',
      ]) {
        await connection.query(`DROP TABLE IF EXISTS \`${table}\``);
      }
      await connection.query('SET FOREIGN_KEY_CHECKS=1');
      for (const statement of ddl) await connection.query(statement);
      const [exportedIndexes] = await connection.query(
        "SELECT INDEX_NAME AS indexName FROM information_schema.statistics WHERE table_schema=? AND table_name='mastra_knowledge_semantic_outbox'",
        [database],
      );
      expect((exportedIndexes as Array<{ indexName: string }>).map(row => row.indexName)).toContain(
        'idx_knowledge_outbox_idempotency',
      );
    } finally {
      connection.release();
    }
  });

  it('claims semantic outbox work only once across concurrent workers', async () => {
    const first = createStore();
    const second = createStore();
    await first.init();
    await first.dangerouslyClearAll();
    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        first.createEntity({ name: `Claim ${index}`, kind: 'test', scope: ['org:acme'] }),
      ),
    );
    const claims = (
      await Promise.all([
        first.claimSemanticOutbox({ workerId: 'first', limit: 100 }),
        second.claimSemanticOutbox({ workerId: 'second', limit: 100 }),
      ])
    ).flat();
    expect(claims).toHaveLength(10);
    expect(new Set(claims.map(claim => claim.id)).size).toBe(10);
  });

  it('allows only one concurrent CAS update', async () => {
    const store = createStore();
    await store.init();
    await store.dangerouslyClearAll();
    const entity = await store.createEntity({ name: 'CAS', kind: 'test', scope: ['org:acme'] });
    const results = await Promise.allSettled([
      store.updateEntity({ id: entity.id, version: 1, name: 'CAS one' }),
      store.updateEntity({ id: entity.id, version: 1, name: 'CAS two' }),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
  });

  it('advances concurrent cursors monotonically', async () => {
    const store = createStore();
    await store.init();
    await store.dangerouslyClearAll();
    await Promise.all([
      store.advanceCurationCursor({ sourceThreadId: 'thread', agent: 'curate', lastFactId: '01A' }),
      store.advanceCurationCursor({ sourceThreadId: 'thread', agent: 'curate', lastFactId: '01C' }),
      store.advanceCurationCursor({ sourceThreadId: 'thread', agent: 'curate', lastFactId: '01B' }),
    ]);
    expect((await store.getCurationCursor({ sourceThreadId: 'thread', agent: 'curate' }))?.lastFactId).toBe('01C');
  });
});

afterAll(async () => {
  await pool.end();
});
