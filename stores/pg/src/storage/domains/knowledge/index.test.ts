import { readFile } from 'node:fs/promises';
import { createKnowledgeSchemaLatchTests, createKnowledgeStorageTests } from '@internal/storage-test-utils';
import {
  knowledgeImporterBindingKey,
  KnowledgeSchemaError,
  MastraCompositeStore,
  TABLE_KNOWLEDGE_CURSORS,
  TABLE_KNOWLEDGE_SCHEMA,
} from '@mastra/core/storage';
import { Pool } from 'pg';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { PostgresStore } from '../..';
import { PoolAdapter, RoutingDbClient } from '../../client';
import type { DbClient } from '../../db';
import { loadSchemaSnapshot } from '../../db/schema-snapshot';
import { connectionString } from '../../test-utils';

import { getPgKnowledgeIsolationKey, KnowledgePG, postgresSql } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const pool = new Pool({ connectionString });
const schemas: string[] = [];
let schemaCounter = 0;
createKnowledgeStorageTests(async reopen => {
  const schemaName = reopen ? schemas.at(-1)! : `knowledge_canonical_${process.pid}_${schemaCounter++}`;
  if (!reopen) {
    schemas.push(schemaName);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
  }
  return new KnowledgePG({ pool, schemaName });
});

createKnowledgeSchemaLatchTests(async () => {
  const schemaName = `knowledge_latch_${process.pid}_${schemaCounter++}`;
  schemas.push(schemaName);
  await pool.query(`CREATE SCHEMA "${schemaName}"`);
  await pool.query(`CREATE TABLE "${schemaName}".mastra_knowledge_nodes (id TEXT PRIMARY KEY, name TEXT)`);
  await pool.query(`INSERT INTO "${schemaName}".mastra_knowledge_nodes (id, name) VALUES ('old', 'Old')`);
  return {
    store: new KnowledgePG({ pool, schemaName }),
    repair: async () => {
      await pool.query(`DROP TABLE "${schemaName}".mastra_knowledge_nodes`);
    },
  };
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
        replacedRecords: Array.from({ length: 105 }, (_, index) => ({
          id: `prior-${String(index).padStart(3, '0')}`,
          version: 1,
        })),
        deletedBy: 'curator',
        record: {
          id: 'replacement',
          text: 'Replacement [[New link]]',
          source: 'curator',
          scopeIds: [scopeId],
          metadata: { sourceThreadId: 'new' },
        },
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

  it.each([false, true])('preserves incidental legacy schema on startup (populated: %s)', async populated => {
    const schemaName = `knowledge_rollout_${process.pid}_${schemaCounter++}`;
    schemas.push(schemaName);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    await pool.query(`CREATE TABLE "${schemaName}".mastra_knowledge_nodes (id TEXT PRIMARY KEY, type TEXT)`);
    await pool.query(`CREATE INDEX legacy_type ON "${schemaName}".mastra_knowledge_nodes (type)`);
    await pool.query(`CREATE TABLE "${schemaName}".unrelated_sentinel (value TEXT)`);
    await pool.query(`INSERT INTO "${schemaName}".unrelated_sentinel VALUES ('preserved')`);
    if (populated) await pool.query(`INSERT INTO "${schemaName}".mastra_knowledge_nodes VALUES ('legacy', 'node')`);
    const before = await pool.query(
      'SELECT indexname, indexdef FROM pg_indexes WHERE schemaname=$1 ORDER BY indexname',
      [schemaName],
    );
    const storage = new PostgresStore({ id: 'rollout', pool, schemaName });
    try {
      await storage.init();
      await expect(new KnowledgePG({ pool, schemaName }).init()).rejects.toBeInstanceOf(KnowledgeSchemaError);
      const tables = await pool.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema=$1 AND table_name LIKE 'mastra_knowledge_%' ORDER BY table_name`,
        [schemaName],
      );
      expect(tables.rows.map(row => row.table_name)).toEqual(['mastra_knowledge_nodes']);
      const after = await pool.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname=$1 AND tablename='mastra_knowledge_nodes' ORDER BY indexname`,
        [schemaName],
      );
      expect(after.rows).toEqual(before.rows);
      expect((await pool.query(`SELECT * FROM "${schemaName}".mastra_knowledge_nodes`)).rows).toEqual(
        populated ? [{ id: 'legacy', type: 'node' }] : [],
      );
      expect((await pool.query(`SELECT value FROM "${schemaName}".unrelated_sentinel`)).rows).toEqual([
        { value: 'preserved' },
      ]);
    } finally {
      await storage.close();
    }
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

    const reset = store.dangerouslyReset();
    await expect(reset).rejects.toBeInstanceOf(KnowledgeSchemaError);
    await expect(reset).rejects.toThrow(/depend on the existing Knowledge tables\. Drop or detach them first/);

    const views = await pool.query(`SELECT table_name FROM information_schema.views WHERE table_schema = $1`, [
      schemaName,
    ]);
    expect(views.rows.map(row => row.table_name)).toEqual(['unrelated_report']);
    const marker = await pool.query(`SELECT id FROM "${schemaName}"."${TABLE_KNOWLEDGE_SCHEMA}"`);
    expect(marker.rows.map(row => row.id)).toEqual(['canonical']);
  });
});

