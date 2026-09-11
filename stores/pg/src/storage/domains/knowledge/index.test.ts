import { createKnowledgeStorageTests } from '@internal/storage-test-utils';
import {
  KNOWLEDGE_ACTIVITY_SCHEMA,
  KNOWLEDGE_CURSORS_SCHEMA,
  KNOWLEDGE_MENTIONS_SCHEMA,
  KNOWLEDGE_NODES_SCHEMA,
  KNOWLEDGE_RECORDS_SCHEMA,
  KNOWLEDGE_SEMANTIC_OUTBOX_SCHEMA,
  KNOWLEDGE_TABLE_NAMES,
  KnowledgeSchemaResetRequiredError,
  TABLE_KNOWLEDGE_ACTIVITY,
  TABLE_KNOWLEDGE_CURSORS,
  TABLE_KNOWLEDGE_MENTIONS,
  TABLE_KNOWLEDGE_NODES,
  TABLE_KNOWLEDGE_RECORDS,
  TABLE_KNOWLEDGE_SEMANTIC_OUTBOX,
} from '@mastra/core/storage';
import { Pool } from 'pg';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { PostgresStore } from '../..';
import { generateTableSQL } from '../../db';
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
const KNOWLEDGE_V1_TABLE_COLUMNS_TEST_COUNT = 6;
const createStore = (schemaName?: string) => new KnowledgePG({ pool, schemaName });
createKnowledgeStorageTests(createStore);

async function seedPublishedKnowledgeV1(schemaName: string): Promise<void> {
  for (const statement of [
    generateTableSQL({
      tableName: TABLE_KNOWLEDGE_NODES,
      schema: KNOWLEDGE_NODES_SCHEMA,
      schemaName,
      includeAllConstraints: true,
    }),
    generateTableSQL({
      tableName: TABLE_KNOWLEDGE_RECORDS,
      schema: KNOWLEDGE_RECORDS_SCHEMA,
      schemaName,
      includeAllConstraints: true,
    }),
    generateTableSQL({
      tableName: TABLE_KNOWLEDGE_MENTIONS,
      schema: KNOWLEDGE_MENTIONS_SCHEMA,
      schemaName,
      compositePrimaryKey: ['sourceType', 'sourceId', 'recordId'],
      includeAllConstraints: true,
    }),
    generateTableSQL({
      tableName: TABLE_KNOWLEDGE_CURSORS,
      schema: KNOWLEDGE_CURSORS_SCHEMA,
      schemaName,
      compositePrimaryKey: ['sourceThreadId', 'agent'],
      includeAllConstraints: true,
    }),
    generateTableSQL({
      tableName: TABLE_KNOWLEDGE_ACTIVITY,
      schema: KNOWLEDGE_ACTIVITY_SCHEMA,
      schemaName,
      includeAllConstraints: true,
    }),
    generateTableSQL({
      tableName: TABLE_KNOWLEDGE_SEMANTIC_OUTBOX,
      schema: KNOWLEDGE_SEMANTIC_OUTBOX_SCHEMA,
      schemaName,
      includeAllConstraints: true,
    }),
    `CREATE UNIQUE INDEX idx_knowledge_nodes_identity ON "${schemaName}"."${TABLE_KNOWLEDGE_NODES}" ("type", "scopeKey", "canonicalName")`,
    `CREATE INDEX idx_knowledge_nodes_scope ON "${schemaName}"."${TABLE_KNOWLEDGE_NODES}" ("scopeKey", "type")`,
    `CREATE INDEX idx_knowledge_records_node_latest ON "${schemaName}"."${TABLE_KNOWLEDGE_RECORDS}" ("node", "id" DESC)`,
    `CREATE INDEX idx_knowledge_records_thread_latest ON "${schemaName}"."${TABLE_KNOWLEDGE_RECORDS}" ("sourceThreadId", "id" DESC)`,
    `CREATE INDEX idx_knowledge_mentions_record ON "${schemaName}"."${TABLE_KNOWLEDGE_MENTIONS}" ("recordId", "sourceType", "sourceId")`,
    `CREATE INDEX idx_knowledge_activity_latest ON "${schemaName}"."${TABLE_KNOWLEDGE_ACTIVITY}" ("id" DESC)`,
    `CREATE UNIQUE INDEX idx_knowledge_outbox_idempotency ON "${schemaName}"."${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" ("idempotencyKey")`,
    `CREATE INDEX idx_knowledge_outbox_claim ON "${schemaName}"."${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" ("status", "availableAt", "createdAt")`,
  ]) {
    await pool.query(statement);
  }
}

