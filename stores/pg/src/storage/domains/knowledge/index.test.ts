import { readFile } from 'node:fs/promises';
import { createKnowledgeStorageTests } from '@internal/storage-test-utils';
import { KnowledgeSchemaError, TABLE_KNOWLEDGE_SCHEMA } from '@mastra/core/storage';
import { Pool } from 'pg';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { PoolAdapter, RoutingDbClient } from '../../client';
import { loadSchemaSnapshot } from '../../db/schema-snapshot';
import { connectionString } from '../../test-utils';

import { getPgKnowledgeIsolationKey, KnowledgePG, postgresSql } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const pool = new Pool({ connectionString });
const schemas: string[] = [];
let schemaCounter = 0;

createKnowledgeStorageTests(async () => {
  const schemaName = `knowledge_canonical_${process.pid}_${schemaCounter++}`;
  schemas.push(schemaName);
  await pool.query(`CREATE SCHEMA "${schemaName}"`);
  return new KnowledgePG({ pool, schemaName });
});

afterAll(async () => {
  for (const schema of schemas) await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await pool.end();
});

describe('KnowledgePG replacement rollback', () => {
  it.each(['second-page', 'outbox', 'commit'])('restores every Knowledge table after %s failure', async stage => {
    const schemaName = `knowledge_replacement_${process.pid}_${schemaCounter++}`;
    schemas.push(schemaName);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    const store = new KnowledgePG({ pool, schemaName });
    await store.init();
    const scopeId = '10000000-0000-4000-8000-000000000001';
    await store.createNode({ id: scopeId, name: 'Scope', isScope: true, scopeIds: [] });
    const node = await store.createNode({ name: 'Document', scopeIds: [scopeId] });
    await store.setNodeAddress({ source: 'importer', address: 'document:1', nodeId: node.id });
    for (let index = 0; index < 105; index++)
      await store.createRecord({
        id: `prior-${String(index).padStart(3, '0')}`,
        node,
        text: 'Original [[Existing link]]',
        source: 'curator',
        scopeIds: [scopeId],
        metadata: { sourceThreadId: 'original' },
      });
    const tables = await pool.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema=$1 ORDER BY table_name',
      [schemaName],
    );
    const snapshot = async () =>
      Promise.all(
        tables.rows.map(async ({ table_name }) => ({
          name: table_name,
          rows: (await pool.query(`SELECT * FROM "${schemaName}"."${table_name}" AS t ORDER BY row_to_json(t)::text`))
            .rows,
        })),
      );
    const before = await snapshot();
    await pool.query(
      `CREATE FUNCTION "${schemaName}".fail_replacement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected ${stage} failure'; END; $$`,
    );
    if (stage === 'second-page')
      await pool.query(
        `CREATE TRIGGER fail_page BEFORE UPDATE OF "deletedAt" ON "${schemaName}".mastra_knowledge_records FOR EACH ROW WHEN (NEW.id='prior-100') EXECUTE FUNCTION "${schemaName}".fail_replacement()`,
      );
    if (stage === 'outbox')
      await pool.query(
        `CREATE TRIGGER fail_outbox BEFORE INSERT ON "${schemaName}".mastra_knowledge_semantic_outbox FOR EACH ROW WHEN (NEW."documentId"='knowledge:record:replacement') EXECUTE FUNCTION "${schemaName}".fail_replacement()`,
      );
    if (stage === 'commit')
      await pool.query(
        `CREATE CONSTRAINT TRIGGER fail_commit AFTER INSERT ON "${schemaName}".mastra_knowledge_records DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.id='replacement') EXECUTE FUNCTION "${schemaName}".fail_replacement()`,
      );
    await expect(
      store.replaceNodeRecords({
        node: { id: node.id, version: node.version },
        record: {
          id: 'replacement',
          text: 'Replacement [[New link]]',
          source: 'curator',
          scopeIds: [scopeId],
          metadata: { sourceThreadId: 'new' },
        },
        visibilityScopeIds: [scopeId],
      }),
    ).rejects.toThrow(`injected ${stage} failure`);
    expect(await snapshot()).toEqual(before);
  });
});