async function createSchemaWithPublishedKnowledgeV1(prefix: string, fixture = 'published-1.29.0.sql'): Promise<string> {
  const schemaName = `${prefix}_${process.pid}_${schemaCounter++}`;
  schemas.push(schemaName);
  await pool.query(`CREATE SCHEMA "${schemaName}"`);
  const sql = await readFile(new URL(`./fixtures/${fixture}`, import.meta.url), 'utf8');
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

  it('initializes a pre-created schema for a role without CREATE on the database', async () => {
    const schemaName = `knowledge_schema_only_${process.pid}_${schemaCounter++}`;
    const role = `knowledge_schema_only_${process.pid}`;
    schemas.push(schemaName);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    await pool.query(`CREATE ROLE ${role} LOGIN PASSWORD 'schema-only' NOCREATEDB`);
    const url = new URL(connectionString);
    url.username = role;
    url.password = 'schema-only';
    const restricted = new Pool({ connectionString: url.toString() });
    try {
      await pool.query(`GRANT USAGE, CREATE ON SCHEMA "${schemaName}" TO ${role}`);
      const database = (await pool.query('SELECT current_database() AS name')).rows[0].name;
      const canCreate = await pool.query(`SELECT has_database_privilege($1, $2, 'CREATE') AS allowed`, [
        role,
        database,
      ]);
      expect(canCreate.rows[0].allowed).toBe(false);

      await new KnowledgePG({ pool: restricted, schemaName }).init();

      const marker = await pool.query(`SELECT "version" FROM "${schemaName}"."${TABLE_KNOWLEDGE_SCHEMA}"`);
      expect(marker.rows).toEqual([{ version: 1 }]);
    } finally {
      await restricted.end();
      await pool.query(`DROP OWNED BY ${role}`);
      await pool.query(`DROP ROLE ${role}`);
    }
  });

  it('rolls back the empty published layout if canonical creation fails and permits a retry', async () => {
    const schemaName = await createSchemaWithPublishedKnowledgeV1('knowledge_published_rollback');
    const before = await knowledgeObjects(schemaName);
    const client = new RoutingDbClient(new PoolAdapter(pool));
    const tx = client.tx.bind(client);
    const spy = vi.spyOn(client, 'tx').mockImplementation(callback =>
      tx(async t => {
        const none = t.none.bind(t);
        t.none = async (query, values) => {
          if (query.trimStart().startsWith('CREATE TABLE') && query.includes(TABLE_KNOWLEDGE_SCHEMA)) {
            throw new Error('injected schema creation failure');
          }
          return none(query, values);
        };
        return callback(t);
      }),
    );

    await expect(new KnowledgePG({ client, schemaName }).init()).rejects.toThrow('injected schema creation failure');
    spy.mockRestore();
    expect(await knowledgeObjects(schemaName)).toEqual(before);

    await new KnowledgePG({ client, schemaName }).init();
    const marker = await pool.query(`SELECT "version" FROM "${schemaName}"."${TABLE_KNOWLEDGE_SCHEMA}"`);
    expect(marker.rows).toEqual([{ version: 1 }]);
  });

  it.each(['an empty schema', 'the empty published layout'])(
    'lets concurrent first boots on %s all succeed with one initialization',
    async layout => {
      const schemaName =
        layout === 'an empty schema'
          ? `knowledge_concurrent_empty_${process.pid}_${schemaCounter++}`
          : await createSchemaWithPublishedKnowledgeV1('knowledge_concurrent_published');
      if (layout === 'an empty schema') {
        schemas.push(schemaName);
        await pool.query(`CREATE SCHEMA "${schemaName}"`);
      }
      const pools = Array.from({ length: 4 }, () => new Pool({ connectionString }));
      try {
        const results = await Promise.allSettled(pools.map(p => new KnowledgePG({ pool: p, schemaName }).init()));
        expect(results.map(result => result.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled', 'fulfilled']);
      } finally {
        await Promise.all(pools.map(p => p.end()));
      }
      const marker = await pool.query(`SELECT "version" FROM "${schemaName}"."${TABLE_KNOWLEDGE_SCHEMA}"`);
      expect(marker.rows).toEqual([{ version: 1 }]);
      const accessState = await pool.query(`SELECT epoch FROM "${schemaName}".mastra_knowledge_access_state`);
      expect(accessState.rows).toHaveLength(1);
      expect(await knowledgeObjects(schemaName)).not.toContain('table:mastra_knowledge_cursors');
    },
  );

  it('replaces a published layout that holds rows, discarding them and keeping other storage', async () => {
    const schemaName = await createSchemaWithPublishedKnowledgeV1('knowledge_published_rows');
    await pool.query(
      `INSERT INTO "${schemaName}".mastra_knowledge_nodes (id,type,name,"canonicalName",scope,"scopeKey",version,"createdAt","updatedAt") VALUES ('legacy','node','Legacy','legacy','[]','legacy',1,NOW(),NOW())`,
    );
    await pool.query(`CREATE TABLE "${schemaName}".mastra_threads (id TEXT PRIMARY KEY)`);
    await pool.query(`INSERT INTO "${schemaName}".mastra_threads (id) VALUES ('preserved')`);

    await new KnowledgePG({ pool, schemaName }).init();

    const marker = await pool.query(
      `SELECT "version" FROM "${schemaName}"."${TABLE_KNOWLEDGE_SCHEMA}" WHERE id = 'canonical'`,
    );
    expect(marker.rows[0]?.version).toBe(1);
    const legacy = await pool.query(`SELECT id FROM "${schemaName}".mastra_knowledge_nodes WHERE id = 'legacy'`);
    expect(legacy.rows).toEqual([]);
    const threads = await pool.query(`SELECT id FROM "${schemaName}".mastra_threads`);
    expect(threads.rows.map(row => row.id)).toEqual(['preserved']);
  });

  it('rejects a published layout that a host view depends on', async () => {
    const schemaName = await createSchemaWithPublishedKnowledgeV1('knowledge_published_view');
    await pool.query(
      `CREATE VIEW "${schemaName}".host_report AS SELECT id FROM "${schemaName}".mastra_knowledge_nodes`,
    );
    const before = await knowledgeObjects(schemaName);

    const init = new KnowledgePG({ pool, schemaName }).init();
    await expect(init).rejects.toBeInstanceOf(KnowledgeSchemaError);
    await expect(init).rejects.toThrow(/Drop or detach them first/);

    expect(await knowledgeObjects(schemaName)).toEqual(before);
  });

  it('rolls back and names the dependents when a host foreign key blocks replacing a published layout', async () => {
    const schemaName = await createSchemaWithPublishedKnowledgeV1('knowledge_published_fk');
    // Foreign keys are invisible to the view/trigger catalog checks, so only DROP TABLE detects them.
    await pool.query(
      `CREATE TABLE "${schemaName}".host_links (node_id TEXT REFERENCES "${schemaName}".mastra_knowledge_nodes(id))`,
    );
    const before = await knowledgeObjects(schemaName);

    const init = new KnowledgePG({ pool, schemaName }).init();
    await expect(init).rejects.toBeInstanceOf(KnowledgeSchemaError);
    await expect(init).rejects.toThrow(/depend on the existing Knowledge tables\. Drop or detach them first/);

    expect(await knowledgeObjects(schemaName)).toEqual(before);
  });

  it('keeps ordinary store init independent of Knowledge', async () => {
    const schemaName = await createSchemaWithPublishedKnowledgeV1('knowledge_store_init');
    await pool.query(
      `INSERT INTO "${schemaName}".mastra_knowledge_nodes (id,type,name,"canonicalName",scope,"scopeKey",version,"createdAt","updatedAt") VALUES ('legacy','node','Legacy','legacy','[]','legacy',1,NOW(),NOW())`,
    );
    const store = new PostgresStore({ id: 'knowledge-store-init', connectionString, schemaName });
    // Published Core releases without the knowledge-v2 feature init every domain from super.init().
    const preV2CoreInit = vi
      .spyOn(MastraCompositeStore.prototype, 'init')
      .mockImplementation(async function (this: MastraCompositeStore) {
        await Promise.all(Object.values(this.stores ?? {}).map(domain => domain?.init()));
      });
    try {
      const knowledgeInit = vi.spyOn(store.stores.knowledge!, 'init');

      await store.init();
      await store.stores.memory!.saveThread({
        thread: {
          id: 'thread-1',
          resourceId: 'resource-1',
          title: 'kept',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      expect(knowledgeInit).not.toHaveBeenCalled();
      preV2CoreInit.mockRestore();
      // Activating Knowledge replaces the published v1 layout, discarding its rows; threads stay.
      await store.getStore('knowledge');
      expect((await pool.query(`SELECT id FROM "${schemaName}".mastra_knowledge_nodes`)).rows).toEqual([]);
      expect((await store.stores.memory!.getThreadById({ threadId: 'thread-1' }))?.title).toBe('kept');
    } finally {
      preV2CoreInit.mockRestore();
      await store.close();
    }
  });

  it('keeps the retired cursor table of another schema when replacing or resetting', async () => {
    const emptySchema = await createSchemaWithPublishedKnowledgeV1('knowledge_retired_empty');
    const rowsSchema = await createSchemaWithPublishedKnowledgeV1('knowledge_retired_rows');
    const otherSchema = await createSchemaWithPublishedKnowledgeV1('knowledge_retired_other');
    const cursorRow = (schemaName: string) =>
      pool.query(
        `INSERT INTO "${schemaName}"."${TABLE_KNOWLEDGE_CURSORS}" ("sourceThreadId",agent,"lastKnowledgeId","updatedAt") VALUES ('thread','observer','k1',NOW())`,
      );
    const tableExists = async (schemaName: string, table: string) =>
      (await pool.query('SELECT to_regclass($1) AS oid', [`"${schemaName}"."${table}"`])).rows[0]?.oid !== null;
    const marker = async (schemaName: string) =>
      (await pool.query(`SELECT "version" FROM "${schemaName}"."${TABLE_KNOWLEDGE_SCHEMA}" WHERE id = 'canonical'`))
        .rows[0]?.version;
    // Unqualified names resolve to otherSchema, standing in for the default `public` schema.
    const searchPathPool = new Pool({ connectionString, options: `-c search_path=${otherSchema}` });
    try {
      await cursorRow(otherSchema);
      await cursorRow(rowsSchema);

      await new KnowledgePG({ pool: searchPathPool, schemaName: emptySchema }).init();
      expect(await marker(emptySchema)).toBe(1);
      expect(await tableExists(emptySchema, TABLE_KNOWLEDGE_CURSORS)).toBe(false);

      const rowsStore = new KnowledgePG({ pool: searchPathPool, schemaName: rowsSchema });
      await rowsStore.init();
      expect(await marker(rowsSchema)).toBe(1);
      expect(await tableExists(rowsSchema, TABLE_KNOWLEDGE_CURSORS)).toBe(false);
      await rowsStore.dangerouslyReset();
      expect(await marker(rowsSchema)).toBe(1);
      expect(await tableExists(rowsSchema, TABLE_KNOWLEDGE_CURSORS)).toBe(false);

      const otherCursors = await pool.query(
        `SELECT "sourceThreadId" FROM "${otherSchema}"."${TABLE_KNOWLEDGE_CURSORS}"`,
      );
      expect(otherCursors.rows).toEqual([{ sourceThreadId: 'thread' }]);
    } finally {
      await searchPathPool.end();
    }
  });

  it('rejects a published layout carrying an unfamiliar index', async () => {
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

  it('canonicalizes equivalent connection forms', () => {
    expect(
      getPgKnowledgeIsolationKey({
        connectionString: 'postgresql://first:secret@EXAMPLE.com/knowledge?sslmode=require',
        schemaName: 'shared',
      }),
    ).toBe(
      getPgKnowledgeIsolationKey({ host: 'example.com', port: 5432, database: 'knowledge', schemaName: 'shared' }),
    );
  });

  it('identifies pools that reach the same database through PG environment defaults', () => {
    const saved = { PGHOST: process.env.PGHOST, PGPORT: process.env.PGPORT, PGDATABASE: process.env.PGDATABASE };
    Object.assign(process.env, { PGHOST: 'db.internal', PGPORT: '6543', PGDATABASE: 'knowledge' });
    const first = new Pool();
    const second = new Pool();
    try {
      const key = getPgKnowledgeIsolationKey({ pool: first, schemaName: 'shared' });
      expect(key).toBe('pg:db.internal:6543/knowledge:schema:shared');
      expect(getPgKnowledgeIsolationKey({ pool: second, schemaName: 'shared' })).toBe(key);
      expect(
        getPgKnowledgeIsolationKey({ host: 'DB.internal', port: 6543, database: 'knowledge', schemaName: 'shared' }),
      ).toBe(key);
      expect(getPgKnowledgeIsolationKey({ pool: second, schemaName: 'other' })).not.toBe(key);
    } finally {
      for (const [name, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      void first.end();
      void second.end();
    }
  });

  it('treats stores whose database cannot be determined as possibly shared', () => {
    const first = { query: async () => ({ rows: [] }) } as unknown as DbClient;
    const second = { query: async () => ({ rows: [] }) } as unknown as DbClient;
    expect(getPgKnowledgeIsolationKey({ client: first, schemaName: 'shared' })).toBe(
      getPgKnowledgeIsolationKey({ client: second, schemaName: 'shared' }),
    );
    expect(getPgKnowledgeIsolationKey({ client: first, schemaName: 'first' })).not.toBe(
      getPgKnowledgeIsolationKey({ client: second, schemaName: 'second' }),
    );
  });

  it('resolves separate client wrappers around the same pool', () => {
    expect(new KnowledgePG({ client: new PoolAdapter(pool), schemaName: 'shared' }).getStorageIsolationKey()).toBe(
      new KnowledgePG({ client: new PoolAdapter(pool), schemaName: 'shared' }).getStorageIsolationKey(),
    );
  });

  it('serializes concurrent grant reconciliation across clients', async () => {
    const schemaName = `knowledge_access_${process.pid}_${schemaCounter++}`;
    schemas.push(schemaName);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    const first = new KnowledgePG({ pool, schemaName });
    const second = new KnowledgePG({ pool, schemaName });
    await first.init();
    const plan = {
      scopes: [
        { address: 'principal:shared', name: 'Shared principal' },
        {
          address: 'project:shared',
          name: 'Shared project',
          grants: [{ scopeRefAddress: 'principal:shared', role: 'edit' as const }],
        },
      ],
    };

    const [left, right] = await Promise.all([first.reconcileStructure(plan), second.reconcileStructure(plan)]);

    expect(left.scopes).toEqual(right.scopes);
    expect([left.changed, right.changed].sort()).toEqual([false, true]);
    expect(await first.getAccessEpoch()).toBe(1);
    expect(await second.getAccessEpoch()).toBe(1);
    expect(await second.listScopeGrants()).toEqual([
      {
        scopeNodeId: left.scopes['project:shared'],
        scopeRefId: left.scopes['principal:shared'],
        role: 'edit',
        canSuggest: undefined,
      },
    ]);

    // Grant changes on an existing scope flow through the governed grant API; reconcile
    // seeds grants only when it creates the scope. Concurrent governed grant writes
    // serialize and advance one epoch each.
    const withRole = (role: 'append' | 'owner') => ({
      scopeNodeId: left.scopes['project:shared']!,
      scopeRefId: left.scopes['principal:shared']!,
      role,
    });
    const [appendResult, ownerResult] = await Promise.all([
      first.upsertScopeGrant(withRole('append')),
      second.upsertScopeGrant(withRole('owner')),
    ]);
    const finalRole = appendResult.accessEpoch > ownerResult.accessEpoch ? 'append' : 'owner';
    expect([appendResult.accessEpoch, ownerResult.accessEpoch].sort()).toEqual([2, 3]);
    expect(await first.getAccessEpoch()).toBe(3);
    expect(await first.listScopeGrants()).toEqual([
      {
        scopeNodeId: left.scopes['project:shared'],
        scopeRefId: left.scopes['principal:shared'],
        role: finalRole,
        canSuggest: undefined,
      },
    ]);

    // Re-materializing the seeded structure must not resurrect or re-impose the planned grant.
    const rematerialized = await first.reconcileStructure(plan);
    expect(rematerialized).toMatchObject({ changed: false, accessEpoch: 3 });
    expect(await first.listScopeGrants()).toEqual([
      {
        scopeNodeId: left.scopes['project:shared'],
        scopeRefId: left.scopes['principal:shared'],
        role: finalRole,
        canSuggest: undefined,
      },
    ]);
  });

  it('claims one importer run and skips one overlapping cron enqueue across clients', async () => {
    const schemaName = `knowledge_import_claim_${process.pid}_${schemaCounter++}`;
    schemas.push(schemaName);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    const first = new KnowledgePG({ pool, schemaName });
    const second = new KnowledgePG({ pool, schemaName });
    await first.init();
    const binding = knowledgeImporterBindingKey({ source: 'calendar:primary', scope: 'project:mastra' });
    const enqueue = (store: KnowledgePG, id: string, triggerKind: 'webhook' | 'cron') =>
      store.enqueueImportRun({
        id,
        importerId: 'calendar',
        binding,
        importKind: 'static',
        triggerKind,
        payloadKey: `payload/${id}`,
        payload: '{}',
        skipIfActiveCron: triggerKind === 'cron',
      });
    await enqueue(first, 'webhook-1', 'webhook');

    const claims = await Promise.all([
      first.claimImportRun({ importerId: 'calendar', binding, workerId: 'first', leaseKey: 'lease/' }),
      second.claimImportRun({ importerId: 'calendar', binding, workerId: 'second', leaseKey: 'lease/' }),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(claims.find(Boolean)).toMatchObject({ id: 'webhook-1' });

    const cronBinding = knowledgeImporterBindingKey({ source: 'calendar:cron', scope: 'project:mastra' });
    const enqueueCron = (store: KnowledgePG, id: string) =>
      store.enqueueImportRun({
        id,
        importerId: 'calendar',
        binding: cronBinding,
        importKind: 'static',
        triggerKind: 'cron',
        payloadKey: `payload/${id}`,
        payload: '{}',
        skipIfActiveCron: true,
      });
    const cronRuns = await Promise.all([enqueueCron(first, 'cron-1'), enqueueCron(second, 'cron-2')]);
    expect(cronRuns.map(run => run.status).sort()).toEqual(['queued', 'skipped']);
  });

  it('does not lock or starve a visible scope behind a disjoint outbox backlog', async () => {
    const schemaName = `knowledge_scoped_claim_${process.pid}_${schemaCounter++}`;
    schemas.push(schemaName);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    const first = new KnowledgePG({ pool, schemaName });
    const second = new KnowledgePG({ pool, schemaName });
    await first.init();
    const firstScopeId = crypto.randomUUID();
    const secondScopeId = crypto.randomUUID();
    await first.createNode({ id: firstScopeId, name: 'First claim scope', isScope: true, scopeIds: [] });
    await first.createNode({ id: secondScopeId, name: 'Second claim scope', isScope: true, scopeIds: [] });
    for (let index = 0; index < 150; index++) {
      await first.createNode({ name: `Second hidden subject ${index}`, scopeIds: [secondScopeId] });
    }
    const firstSubject = await first.createNode({ name: 'First visible subject', scopeIds: [firstScopeId] });

    const [firstClaim, secondClaim] = await Promise.all([
      first.claimSemanticOutbox({ workerId: 'first-scope-worker', scopeIds: [firstScopeId], limit: 1 }),
      second.claimSemanticOutbox({ workerId: 'second-scope-worker', scopeIds: [secondScopeId], limit: 1 }),
    ]);

    expect(firstClaim).toHaveLength(1);
    expect(firstClaim[0]?.documentId).toContain(firstSubject.id);
    expect(secondClaim).toHaveLength(1);
    expect(secondClaim[0]?.scopeIds).toEqual([secondScopeId]);
  });

  it('keeps outbox reads bounded when stale scope stamps overlap the caller but current visibility fails', async () => {
    const schemaName = `knowledge_stale_outbox_${process.pid}_${schemaCounter++}`;
    schemas.push(schemaName);
    let queries = 0;
    const countingPool = new Proxy(pool, {
      get(target, prop) {
        if (prop === 'query') {
          const query = target.query.bind(target);
          return async (...args: Parameters<typeof query>) => {
            queries += 1;
            return query(...args);
          };
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    const store = new KnowledgePG({ pool: countingPool, schemaName });
    await store.init();
    const callerScopeId = crypto.randomUUID();
    const hiddenScopeId = crypto.randomUUID();
    await store.createNode({ id: callerScopeId, name: 'Caller scope', isScope: true, scopeIds: [] });
    await store.createNode({ id: hiddenScopeId, name: 'Hidden scope', isScope: true, scopeIds: [] });

    // Stale-overlap backlog: rows stamped with the caller scope at enqueue
    // time whose nodes have since moved into the hidden scope — the SQL
    // visibility predicate must exclude them inside the bounded query.
    for (let index = 0; index < 50; index++) {
      const node = await store.createNode({ name: `Stale subject ${index}`, scopeIds: [callerScopeId] });
      await store.updateNode({ id: node.id, version: node.version, scopeIds: [hiddenScopeId] });
    }
    const mentionTarget = await store.createNode({ name: 'MentionTarget', scopeIds: [callerScopeId] });
    const owner = await store.createNode({ name: 'Record owner', scopeIds: [callerScopeId] });
    await store.createRecord({ node: owner.id, text: 'See [[MentionTarget]] for details.', scopeIds: [callerScopeId] });
    await store.updateNode({ id: mentionTarget.id, version: mentionTarget.version, scopeIds: [hiddenScopeId] });
    const visible = await store.createNode({ name: 'Visible subject', scopeIds: [callerScopeId] });

    // Visible to the caller: the two live upserts plus the reindex `delete`
    // entries (stamped with the caller scope at move time) — never a stale
    // upsert whose current scope state is hidden.
    queries = 0;
    const listed = await store.listSemanticOutbox({ scopeIds: [callerScopeId], limit: 200 });
    expect(listed).toHaveLength(53);
    for (const entry of listed) {
      if (entry.operation === 'upsert') {
        expect([visible.id, owner.id].some(id => entry.documentId.includes(id))).toBe(true);
      } else {
        expect(entry.operation).toBe('delete');
      }
    }
    expect(queries).toBe(1);

    queries = 0;
    const claimed = await store.claimSemanticOutbox({ workerId: 'stale-worker', scopeIds: [callerScopeId], limit: 5 });
    // reindex deletes queue behind their stale (filtered) upserts, so only the
    // two legitimate upserts are claimable — the stale backlog is never walked
    expect(claimed).toHaveLength(2);
    for (const entry of claimed) {
      expect(entry.operation).toBe('upsert');
      expect([visible.id, owner.id].some(id => entry.documentId.includes(id))).toBe(true);
    }
    // BEGIN, bounded SELECT, SKIP LOCKED lock, one claim UPDATE per row, COMMIT
    expect(queries).toBeLessThanOrEqual(10);
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

describe('KnowledgePG timestamps', () => {
  it('round-trips node and record timestamps as UTC when the process timezone is not UTC', async () => {
    const schemaName = `knowledge_tz_${process.pid}_${schemaCounter++}`;
    schemas.push(schemaName);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    const tz = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    try {
      const store = new KnowledgePG({ pool, schemaName });
      await store.init();
      const before = Date.now();
      const scope = await store.createNode({ name: 'TZ scope', isScope: true, scopeIds: [] });
      const node = await store.createNode({ name: 'TZ probe', scopeIds: [scope.id] });
      const record = await store.createRecord({ node, text: 'utc round-trip probe', scopeIds: [scope.id] });

      const readNode = await store.getNode(node.id);
      const readRecord = await store.getRecord({ id: record.id });
      expect(readNode?.createdAt.toISOString()).toBe(node.createdAt.toISOString());
      expect(readRecord?.createdAt.toISOString()).toBe(record.createdAt.toISOString());
      expect(Math.abs((readRecord?.createdAt.getTime() ?? 0) - before)).toBeLessThan(60_000);
    } finally {
      if (tz === undefined) delete process.env.TZ;
      else process.env.TZ = tz;
    }
  });
});

describe('KnowledgePG interim canonical-model layout', () => {
  const INTERIM_FIXTURE = 'interim-1.76.0-alpha.3.sql';

  it('replaces the layout the interim release created, discarding its rows and keeping other storage', async () => {
    const schemaName = await createSchemaWithPublishedKnowledgeV1('knowledge_interim_rows', INTERIM_FIXTURE);
    await pool.query(
      `INSERT INTO "${schemaName}".mastra_knowledge_semantic_outbox (id,"idempotencyKey","documentId","documentType",operation,scope,"scopeKey",status,attempts,"availableAt","createdAt") VALUES ('legacy','legacy','legacy','node','upsert','[]','legacy','completed',1,now(),now())`,
    );
    await pool.query(`CREATE TABLE "${schemaName}".mastra_threads (id TEXT PRIMARY KEY)`);
    await pool.query(`INSERT INTO "${schemaName}".mastra_threads (id) VALUES ('preserved')`);

    await new KnowledgePG({ pool, schemaName }).init();

    const marker = await pool.query(
      `SELECT "version" FROM "${schemaName}"."${TABLE_KNOWLEDGE_SCHEMA}" WHERE id = 'canonical'`,
    );
    expect(marker.rows[0]?.version).toBe(1);
    const outbox = await pool.query(`SELECT id FROM "${schemaName}".mastra_knowledge_semantic_outbox`);
    expect(outbox.rows).toEqual([]);
    const nodeColumns = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'mastra_knowledge_nodes'`,
      [schemaName],
    );
    expect(nodeColumns.rows.map(row => row.column_name)).not.toContain('canonicalName');
    const threads = await pool.query(`SELECT id FROM "${schemaName}".mastra_threads`);
    expect(threads.rows.map(row => row.id)).toEqual(['preserved']);
    await new KnowledgePG({ pool, schemaName }).init();
  });

  it('leaves a modified interim layout untouched', async () => {
    const schemaName = await createSchemaWithPublishedKnowledgeV1('knowledge_interim_column', INTERIM_FIXTURE);
    await pool.query(`ALTER TABLE "${schemaName}".mastra_knowledge_nodes ADD COLUMN host_note text`);
    const before = await knowledgeObjects(schemaName);

    await expect(new KnowledgePG({ pool, schemaName }).init()).rejects.toBeInstanceOf(KnowledgeSchemaError);

    expect(await knowledgeObjects(schemaName)).toEqual(before);
  });

  it('leaves an interim layout with an unfamiliar index untouched', async () => {
    const schemaName = await createSchemaWithPublishedKnowledgeV1('knowledge_interim_index', INTERIM_FIXTURE);
    await pool.query(`CREATE INDEX host_index ON "${schemaName}".mastra_knowledge_records ("text")`);
    const before = await knowledgeObjects(schemaName);

    await expect(new KnowledgePG({ pool, schemaName }).init()).rejects.toBeInstanceOf(KnowledgeSchemaError);

    expect(await knowledgeObjects(schemaName)).toEqual(before);
  });

  it.each(['snapshot-w1-20261006001735.sql', 'snapshot-w1-20261007232522.sql'])(
    'replaces the layout published snapshot %s created, discarding its rows',
    async fixture => {
      const schemaName = await createSchemaWithPublishedKnowledgeV1('knowledge_snapshot_rows', fixture);
      await pool.query(
        `INSERT INTO "${schemaName}".mastra_knowledge_semantic_outbox (id,"idempotencyKey","documentId","documentType",operation,scope,"scopeKey",status,attempts,"availableAt","createdAt") VALUES ('legacy','legacy','legacy','node','upsert','[]','legacy','completed',1,now(),now())`,
      );

      await new KnowledgePG({ pool, schemaName }).init();

      const outbox = await pool.query(`SELECT id FROM "${schemaName}".mastra_knowledge_semantic_outbox`);
      expect(outbox.rows).toEqual([]);
      const cursors = await pool.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'mastra_knowledge_cursors'`,
        [schemaName],
      );
      expect(cursors.rows).toEqual([]);
      await new KnowledgePG({ pool, schemaName }).init();
    },
  );

  it('replaces an early-snapshot layout that later interim builds re-initialized', async () => {
    const schemaName = await createSchemaWithPublishedKnowledgeV1(
      'knowledge_snapshot_upgraded',
      'snapshot-w1-20261006001735.sql',
    );
    // Later builds added these indexes with IF NOT EXISTS but never dropped the early columns or table.
    await pool.query(
      `CREATE INDEX idx_knowledge_nodes_name ON "${schemaName}".mastra_knowledge_nodes (type, "canonicalName")`,
    );
    await pool.query(
      `CREATE INDEX idx_knowledge_records_scope ON "${schemaName}".mastra_knowledge_records ("scopeKey", id)`,
    );
    await pool.query(
      `CREATE INDEX idx_knowledge_activity_scope ON "${schemaName}".mastra_knowledge_activity ("scopeKey", id DESC)`,
    );

    await new KnowledgePG({ pool, schemaName }).init();

    const marker = await pool.query(
      `SELECT "version" FROM "${schemaName}"."${TABLE_KNOWLEDGE_SCHEMA}" WHERE id = 'canonical'`,
    );
    expect(marker.rows[0]?.version).toBe(1);
  });

  it('leaves a layout mixing snapshot shapes untouched', async () => {
    const schemaName = await createSchemaWithPublishedKnowledgeV1(
      'knowledge_snapshot_mixed',
      'snapshot-w1-20261007232522.sql',
    );
    await pool.query(`ALTER TABLE "${schemaName}".mastra_knowledge_records ADD COLUMN "nodeId" text`);
    const before = await knowledgeObjects(schemaName);

    await expect(new KnowledgePG({ pool, schemaName }).init()).rejects.toBeInstanceOf(KnowledgeSchemaError);

    expect(await knowledgeObjects(schemaName)).toEqual(before);
  });
});
