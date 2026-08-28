import { createKnowledgeStorageTests } from '@internal/storage-test-utils';
import { KNOWLEDGE_TABLE_NAMES, KnowledgeSchemaResetRequiredError } from '@mastra/core/storage';
import { Pool } from 'pg';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { PoolAdapter } from '../../client';
import { connectionString } from '../../test-utils';
import { getPgKnowledgeIsolationKey, KnowledgePG, postgresSql } from '.';

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

describe('KnowledgePG storage isolation', () => {
  it('identifies domains using the same pool and schema as one physical backend', () => {
    expect(new KnowledgePG({ pool, schemaName: 'shared' }).getStorageIsolationKey()).toBe(
      new KnowledgePG({ pool, schemaName: 'shared' }).getStorageIsolationKey(),
    );
    expect(new KnowledgePG({ pool, schemaName: 'first' }).getStorageIsolationKey()).not.toBe(
      new KnowledgePG({ pool, schemaName: 'second' }).getStorageIsolationKey(),
    );
  });

  it('canonicalizes equivalent connection forms', () => {
    expect(
      getPgKnowledgeIsolationKey({
        connectionString: 'postgresql://first:secret@EXAMPLE.com/knowledge?sslmode=require',
        schemaName: 'shared',
      }),
    ).toBe(
      getPgKnowledgeIsolationKey({
        host: 'example.com',
        port: 5432,
        database: 'knowledge',
        schemaName: 'shared',
      }),
    );
  });

  it('resolves separate client wrappers around the same pool', () => {
    expect(new KnowledgePG({ client: new PoolAdapter(pool), schemaName: 'shared' }).getStorageIsolationKey()).toBe(
      new KnowledgePG({ client: new PoolAdapter(pool), schemaName: 'shared' }).getStorageIsolationKey(),
    );
  });
});
const createStore = (schemaName?: string) => new KnowledgePG({ pool, schemaName });
createKnowledgeStorageTests(createStore);

