import { createKnowledgeStorageTests } from '@internal/storage-test-utils';
import { Pool } from 'pg';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { connectionString } from '../../test-utils';
import { KnowledgePG, postgresSql } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

describe('PostgreSQL knowledge SQL normalization', () => {
  it('quotes identifiers without rewriting string literals', () => {
    expect(
      postgresSql(
        `SELECT node,sourceThreadId FROM "mastra_knowledge_nodes" WHERE type='node' AND sourceThreadId='sourceThreadId' AND scope=jsonb(?) AND id=?`,
        'knowledge',
      ),
    ).toBe(
      `SELECT "node","sourceThreadId" FROM "knowledge"."mastra_knowledge_nodes" WHERE type='node' AND "sourceThreadId"='sourceThreadId' AND scope=$1::jsonb AND id=$2`,
    );
  });
});

const pool = new Pool({ connectionString });
const createStore = () => new KnowledgePG({ pool });
createKnowledgeStorageTests(createStore);

describe('PostgreSQL knowledge legacy schema upgrade', () => {
  it('adds the description column to pre-existing tables and reads legacy rows as undefined', async () => {
    const store = createStore();
    await store.init();
    // Recreate the pre-description table shape, then let init() upgrade it.
    // Mutates the shared table; safe because vitest runs files serially (fileParallelism: false)
    // and the shared suite's beforeEach re-runs init(), which re-adds the column.
    await pool.query('ALTER TABLE "mastra_knowledge_nodes" DROP COLUMN IF EXISTS description');
    const legacyId = `legacy-${Date.now()}`;
    await pool.query(
      `INSERT INTO "mastra_knowledge_nodes" (id,type,name,"canonicalName",kind,content,scope,"scopeKey",version,"mergedInto","createdAt","updatedAt") VALUES ($1,'node',$2,$3,'task','legacy body',$4::jsonb,$5,1,NULL,$6,$6)`,
      [
        legacyId,
        `Legacy ${legacyId}`,
        `legacy ${legacyId}`,
        JSON.stringify(['org:legacy-upgrade']),
        'org:legacy-upgrade',
        new Date().toISOString(),
      ],
    );

    const upgraded = createStore();
    await upgraded.init();

    const columns = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='mastra_knowledge_nodes'",
    );
    expect(columns.rows.map(row => row.column_name)).toContain('description');

    const legacy = await upgraded.getNode(legacyId);
    expect(legacy?.description).toBeUndefined();
    expect(legacy?.content).toBe('legacy body');
  });
});

describe('PostgreSQL knowledge concurrency and indexes', () => {
  it('creates required indexes idempotently and exports its schema', async () => {
    const store = createStore();
    await store.init();
    await store.init();
    const result = await pool.query(
      "SELECT indexname FROM pg_indexes WHERE tablename IN ('mastra_knowledge_nodes','mastra_knowledge_records','mastra_knowledge_semantic_outbox')",
    );
    expect(result.rows.map(row => row.indexname)).toContain('idx_knowledge_nodes_identity');
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

  it('round-trips knowledge record timestamps as UTC regardless of the process timezone', async () => {
    const store = createStore();
    await store.init();
    const scope = ['org:tz-probe'];
    const node = await store.createNode({ name: `TZ probe ${Date.now()}`, kind: 'test', scope });
    const appended = await store.appendKnowledge({
      node: node.id,
      text: 'utc round-trip probe',
      scope,
      resolutionScope: scope,
      defaultScope: scope,
      sourceThreadId: 'tz-thread',
    });
    const read = await store.getKnowledge({ id: appended.id });
    expect(read?.capturedAt.toISOString()).toBe(appended.capturedAt.toISOString());
    expect(Math.abs((read?.capturedAt.getTime() ?? 0) - Date.now())).toBeLessThan(60_000);
  });

  it('initializes and operates in a custom schema', async () => {
    const schemaName = 'mastra_knowledge_runtime_test';
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    try {
      const store = new KnowledgePG({ pool, schemaName });
      await store.init();
      const node = await store.createNode({ name: 'Custom schema', kind: 'test', scope: ['org:acme'] });
      await store.advanceCurationCursor({ sourceThreadId: 'thread', agent: 'curate', lastKnowledgeId: '01A' });
      expect(await store.getNode(node.id)).toMatchObject({ name: 'Custom schema' });
      expect(await store.claimSemanticOutbox({ workerId: 'worker', limit: 10 })).toHaveLength(1);
      const indexes = await pool.query('SELECT indexname FROM pg_indexes WHERE schemaname=$1', [schemaName]);
      expect(indexes.rows.map(row => row.indexname)).toEqual(
        expect.arrayContaining(['idx_knowledge_nodes_identity', 'idx_knowledge_outbox_idempotency']),
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
        first.createNode({ name: `Claim ${index}`, kind: 'test', scope: ['org:acme'] }),
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
    const node = await store.createNode({ name: 'CAS', kind: 'test', scope: ['org:acme'] });
    const results = await Promise.allSettled([
      store.updateNode({ id: node.id, version: 1, name: 'CAS one' }),
      store.updateNode({ id: node.id, version: 1, name: 'CAS two' }),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
  });

  it('advances concurrent cursors monotonically', async () => {
    const store = createStore();
    await store.init();
    await store.dangerouslyClearAll();
    await Promise.allSettled([
      store.advanceCurationCursor({ sourceThreadId: 'thread', agent: 'curate', lastKnowledgeId: '01A' }),
      store.advanceCurationCursor({ sourceThreadId: 'thread', agent: 'curate', lastKnowledgeId: '01C' }),
      store.advanceCurationCursor({ sourceThreadId: 'thread', agent: 'curate', lastKnowledgeId: '01B' }),
    ]);
    expect((await store.getCurationCursor({ sourceThreadId: 'thread', agent: 'curate' }))?.lastKnowledgeId).toBe('01C');
  });
});

afterAll(async () => {
  await pool.end();
});
