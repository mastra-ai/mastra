import { createKnowledgeStorageTests } from '@internal/storage-test-utils';
import { Pool } from 'pg';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { connectionString } from '../../test-utils';
import { KnowledgePG } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const pool = new Pool({ connectionString });
const createStore = () => new KnowledgePG({ pool });
createKnowledgeStorageTests(createStore);

describe('PostgreSQL knowledge concurrency and indexes', () => {
  it('creates required indexes idempotently and exports its schema', async () => {
    const store = createStore();
    await store.init();
    await store.init();
    const result = await pool.query(
      "SELECT indexname FROM pg_indexes WHERE tablename IN ('mastra_knowledge_records','mastra_knowledge_semantic_outbox')",
    );
    expect(result.rows.map(row => row.indexname)).toContain('idx_knowledge_records_identity');
    expect(result.rows.map(row => row.indexname)).toContain('idx_knowledge_outbox_idempotency');
    const ddl = KnowledgePG.getExportDDL();
    expect(ddl).toHaveLength(14);
    expect(ddl.join('\n')).toContain('idx_knowledge_outbox_idempotency');
    expect(ddl.join('\n')).toMatch(/PRIMARY KEY \("sourceThreadId", "agent"\)/);

    const schemaName = 'mastra_knowledge_export_test';
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    try {
      for (const statement of KnowledgePG.getExportDDL(schemaName)) await pool.query(statement);
      const exportedIndexes = await pool.query('SELECT indexname FROM pg_indexes WHERE schemaname=$1', [schemaName]);
      expect(exportedIndexes.rows.map(row => row.indexname)).toContain('idx_knowledge_outbox_idempotency');
    } finally {
      await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    }
  });

  it('initializes and operates in a custom schema', async () => {
    const schemaName = 'mastra_knowledge_runtime_test';
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    try {
      const store = new KnowledgePG({ pool, schemaName });
      await store.init();
      const entity = await store.createEntity({ name: 'Custom schema', kind: 'test', scope: ['org:acme'] });
      await store.advanceCurationCursor({ sourceThreadId: 'thread', agent: 'curate', lastFactId: '01A' });
      expect(await store.getEntity(entity.id)).toMatchObject({ name: 'Custom schema' });
      expect(await store.claimSemanticOutbox({ workerId: 'worker', limit: 10 })).toHaveLength(1);
      const indexes = await pool.query('SELECT indexname FROM pg_indexes WHERE schemaname=$1', [schemaName]);
      expect(indexes.rows.map(row => row.indexname)).toEqual(
        expect.arrayContaining(['idx_knowledge_records_identity', 'idx_knowledge_outbox_idempotency']),
      );
    } finally {
      await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
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
    await Promise.allSettled([
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