describe('PostgreSQL knowledge legacy schema boundary', () => {
  it('detects legacy tables without mutation and resets only Knowledge storage', async () => {
    const schemaName = 'knowledge_legacy_boundary';
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    try {
      await pool.query(`CREATE TABLE "${schemaName}".knowledge_unrelated_domain (id TEXT PRIMARY KEY)`);
      await pool.query(`INSERT INTO "${schemaName}".knowledge_unrelated_domain (id) VALUES ('preserved')`);
      await pool.query(`CREATE TABLE "${schemaName}"."mastra_knowledge_nodes" (
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
        `INSERT INTO "${schemaName}"."mastra_knowledge_nodes" (id,type,name,"canonicalName",kind,content,scope,"scopeKey",version,"mergedInto","createdAt","updatedAt") VALUES ($1,'node',$2,$3,'task','legacy body',$4::jsonb,$5,1,NULL,$6,$6)`,
        [
          'legacy-node',
          'Legacy',
          'legacy',
          JSON.stringify(['org:legacy-upgrade']),
          'org:legacy-upgrade',
          new Date().toISOString(),
        ],
      );

      const store = createStore(schemaName);
      expect(await store.inspectSchema()).toMatchObject({ status: 'incompatible-reset-required' });
      await expect(store.init()).rejects.toBeInstanceOf(KnowledgeSchemaResetRequiredError);
      expect((await pool.query(`SELECT content FROM "${schemaName}".mastra_knowledge_nodes`)).rows[0]?.content).toBe(
        'legacy body',
      );

      await store.dangerouslyReset();
      expect(await store.inspectSchema()).toEqual({ status: 'compatible', schemaVersion: 2 });
      expect((await pool.query(`SELECT id FROM "${schemaName}".knowledge_unrelated_domain`)).rows[0]?.id).toBe(
        'preserved',
      );
    } finally {
      await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    }
  });

  it('rejects a complete Knowledge table set with a missing v2 column', async () => {
    const schemaName = `knowledge_partial_${Date.now()}`;
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    try {
      const store = createStore(schemaName);
      await store.init();
      await pool.query(`ALTER TABLE "${schemaName}".mastra_knowledge_proposals DROP COLUMN "reviewedAt"`);

      expect(await store.inspectSchema()).toMatchObject({ status: 'incompatible-reset-required' });
      await expect(store.init()).rejects.toBeInstanceOf(KnowledgeSchemaResetRequiredError);
    } finally {
      await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    }
  });

  it('rejects an interrupted v2 initialization without its completion marker', async () => {
    const schemaName = `knowledge_unmarked_${Date.now()}`;
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    try {
      const store = createStore(schemaName);
      await store.init();
      await pool.query(`DELETE FROM "${schemaName}".mastra_knowledge_access_state WHERE id='global'`);

      expect(await store.inspectSchema()).toMatchObject({ status: 'incompatible-reset-required' });
      await expect(store.init()).rejects.toBeInstanceOf(KnowledgeSchemaResetRequiredError);
    } finally {
      await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    }
  });
});

describe('PostgreSQL knowledge structured reconciliation', () => {
  it('creates a plan once and preserves existing scope fields on replay', async () => {
    const schemaName = `knowledge_reconcile_${Date.now()}`;
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    try {
      const store = createStore(schemaName);
      await store.init();
      const plan = {
        scopes: [
          {
            address: 'org:acme',
            name: 'Acme',
            grants: [{ scopeRefAddress: 'org:acme', role: 'owner' as const }],
          },
          { address: 'org:partner', name: 'Partner' },
          {
            address: 'resource:mastra',
            name: 'Mastra',
            parentAddresses: ['org:acme', 'org:partner'],
            grants: [{ scopeRefAddress: 'org:acme', role: 'readonly' as const }],
          },
        ],
      };

      const first = await store.reconcileStructure(plan);
      const second = await store.reconcileStructure({
        scopes: plan.scopes.map(scope => ({ ...scope, name: `Changed ${scope.name}` })),
      });

      expect(first).toMatchObject({ changed: true, accessEpoch: 1 });
      expect(first.createdScopeIds).toHaveLength(3);
      expect(second).toMatchObject({ changed: false, accessEpoch: 1, scopes: first.scopes });
      expect(
        (
          await pool.query(`SELECT name FROM "${schemaName}".mastra_knowledge_nodes WHERE id=$1`, [
            first.scopes['org:acme'],
          ])
        ).rows[0],
      ).toMatchObject({ name: 'Acme' });
      expect((await pool.query(`SELECT * FROM "${schemaName}".mastra_knowledge_node_scopes`)).rows).toHaveLength(2);
      expect((await pool.query(`SELECT * FROM "${schemaName}".mastra_knowledge_scope_grants`)).rows).toHaveLength(2);
    } finally {
      await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    }
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
    for (const [id, name, address] of [
      ['scope-a', 'Scope A', 'org:a'],
      ['scope-b', 'Scope B', 'resource:b'],
    ] as const) {
      await pool.query(
        `INSERT INTO mastra_knowledge_nodes (id,name,"isScope",version,"createdAt","updatedAt") VALUES ($1,$2,TRUE,1,$3,$3)`,
        [id, name, now],
      );
      await pool.query(`INSERT INTO mastra_knowledge_scope_addresses (address,"scopeNodeId") VALUES ($1,$2)`, [
        address,
        id,
      ]);
    }
    const scope = ['org:a', 'resource:b'];
    const node = await store.createNode({ id: 'node-a', name: 'Node A', kind: 'test', scope });
    const record = await store.appendKnowledge({
      id: 'record-a',
      node: node.id,
      text: 'scoped',
      scope,
      resolutionScope: scope,
      defaultScope: scope,
      sourceThreadId: 'thread-a',
    });

    expect(
      (await pool.query(`SELECT "scopeNodeId" FROM mastra_knowledge_node_scopes WHERE "nodeId"='node-a'`)).rows,
    ).toHaveLength(2);
    expect(
      (await pool.query(`SELECT "scopeNodeId" FROM mastra_knowledge_record_scopes WHERE "recordId"='record-a'`)).rows,
    ).toHaveLength(2);
    await store.updateNode({ id: node.id, version: node.version, scope: ['org:a'] });
    expect(
      (await pool.query(`SELECT "scopeNodeId" FROM mastra_knowledge_node_scopes WHERE "nodeId"='node-a'`)).rows,
    ).toEqual([expect.objectContaining({ scopeNodeId: 'scope-a' })]);
    expect(
      (
        await pool.query(
          `SELECT "targetType","targetId","contextScopeId" FROM mastra_knowledge_activity WHERE "targetId"=$1`,
          [record.id],
        )
      ).rows[0],
    ).toMatchObject({ targetType: 'record', targetId: record.id, contextScopeId: 'scope-a' });

    await store.rescopeKnowledge({ id: record.id, scope: ['org:a'] });
    expect(
      (await pool.query(`SELECT "scopeNodeId" FROM mastra_knowledge_record_scopes WHERE "recordId"='record-a'`)).rows,
    ).toEqual([expect.objectContaining({ scopeNodeId: 'scope-a' })]);
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
