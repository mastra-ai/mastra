import { TABLE_SCHEMAS } from '@mastra/core/storage';
import type { TABLE_NAMES } from '@mastra/core/storage';
import { Client, Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
  }, 60000);

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
});