describe('KnowledgePG schema completion marker', () => {
  it('writes the marker only after canonical initialization succeeds', async () => {
    const schemaName = `knowledge_marker_${process.pid}_${schemaCounter++}`;
    schemas.push(schemaName);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    await new KnowledgePG({ pool, schemaName }).init();

    const marker = await pool.query(
      `SELECT "version" FROM "${schemaName}"."${TABLE_KNOWLEDGE_SCHEMA}" WHERE id = 'canonical'`,
    );
    expect(marker.rows[0]?.version).toBe(1);
  });

  it('rejects a markerless partial schema without mutating it', async () => {
    const schemaName = `knowledge_partial_${process.pid}_${schemaCounter++}`;
    schemas.push(schemaName);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    await pool.query(`CREATE TABLE "${schemaName}".mastra_knowledge_nodes (id TEXT PRIMARY KEY)`);

    await expect(new KnowledgePG({ pool, schemaName }).init()).rejects.toBeInstanceOf(KnowledgeSchemaError);
    const tables = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name LIKE 'mastra_knowledge_%' ORDER BY table_name`,
      [schemaName],
    );
    expect(tables.rows.map(row => row.table_name)).toEqual(['mastra_knowledge_nodes']);
  });
  it('explicitly resets retired Knowledge tables and leaves other storage untouched', async () => {
    const schemaName = `knowledge_reset_${process.pid}_${schemaCounter++}`;
    schemas.push(schemaName);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    await pool.query(`CREATE TABLE "${schemaName}".mastra_knowledge_cursors (id TEXT PRIMARY KEY)`);
    await pool.query(`CREATE TABLE "${schemaName}".mastra_threads (id TEXT PRIMARY KEY)`);
    await pool.query(`INSERT INTO "${schemaName}".mastra_threads (id) VALUES ('preserved')`);
    const store = new KnowledgePG({ pool, schemaName });
    await expect(store.init()).rejects.toBeInstanceOf(KnowledgeSchemaError);

    await store.dangerouslyReset();

    const tables = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name LIKE 'mastra_knowledge_%'`,
      [schemaName],
    );
    const names = tables.rows.map(row => row.table_name);
    expect(names).not.toContain('mastra_knowledge_cursors');
    expect(names).toContain(TABLE_KNOWLEDGE_SCHEMA);
    const threads = await pool.query(`SELECT id FROM "${schemaName}".mastra_threads`);
    expect(threads.rows.map(row => row.id)).toEqual(['preserved']);
    await new KnowledgePG({ pool, schemaName }).init();
  });

  it('refuses to reset when unrelated objects depend on Knowledge tables', async () => {
    const schemaName = `knowledge_reset_dependent_${process.pid}_${schemaCounter++}`;
    schemas.push(schemaName);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    const store = new KnowledgePG({ pool, schemaName });
    await store.init();
    await pool.query(
      `CREATE VIEW "${schemaName}".unrelated_report AS SELECT id FROM "${schemaName}"."${TABLE_KNOWLEDGE_SCHEMA}"`,
    );

    await expect(store.dangerouslyReset()).rejects.toThrow();

    const views = await pool.query(`SELECT table_name FROM information_schema.views WHERE table_schema = $1`, [
      schemaName,
    ]);
    expect(views.rows.map(row => row.table_name)).toEqual(['unrelated_report']);
    const marker = await pool.query(`SELECT id FROM "${schemaName}"."${TABLE_KNOWLEDGE_SCHEMA}"`);
    expect(marker.rows.map(row => row.id)).toEqual(['canonical']);
  });
});

