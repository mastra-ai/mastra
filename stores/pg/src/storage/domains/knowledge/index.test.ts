import { createKnowledgeStorageTests } from '@internal/storage-test-utils';
import { KNOWLEDGE_TABLE_NAMES, KnowledgeSchemaResetRequiredError } from '@mastra/core/storage';
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

describe('PostgreSQL knowledge legacy schema boundary', () => {
  it('detects legacy tables without mutation and resets only Knowledge storage', async () => {
    const tables = [...KNOWLEDGE_TABLE_NAMES].map(table => `"${table}"`).join(', ');
    await pool.query(`DROP TABLE IF EXISTS ${tables} CASCADE`);
    await pool.query('CREATE TABLE IF NOT EXISTS knowledge_unrelated_domain (id TEXT PRIMARY KEY)');
    await pool.query("INSERT INTO knowledge_unrelated_domain (id) VALUES ('preserved') ON CONFLICT DO NOTHING");
    await pool.query(`CREATE TABLE "mastra_knowledge_nodes" (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      "canonicalName" TEXT NOT NULL,
      kind TEXT,
      content TEXT,
      scope JSONB NOT NULL,
      "scopeKey" TEXT NOT NULL,
      version INTEGER NOT NULL,
      "mergedInto" TEXT,
      "createdAt" TIMESTAMP NOT NULL,
      "updatedAt" TIMESTAMP NOT NULL
    )`);
    await pool.query(
      `INSERT INTO "mastra_knowledge_nodes" (id,type,name,"canonicalName",kind,content,scope,"scopeKey",version,"mergedInto","createdAt","updatedAt") VALUES ($1,'node',$2,$3,'task','legacy body',$4::jsonb,$5,1,NULL,$6,$6)`,
      [
        'legacy-node',
        'Legacy',
        'legacy',
        JSON.stringify(['org:legacy-upgrade']),
        'org:legacy-upgrade',
        new Date().toISOString(),
      ],
    );

    const store = createStore();
    expect(await store.inspectSchema()).toMatchObject({ status: 'incompatible-reset-required' });
    await expect(store.init()).rejects.toBeInstanceOf(KnowledgeSchemaResetRequiredError);
    expect((await pool.query('SELECT content FROM mastra_knowledge_nodes')).rows[0]?.content).toBe('legacy body');

    await store.dangerouslyReset();
    expect(await store.inspectSchema()).toEqual({ status: 'compatible', schemaVersion: 2 });
    expect((await pool.query('SELECT id FROM knowledge_unrelated_domain')).rows[0]?.id).toBe('preserved');
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
    expect(ddl).toHaveLength(KNOWLEDGE_TABLE_NAMES.length + 14);
    expect(ddl.join('\n')).toContain('idx_knowledge_outbox_idempotency');
    expect(ddl.join('\n')).toContain('mastra_knowledge_record_scopes');
    expect(ddl.join('\n')).toContain('idx_knowledge_activity_import_run');
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

  it('persists normalized multi-scope node membership and record scope rules', async () => {
    const store = createStore();
    await store.init();
    await store.dangerouslyClearAll();
    const now = new Date().toISOString();
    for (const [id, name, isScope] of [
      ['scope-a', 'Scope A', true],
      ['scope-b', 'Scope B', true],
      ['node-a', 'Node A', false],
    ] as const) {
      await pool.query(
        `INSERT INTO mastra_knowledge_nodes (id,name,"isScope",version,"createdAt","updatedAt") VALUES ($1,$2,$3,1,$4,$4)`,
        [id, name, isScope, now],
      );
    }
    await pool.query(
      `INSERT INTO mastra_knowledge_node_scopes ("nodeId","scopeNodeId","addedAt") VALUES ('node-a','scope-a',$1),('node-a','scope-b',$1)`,
      [now],
    );
    await pool.query(
      `INSERT INTO mastra_knowledge_records (id,"nodeId",text,version,"createdAt","updatedAt") VALUES ('record-a','node-a','scoped',1,$1,$1)`,
      [now],
    );
    await pool.query(
      `INSERT INTO mastra_knowledge_record_scopes ("recordId","scopeNodeId","addedAt") VALUES ('record-a','scope-b',$1)`,
      [now],
    );

    expect(
      (await pool.query(`SELECT "scopeNodeId" FROM mastra_knowledge_node_scopes WHERE "nodeId"='node-a'`)).rows,
    ).toHaveLength(2);
    expect(
      (await pool.query(`SELECT "scopeNodeId" FROM mastra_knowledge_record_scopes WHERE "recordId"='record-a'`)).rows[0]
        ?.scopeNodeId,
    ).toBe('scope-b');
    expect(store.getCapabilities()).toMatchObject({ schemaVersion: 2, supportsV2: true });
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
