import { TABLE_SCHEMAS } from '@mastra/core/storage';
import type { TABLE_NAMES } from '@mastra/core/storage';
import { Client, Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PostgresStore } from '..';
import { TEST_CONFIG, connectionString } from '../test-utils';
import { PgDB } from '.';

/**
 * Covers the init-window catalog snapshot: on an already-converged schema,
 * init() must stop re-asking the server what it already knows, while still
 * converging a cold or drifted schema exactly as before.
 */

let adminPool: Pool;
const schemasToDrop: string[] = [];
const storesToClose: PostgresStore[] = [];

function uniqueSchema(prefix: string): string {
  const name = `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  schemasToDrop.push(name);
  return name;
}

async function admin(sql: string, values?: unknown[]): Promise<any[]> {
  const result = await adminPool.query(sql, values as any);
  return result.rows;
}

async function newStore(schemaName: string): Promise<PostgresStore> {
  const store = new PostgresStore({ ...TEST_CONFIG, id: `snapshot-test-${schemaName}`, schemaName });
  storesToClose.push(store);
  return store;
}

/** Records every statement the pg driver sends while `fn` runs. */
async function captureStatements(fn: () => Promise<void>): Promise<string[]> {
  const statements: string[] = [];
  const original = Client.prototype.query;

  (Client.prototype as any).query = function (this: any, ...args: any[]) {
    const first = args[0];
    const text = typeof first === 'string' ? first : first?.text;
    if (typeof text === 'string') statements.push(text);
    return (original as any).apply(this, args);
  };

  try {
    await fn();
  } finally {
    (Client.prototype as any).query = original;
  }

  return statements;
}

function count(statements: string[], pattern: RegExp): number {
  return statements.filter(s => pattern.test(s)).length;
}

const INFORMATION_SCHEMA_COLUMN_PROBE = /information_schema\.columns/i;
const NO_OP_ALTER = /ALTER TABLE[\s\S]*ADD COLUMN IF NOT EXISTS/i;
const CREATE_TABLE = /CREATE TABLE IF NOT EXISTS/i;
const INDEX_PROBE = /FROM pg_indexes\b[\s\S]*indexname\s*=/i;
const CREATE_INDEX = /CREATE (UNIQUE )?INDEX/i;
const CONSTRAINT_PROBE = /FROM pg_constraint\b[\s\S]*conname\s*=/i;

async function indexesIn(schemaName: string): Promise<string[]> {
  const rows = await admin(`SELECT indexname FROM pg_catalog.pg_indexes WHERE schemaname = $1 ORDER BY indexname`, [
    schemaName,
  ]);
  return rows.map(r => r.indexname);
}

async function tablesIn(schemaName: string): Promise<string[]> {
  const rows = await admin(`SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = $1 ORDER BY tablename`, [
    schemaName,
  ]);
  return rows.map(r => r.tablename);
}

async function columnsIn(schemaName: string, tableName: string): Promise<Set<string>> {
  const rows = await admin(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
    [schemaName, tableName],
  );
  return new Set(rows.map(r => r.column_name));
}

beforeAll(async () => {
  adminPool = new Pool({ connectionString });
}, 30000);

afterAll(async () => {
  for (const store of storesToClose) {
    try {
      await store.close();
    } catch {}
  }
  for (const schema of schemasToDrop) {
    await admin(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  }
  await adminPool.end();
}, 60000);

describe('init catalog snapshot', () => {
  it('issues no column probes, no-op ALTERs, or CREATE TABLEs on a warm init', async () => {
    const schema = uniqueSchema('snapshot_warm');
    await admin(`CREATE SCHEMA "${schema}"`);

    const cold = await newStore(schema);
    await cold.init();
    await cold.close();

    const warm = await newStore(schema);
    const statements = await captureStatements(() => warm.init());

    // Guards the capture hook itself: the three snapshot reads must show up, or
    // the zero-counts below would be vacuously true.
    expect(count(statements, /pg_catalog\.pg_tables/i)).toBe(1);
    expect(count(statements, /pg_catalog\.pg_attribute/i)).toBe(1);
    expect(count(statements, /pg_catalog\.pg_index\b/i)).toBe(1);

    expect(count(statements, INFORMATION_SCHEMA_COLUMN_PROBE)).toBe(0);
    expect(count(statements, NO_OP_ALTER)).toBe(0);
    expect(count(statements, CREATE_TABLE)).toBe(0);
    expect(count(statements, INDEX_PROBE)).toBe(0);
    expect(count(statements, CREATE_INDEX)).toBe(0);
    // The spans PRIMARY KEY is index-backed, so the snapshot answers it too.
    expect(count(statements, CONSTRAINT_PROBE)).toBe(0);
  }, 60000);

  it('skips the schemata existence probe on a warm init in a fresh process', async () => {
    const schema = uniqueSchema('snapshot_fresh');
    await admin(`CREATE SCHEMA "${schema}"`);

    const cold = await newStore(schema);
    await cold.init();
    await cold.close();

    // The per-process schemaSetupRegistry hides the `information_schema.schemata`
    // probe from same-process re-inits, which is how it went unmeasured: a fresh
    // process (a CLI invocation, a serverless cold start) pays it on every warm
    // init. Reset the module graph so the registry starts empty, like a fresh
    // process would.
    vi.resetModules();
    const { PostgresStore: FreshPostgresStore } = await import('..');
    const warm = new FreshPostgresStore({ ...TEST_CONFIG, id: `snapshot-fresh-${schema}`, schemaName: schema });

    const statements = await captureStatements(() => warm.init());
    await warm.close();

    // Snapshot reads present (capture hook sanity), schemata probe absent: the
    // snapshot's tables prove the schema exists.
    expect(count(statements, /pg_catalog\.pg_tables/i)).toBe(1);
    expect(count(statements, /information_schema\.schemata/i)).toBe(0);

    // A cold schema in a fresh process still probes and creates it.
    vi.resetModules();
    const { PostgresStore: ColdFreshStore } = await import('..');
    const coldSchema = uniqueSchema('snapshot_fresh_cold');
    const coldFresh = new ColdFreshStore({
      ...TEST_CONFIG,
      id: `snapshot-fresh-${coldSchema}`,
      schemaName: coldSchema,
    });
    const coldStatements = await captureStatements(() => coldFresh.init());
    await coldFresh.close();
    expect(count(coldStatements, /information_schema\.schemata/i)).toBe(1);
    expect((await tablesIn(coldSchema)).length).toBeGreaterThan(0);
  }, 120000);

  it('converges a cold schema to the same tables and columns as another cold init', async () => {
    const schemaA = uniqueSchema('snapshot_cold_a');
    const schemaB = uniqueSchema('snapshot_cold_b');
    await admin(`CREATE SCHEMA "${schemaA}"`);
    await admin(`CREATE SCHEMA "${schemaB}"`);

    const storeA = await newStore(schemaA);
    const storeB = await newStore(schemaB);
    await storeA.init();
    await storeB.init();

    const tablesA = await tablesIn(schemaA);
    expect(tablesA.length).toBeGreaterThan(0);
    expect(await tablesIn(schemaB)).toEqual(tablesA);

    for (const table of tablesA) {
      const actual = await columnsIn(schemaA, table);
      expect(await columnsIn(schemaB, table)).toEqual(actual);

      // Every column the table's schema declares must exist, plus the `Z` twin
      // of each timestamp column.
      const declared = TABLE_SCHEMAS[table as TABLE_NAMES];
      if (!declared) continue;
      for (const [name, def] of Object.entries(declared)) {
        expect(actual.has(name), `${table}.${name} missing after cold init`).toBe(true);
        if (def.type === 'timestamp') {
          expect(actual.has(`${name}Z`), `${table}.${name}Z missing after cold init`).toBe(true);
        }
      }
    }
  }, 90000);

  it('heals a dropped column and a dropped table on the next init', async () => {
    const schema = uniqueSchema('snapshot_drift');
    await admin(`CREATE SCHEMA "${schema}"`);

    const first = await newStore(schema);
    await first.init();
    await first.close();

    const before = await tablesIn(schema);
    const droppedTable = before.find(t => t !== 'mastra_threads')!;

    await admin(`ALTER TABLE "${schema}".mastra_threads DROP COLUMN "createdAtZ"`);
    await admin(`DROP TABLE "${schema}"."${droppedTable}" CASCADE`);

    expect((await columnsIn(schema, 'mastra_threads')).has('createdAtZ')).toBe(false);
    expect(await tablesIn(schema)).not.toContain(droppedTable);

    const second = await newStore(schema);
    await second.init();

    expect((await columnsIn(schema, 'mastra_threads')).has('createdAtZ')).toBe(true);
    expect(await tablesIn(schema)).toContain(droppedTable);
  }, 90000);

  it('recreates indexes dropped out of band on the next init', async () => {
    // Deliberately short: default index names are schema-prefixed, and a long
    // schema pushes them past Postgres' 63-byte identifier limit, at which
    // point the domain logs and skips them.
    const schema = `sidx_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    schemasToDrop.push(schema);
    await admin(`CREATE SCHEMA "${schema}"`);

    const first = await newStore(schema);
    await first.init();
    await first.close();

    const before = await indexesIn(schema);
    // One index from the createIndex() path and one from the hand-written
    // CREATE INDEX path, so both snapshot readers are covered. The default
    // index's name is schema-prefixed and then truncated to 63 bytes by
    // Postgres, so it is located by definition rather than by name.
    const viaCreateIndex = `${schema}_mastra_threads_resourceid_createdat_idx`;
    expect(before).toContain(viaCreateIndex);
    expect(before).toContain('idx_favorites_entity');

    await admin(`DROP INDEX "${schema}"."${viaCreateIndex}"`);
    await admin(`DROP INDEX "${schema}".idx_favorites_entity`);

    const second = await newStore(schema);
    await second.init();

    const after = await indexesIn(schema);
    expect(after).toContain(viaCreateIndex);
    expect(after).toContain('idx_favorites_entity');
    expect(after).toEqual(before);
  }, 90000);

  it('does not let one schema\u2019s snapshot satisfy another schema\u2019s init', async () => {
    const converged = uniqueSchema('snapshot_scope_converged');
    const fresh = uniqueSchema('snapshot_scope_fresh');
    await admin(`CREATE SCHEMA "${converged}"`);
    await admin(`CREATE SCHEMA "${fresh}"`);

    const convergedStore = await newStore(converged);
    await convergedStore.init();

    const freshStore = await newStore(fresh);
    await freshStore.init();

    expect(await tablesIn(fresh)).toEqual(await tablesIn(converged));
  }, 90000);

  it('ignores unrelated tables, columns, and indexes sharing the schema', async () => {
    // A plugin (or anything else) is free to put its own objects in the schema
    // Mastra was pointed at. The snapshot is read for the whole schema, so this
    // pins that it stays a lookup table: unknown objects are never enumerated,
    // never touched, and never satisfy a Mastra object's existence check.
    const schema = uniqueSchema('snapshot_coexist');
    await admin(`CREATE SCHEMA "${schema}"`);

    const cold = await newStore(schema);
    await cold.init();
    await cold.close();

    await admin(`CREATE TABLE "${schema}".plugin_widgets (id text PRIMARY KEY, payload jsonb)`);
    await admin(`CREATE INDEX plugin_widgets_payload_idx ON "${schema}".plugin_widgets USING gin (payload)`);
    await admin(`ALTER TABLE "${schema}".mastra_threads ADD COLUMN plugin_tenant_id text`);
    await admin(`CREATE INDEX plugin_threads_tenant_idx ON "${schema}".mastra_threads (plugin_tenant_id)`);

    const mastraTablesBefore = (await tablesIn(schema)).filter(t => t !== 'plugin_widgets');

    const warm = await newStore(schema);
    const statements = await captureStatements(() => warm.init());

    // Same capture-hook guard as the warm-init test above.
    expect(count(statements, /pg_catalog\.pg_tables/i)).toBe(1);

    // The extra objects neither reintroduce probes nor provoke DDL.
    expect(count(statements, INFORMATION_SCHEMA_COLUMN_PROBE)).toBe(0);
    expect(count(statements, INDEX_PROBE)).toBe(0);
    expect(count(statements, CREATE_TABLE)).toBe(0);
    expect(count(statements, CREATE_INDEX)).toBe(0);
    expect(count(statements, NO_OP_ALTER)).toBe(0);

    // Nothing of the plugin's was dropped, altered, or recreated.
    expect(await tablesIn(schema)).toContain('plugin_widgets');
    expect(await indexesIn(schema)).toEqual(
      expect.arrayContaining(['plugin_widgets_payload_idx', 'plugin_threads_tenant_idx']),
    );
    expect((await columnsIn(schema, 'mastra_threads')).has('plugin_tenant_id')).toBe(true);
    expect((await tablesIn(schema)).filter(t => t !== 'plugin_widgets')).toEqual(mastraTablesBefore);

    // And drift in a Mastra table still heals with the plugin's column present.
    await admin(`ALTER TABLE "${schema}".mastra_threads DROP COLUMN "createdAtZ"`);
    const healer = await newStore(schema);
    await healer.init();

    const columns = await columnsIn(schema, 'mastra_threads');
    expect(columns.has('createdAtZ')).toBe(true);
    expect(columns.has('plugin_tenant_id')).toBe(true);
  }, 90000);

  it('stops using the snapshot once init has returned', async () => {
    const schema = uniqueSchema('snapshot_cleared');
    await admin(`CREATE SCHEMA "${schema}"`);

    const store = await newStore(schema);
    await store.init();

    const db = new PgDB({ client: store.db, schemaName: schema });
    expect(await db.hasColumn('mastra_threads', 'createdAtZ')).toBe(true);

    await admin(`ALTER TABLE "${schema}".mastra_threads DROP COLUMN "createdAtZ"`);

    // A snapshot that outlived init() would still report the column present.
    expect(await db.hasColumn('mastra_threads', 'createdAtZ')).toBe(false);
  }, 60000);

  it('migrates a legacy flat agents schema with the snapshot live', async () => {
    const schema = uniqueSchema('snapshot_legacy');
    await admin(`CREATE SCHEMA "${schema}"`);

    // A database last touched by a pre-versioning release: agent config fields
    // live directly on mastra_agents. The legacy migration renames this table
    // and recreates it in the new shape via raw DDL — every step of which must
    // keep the init snapshot honest, or later createTable/alterTable calls
    // skip work the rename just un-did.
    await admin(`
      CREATE TABLE "${schema}".mastra_agents (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        instructions TEXT,
        model JSONB,
        metadata JSONB,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);
    await admin(`INSERT INTO "${schema}".mastra_agents (id, name, instructions, model) VALUES ($1, $2, $3, $4)`, [
      'legacy-agent-1',
      'Legacy Agent',
      'be legacy',
      JSON.stringify({ provider: 'openai', name: 'gpt-4o' }),
    ]);

    const store = await newStore(schema);
    await store.init();

    const tables = await tablesIn(schema);
    expect(tables).toContain('mastra_agents');
    expect(tables).toContain('mastra_agent_versions');
    expect(tables).not.toContain('mastra_agents_legacy');

    // The table was rebuilt in the new thin shape…
    const agentColumns = await columnsIn(schema, 'mastra_agents');
    expect(agentColumns.has('activeVersionId')).toBe(true);
    expect(agentColumns.has('name')).toBe(false);

    // …and the legacy row's data survived the trip into the versions table.
    const agents = await admin(`SELECT id, "activeVersionId" FROM "${schema}".mastra_agents`);
    expect(agents).toHaveLength(1);
    expect(agents[0].id).toBe('legacy-agent-1');
    const versions = await admin(`SELECT "agentId", name FROM "${schema}".mastra_agent_versions`);
    expect(versions).toHaveLength(1);
    expect(versions[0].agentId).toBe('legacy-agent-1');
    expect(versions[0].name).toBe('Legacy Agent');
  }, 60000);

  it('migrates a snapshot-column agent_versions schema with the snapshot live', async () => {
    const schema = uniqueSchema('snapshot_versions');
    await admin(`CREATE SCHEMA "${schema}"`);

    const first = await newStore(schema);
    await first.init();
    await first.close();

    // A database from the intermediate era: agents already thin, but versions
    // still store one opaque snapshot blob per row. The migration drops the
    // table outright and relies on init() to recreate it — which only happens
    // if the drop is reflected in the init snapshot.
    await admin(`DROP TABLE "${schema}".mastra_agent_versions`);
    await admin(`
      CREATE TABLE "${schema}".mastra_agent_versions (
        id TEXT PRIMARY KEY,
        "agentId" TEXT,
        snapshot JSONB
      )
    `);

    const store = await newStore(schema);
    await store.init();

    const versionColumns = await columnsIn(schema, 'mastra_agent_versions');
    expect(versionColumns.has('snapshot')).toBe(false);
    expect(versionColumns.has('name')).toBe(true);
    expect(versionColumns.has('instructions')).toBe(true);
  }, 60000);
});