describe('PostgreSQL knowledge legacy schema boundary', () => {
  it('replaces recognized populated v1 only during explicit activation and preserves unrelated tables', async () => {
    const schemaName = 'knowledge_legacy_boundary';
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    const storage = new PostgresStore({ id: 'legacy-boundary', pool, schemaName });
    try {
      await seedPublishedKnowledgeV1(schemaName);
      await pool.query(`CREATE TABLE "${schemaName}".knowledge_unrelated_domain (id TEXT PRIMARY KEY)`);
      await pool.query(`INSERT INTO "${schemaName}".knowledge_unrelated_domain (id) VALUES ('preserved')`);
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

      await storage.init();
      expect((await pool.query(`SELECT content FROM "${schemaName}".mastra_knowledge_nodes`)).rows[0]?.content).toBe(
        'legacy body',
      );
      const direct = createStore(schemaName);
      expect(await direct.inspectSchema()).toMatchObject({ status: 'incompatible-reset-required' });

      await expect(Promise.all([storage.getStore('knowledge'), direct.init()])).resolves.toEqual([
        expect.anything(),
        undefined,
      ]);
      expect(await direct.inspectSchema()).toEqual({ status: 'compatible', schemaVersion: 2 });
      expect((await pool.query(`SELECT id FROM "${schemaName}".mastra_knowledge_nodes`)).rows).toEqual([]);
      expect((await pool.query(`SELECT id FROM "${schemaName}".knowledge_unrelated_domain`)).rows[0]?.id).toBe(
        'preserved',
      );
    } finally {
      await storage.close();
      await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    }
  });

  it('rejects an unrecognized v1 layout without mutation', async () => {
    const schemaName = `knowledge_unknown_${Date.now()}`;
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    try {
      await seedPublishedKnowledgeV1(schemaName);
      await pool.query(`CREATE INDEX unexpected_knowledge_index ON "${schemaName}"."${TABLE_KNOWLEDGE_NODES}" (name)`);
      await pool.query(
        `INSERT INTO "${schemaName}"."${TABLE_KNOWLEDGE_NODES}" (id,type,name,"canonicalName",scope,"scopeKey",version,"createdAt","updatedAt") VALUES ('legacy','node','Legacy','legacy','[]','legacy',1,NOW(),NOW())`,
      );

      await expect(createStore(schemaName).init()).rejects.toBeInstanceOf(KnowledgeSchemaResetRequiredError);
      expect((await pool.query(`SELECT id FROM "${schemaName}"."${TABLE_KNOWLEDGE_NODES}"`)).rows[0]?.id).toBe(
        'legacy',
      );
      expect(
        (
          await pool.query('SELECT indexname FROM pg_indexes WHERE schemaname=$1 AND indexname=$2', [
            schemaName,
            'unexpected_knowledge_index',
          ])
        ).rows,
      ).toHaveLength(1);
    } finally {
      await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    }
  });

  it('rolls back replacement when an external dependency blocks a drop and permits retry', async () => {
    const schemaName = `knowledge_dependency_${Date.now()}`;
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    try {
      await seedPublishedKnowledgeV1(schemaName);
      await pool.query(
        `INSERT INTO "${schemaName}"."${TABLE_KNOWLEDGE_NODES}" (id,type,name,"canonicalName",scope,"scopeKey",version,"createdAt","updatedAt") VALUES ('legacy','node','Legacy','legacy','[]','legacy',1,NOW(),NOW())`,
      );
      await pool.query(
        `CREATE VIEW "${schemaName}".knowledge_dependency AS SELECT id FROM "${schemaName}"."${TABLE_KNOWLEDGE_NODES}"`,
      );

      await expect(createStore(schemaName).init()).rejects.toThrow();
      expect((await pool.query(`SELECT id FROM "${schemaName}"."${TABLE_KNOWLEDGE_NODES}"`)).rows[0]?.id).toBe(
        'legacy',
      );
      const tablesAfterRollback = await pool.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema=$1 AND table_name LIKE 'mastra_knowledge_%'`,
        [schemaName],
      );
      expect(tablesAfterRollback.rows).toHaveLength(KNOWLEDGE_V1_TABLE_COLUMNS_TEST_COUNT);

      await pool.query(`DROP VIEW "${schemaName}".knowledge_dependency`);
      await expect(createStore(schemaName).init()).resolves.toBeUndefined();
      expect(await createStore(schemaName).inspectSchema()).toEqual({ status: 'compatible', schemaVersion: 2 });
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