async function createSchemaWithPublishedKnowledgeV1(prefix: string): Promise<string> {
  const schemaName = `${prefix}_${process.pid}_${schemaCounter++}`;
  schemas.push(schemaName);
  await pool.query(`CREATE SCHEMA "${schemaName}"`);
  const sql = await readFile(new URL('./fixtures/published-1.29.0.sql', import.meta.url), 'utf8');
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);
    await client.query(sql);
  } finally {
    await client.query('RESET search_path');
    client.release();
  }
  return schemaName;
}

async function knowledgeObjects(schemaName: string): Promise<string[]> {
  const objects = await pool.query(
    `SELECT 'table:' || table_name AS object FROM information_schema.tables WHERE table_schema = $1 UNION ALL SELECT 'index:' || indexname FROM pg_indexes WHERE schemaname = $1 ORDER BY object`,
    [schemaName],
  );
  return objects.rows.map(row => String(row.object));
}

describe('KnowledgePG published v1 layout', () => {
  it('replaces the empty tables every published PostgreSQL store created and keeps other storage', async () => {
    const schemaName = await createSchemaWithPublishedKnowledgeV1('knowledge_published_empty');
    await pool.query(`CREATE TABLE "${schemaName}".mastra_threads (id TEXT PRIMARY KEY)`);
    await pool.query(`INSERT INTO "${schemaName}".mastra_threads (id) VALUES ('preserved')`);

    await new KnowledgePG({ pool, schemaName }).init();

    const marker = await pool.query(
      `SELECT "version" FROM "${schemaName}"."${TABLE_KNOWLEDGE_SCHEMA}" WHERE id = 'canonical'`,
    );
    expect(marker.rows[0]?.version).toBe(1);
    expect(await knowledgeObjects(schemaName)).not.toContain('table:mastra_knowledge_cursors');
    const threads = await pool.query(`SELECT id FROM "${schemaName}".mastra_threads`);
    expect(threads.rows.map(row => row.id)).toEqual(['preserved']);
  });

  it('rebuilds same-named indexes when a catalog snapshot predates the replacement', async () => {
    const schemaName = await createSchemaWithPublishedKnowledgeV1('knowledge_published_snapshot');
    const client = new RoutingDbClient(new PoolAdapter(pool));
    client.setSchemaSnapshot(await loadSchemaSnapshot(client, schemaName));

    await new KnowledgePG({ client, schemaName }).init();

    const objects = await knowledgeObjects(schemaName);
    expect(objects).toContain('index:idx_knowledge_outbox_idempotency');
    expect(objects).toContain('index:idx_knowledge_records_node_latest');
    const nodeColumns = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'mastra_knowledge_nodes'`,
      [schemaName],
    );
    expect(nodeColumns.rows.map(row => row.column_name)).toContain('isScope');
  });

  it('rejects a populated published layout without mutation and names the reset call', async () => {
    const schemaName = await createSchemaWithPublishedKnowledgeV1('knowledge_published_rows');
    await pool.query(
      `INSERT INTO "${schemaName}".mastra_knowledge_nodes (id,type,name,"canonicalName",scope,"scopeKey",version,"createdAt","updatedAt") VALUES ('legacy','node','Legacy','legacy','[]','legacy',1,NOW(),NOW())`,
    );
    const before = await knowledgeObjects(schemaName);

    const init = new KnowledgePG({ pool, schemaName }).init();
    await expect(init).rejects.toBeInstanceOf(KnowledgeSchemaError);
    await expect(init).rejects.toThrow(/Knowledge schema reset required.*dangerouslyReset\(\)/);

    expect(await knowledgeObjects(schemaName)).toEqual(before);
    const nodes = await pool.query(`SELECT id FROM "${schemaName}".mastra_knowledge_nodes`);
    expect(nodes.rows.map(row => row.id)).toEqual(['legacy']);
  });

  it('rejects an empty published layout that a host view depends on', async () => {
    const schemaName = await createSchemaWithPublishedKnowledgeV1('knowledge_published_view');
    await pool.query(
      `CREATE VIEW "${schemaName}".host_report AS SELECT id FROM "${schemaName}".mastra_knowledge_nodes`,
    );
    const before = await knowledgeObjects(schemaName);

    await expect(new KnowledgePG({ pool, schemaName }).init()).rejects.toBeInstanceOf(KnowledgeSchemaError);

    expect(await knowledgeObjects(schemaName)).toEqual(before);
  });

  it('rejects an empty published layout carrying an unfamiliar index', async () => {
    const schemaName = await createSchemaWithPublishedKnowledgeV1('knowledge_published_index');
    await pool.query(`CREATE INDEX host_knowledge_index ON "${schemaName}".mastra_knowledge_nodes (name)`);
    const before = await knowledgeObjects(schemaName);

    await expect(new KnowledgePG({ pool, schemaName }).init()).rejects.toBeInstanceOf(KnowledgeSchemaError);

    expect(await knowledgeObjects(schemaName)).toEqual(before);
  });
});

describe('PostgreSQL knowledge SQL normalization', () => {
  it('quotes canonical camel-case identifiers without rewriting string literals', () => {
    expect(
      postgresSql(
        `SELECT nodeId,scopeNodeId FROM "mastra_knowledge_node_scopes" WHERE nodeId='nodeId' AND scopeNodeId=?`,
        'knowledge',
      ),
    ).toBe(
      `SELECT "nodeId","scopeNodeId" FROM "knowledge"."mastra_knowledge_node_scopes" WHERE "nodeId"='nodeId' AND "scopeNodeId"=$1`,
    );
  });
});

describe('KnowledgePG storage isolation', () => {
  it('lets PostgresStore callers override the isolation key', () => {
    const derived = new PostgresStore({ id: 'derived', pool, schemaName: 'shared' });
    const overridden = new PostgresStore({
      id: 'overridden',
      pool,
      schemaName: 'shared',
      storageIsolationKey: 'tenant-a',
    });

    expect(overridden.stores.knowledge!.getStorageIsolationKey()).toBe('tenant-a');
    expect(derived.stores.knowledge!.getStorageIsolationKey()).toBe(
      new KnowledgePG({ pool, schemaName: 'shared' }).getStorageIsolationKey(),
    );
  });

  it('identifies domains using the same pool and schema as one physical backend', () => {
    expect(new KnowledgePG({ pool, schemaName: 'shared' }).getStorageIsolationKey()).toBe(
      new KnowledgePG({ pool, schemaName: 'shared' }).getStorageIsolationKey(),
    );
    expect(new KnowledgePG({ pool, schemaName: 'first' }).getStorageIsolationKey()).not.toBe(
      new KnowledgePG({ pool, schemaName: 'second' }).getStorageIsolationKey(),
    );
  });

  it('resolves separate client wrappers around the same pool', () => {
    expect(new KnowledgePG({ client: new PoolAdapter(pool), schemaName: 'shared' }).getStorageIsolationKey()).toBe(
      new KnowledgePG({ client: new PoolAdapter(pool), schemaName: 'shared' }).getStorageIsolationKey(),
    );
  });

  it('claims each semantic outbox entry through only one concurrent worker', async () => {
    const schemaName = `knowledge_claim_${process.pid}_${schemaCounter++}`;
    schemas.push(schemaName);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    const first = new KnowledgePG({ pool, schemaName });
    const second = new KnowledgePG({ pool, schemaName });
    await first.init();
    await first.createNode({ name: 'Claim once', scopeIds: [] });

    const [firstClaim, secondClaim] = await Promise.all([
      first.claimSemanticOutbox({ workerId: 'first', limit: 1 }),
      second.claimSemanticOutbox({ workerId: 'second', limit: 1 }),
    ]);

    expect([...firstClaim, ...secondClaim]).toHaveLength(1);
  });
});
