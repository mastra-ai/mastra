import { Client, Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '..';
import { TEST_CONFIG, connectionString } from '../test-utils';

/**
 * The init-window catalog snapshot under stress: several processes starting at
 * once, a role that may read the schema but not change it, and a store whose
 * init is called more than once.
 */

const RESTRICTED_ROLE = 'mastra_snapshot_restricted';
const RESTRICTED_PASSWORD = 'test123';

let adminPool: Pool;
const schemasToDrop: string[] = [];
const storesToClose: PostgresStore[] = [];

function uniqueSchema(prefix: string): string {
  const name = `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  schemasToDrop.push(name);
  return name;
}

function newStore(schemaName: string, overrides: Record<string, unknown> = {}): PostgresStore {
  const store = new PostgresStore({
    ...TEST_CONFIG,
    id: `stress-${schemaName}-${Math.random().toString(36).slice(2, 6)}`,
    schemaName,
    ...overrides,
  } as any);
  storesToClose.push(store);
  return store;
}

/** Records every statement the pg driver sends while `fn` runs, and any that fail. */
async function captureStatements(fn: () => Promise<void>): Promise<{ sent: string[]; failed: string[] }> {
  const sent: string[] = [];
  const failed: string[] = [];
  const original = Client.prototype.query;

  (Client.prototype as any).query = function (this: any, ...args: any[]) {
    const first = args[0];
    const text = typeof first === 'string' ? first : first?.text;
    if (typeof text === 'string') sent.push(text);
    const result = (original as any).apply(this, args);
    if (result && typeof result.then === 'function' && typeof text === 'string') {
      return result.catch((error: any) => {
        failed.push(`${error?.message}  <<  ${text.replace(/\s+/g, ' ').slice(0, 80)}`);
        throw error;
      });
    }
    return result;
  };

  try {
    await fn();
  } finally {
    (Client.prototype as any).query = original;
  }

  return { sent, failed };
}

function count(statements: string[], pattern: RegExp): number {
  return statements.filter(s => pattern.test(s)).length;
}

const SNAPSHOT_READ = /FROM pg_catalog\.pg_(tables|class|index)\b/i;
const WRITE_DDL = /^\s*(CREATE|ALTER|DROP)\s+(TABLE|INDEX|UNIQUE INDEX)/im;

async function tableCount(schema: string): Promise<number> {
  const { rows } = await adminPool.query(`SELECT count(*)::int AS n FROM pg_catalog.pg_tables WHERE schemaname = $1`, [
    schema,
  ]);
  return rows[0].n;
}

async function columnsOf(schema: string): Promise<string[]> {
  const { rows } = await adminPool.query(
    `SELECT c.relname || '.' || a.attname AS col
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
      WHERE n.nspname = $1 AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY 1`,
    [schema],
  );
  return rows.map(r => r.col);
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
    await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  }
  await adminPool.end();
}, 120000);

describe('init snapshot under stress', () => {
  /**
   * Scoped to warm concurrent init on purpose. Cold concurrent init — several
   * processes racing to build an empty schema — is broken independently of the
   * snapshot: `CREATE INDEX IF NOT EXISTS` and `CREATE TABLE IF NOT EXISTS`
   * are not atomic against a concurrent backend, so the losers get a duplicate
   * `pg_class` key or a deadlock. Measured on this test database, 5 rounds of
   * 2 racing cold inits: 10/10 failed before the snapshot work, 5/10 after.
   * That is a pre-existing bug and is not this change's to fix; asserting a
   * cold race here would be asserting someone else's fix.
   *
   * Warm concurrent init is the case this change is about — every process
   * after the first, which is the serverless shape — and it is clean: 0/20
   * failures on both revisions.
   */
  it('converges correctly when several stores init a converged schema at once', async () => {
    const schema = uniqueSchema('stress_race');
    await adminPool.query(`CREATE SCHEMA "${schema}"`);

    await newStore(schema).init();
    const settledTables = await tableCount(schema);
    const settledColumns = await columnsOf(schema);

    // Four processes start together against the converged schema. Each loads
    // its own snapshot; none of them may decide to write anything.
    const stores = [newStore(schema), newStore(schema), newStore(schema), newStore(schema)];
    const { sent, failed } = await captureStatements(async () => {
      const results = await Promise.allSettled(stores.map(s => s.init()));
      const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
      expect(rejected.map(r => String((r.reason as any)?.cause?.message ?? r.reason))).toEqual([]);
    });

    // `CREATE OR REPLACE FUNCTION` for the timestamp trigger is deliberately
    // unconditional so an upgraded function body lands, and Postgres does not
    // serialize it — racing backends get "tuple concurrently updated". That is
    // pre-existing and harmless: init logs it and carries on, and the function
    // the losers failed to rewrite is already the one they wanted. Nothing
    // else may fail.
    expect(failed.filter(s => !/CREATE OR REPLACE FUNCTION/i.test(s))).toEqual([]);
    expect(count(sent, WRITE_DDL)).toBe(0);
    // One snapshot per store, not one per domain.
    expect(count(sent, SNAPSHOT_READ)).toBe(3 * stores.length);

    // The schema is untouched by the stampede.
    expect(await tableCount(schema)).toBe(settledTables);
    expect(await columnsOf(schema)).toEqual(settledColumns);
  }, 180000);

  it('initializes a converged schema as a role that may read it but not change it', async () => {
    const schema = uniqueSchema('stress_restricted');
    await adminPool.query(`CREATE SCHEMA "${schema}"`);

    // A privileged deploy step converges the schema first.
    const owner = newStore(schema);
    await owner.init();
    await owner.close();

    await adminPool.query(
      `DO $$ BEGIN
         IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${RESTRICTED_ROLE}') THEN
           CREATE USER ${RESTRICTED_ROLE} WITH PASSWORD '${RESTRICTED_PASSWORD}' NOCREATEDB;
         END IF;
       END $$;`,
    );
    // Exactly enough to use the schema: connect, look at it, read and write
    // rows. No CREATE on the schema, no ownership of the tables.
    await adminPool.query(`GRANT CONNECT ON DATABASE "${(TEST_CONFIG as any).database}" TO ${RESTRICTED_ROLE}`);
    await adminPool.query(`GRANT USAGE ON SCHEMA "${schema}" TO ${RESTRICTED_ROLE}`);
    await adminPool.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "${schema}" TO ${RESTRICTED_ROLE}`,
    );
    await adminPool.query(`REVOKE CREATE ON SCHEMA "${schema}" FROM ${RESTRICTED_ROLE}, PUBLIC`);

    try {
      const restricted = newStore(schema, { user: RESTRICTED_ROLE, password: RESTRICTED_PASSWORD });

      const { sent, failed } = await captureStatements(async () => {
        await restricted.init();
      });

      // The snapshot answers every existence question, so init never reaches
      // for a privilege it does not have. Before the snapshot, the very first
      // unconditional `CREATE TABLE IF NOT EXISTS` aborted init here.
      expect(count(sent, WRITE_DDL)).toBe(0);
      expect(count(sent, SNAPSHOT_READ)).toBe(3);

      // `CREATE OR REPLACE FUNCTION` for the timestamp trigger stays
      // unconditional so function-body upgrades land, and it is the one
      // statement a non-owner cannot run. init already treats that as a
      // warning rather than a failure, and nothing else is denied.
      expect(failed.filter(s => !/CREATE OR REPLACE FUNCTION/i.test(s))).toEqual([]);

      // Storage is actually usable afterwards.
      const id = `restricted-${Date.now()}`;
      const at = new Date();
      await restricted.stores.memory!.saveThread({
        thread: { id, resourceId: 'r1', title: 'restricted', createdAt: at, updatedAt: at, metadata: {} },
      });
      expect((await restricted.stores.memory!.getThreadById({ threadId: id }))?.id).toBe(id);
    } finally {
      await adminPool.query(`REVOKE ALL ON ALL TABLES IN SCHEMA "${schema}" FROM ${RESTRICTED_ROLE}`);
      await adminPool.query(`REVOKE ALL ON SCHEMA "${schema}" FROM ${RESTRICTED_ROLE}`);
    }
  }, 180000);

  it('does not re-read the catalog on a repeated init, and never reuses a stale snapshot', async () => {
    const schema = uniqueSchema('stress_repeat');
    await adminPool.query(`CREATE SCHEMA "${schema}"`);

    const store = newStore(schema);
    await store.init();

    // Same instance: init is already done, so it costs nothing at all.
    const second = await captureStatements(async () => {
      await store.init();
    });
    expect(second.sent).toEqual([]);

    // A fresh instance re-reads the catalog rather than trusting anything
    // cached — drop a table behind its back and it must come back.
    const before = await tableCount(schema);
    await adminPool.query(`DROP TABLE "${schema}"."mastra_favorites"`);
    expect(await tableCount(schema)).toBe(before - 1);

    const reopened = newStore(schema);
    const third = await captureStatements(async () => {
      await reopened.init();
    });
    expect(count(third.sent, SNAPSHOT_READ)).toBe(3);
    expect(count(third.sent, /CREATE TABLE IF NOT EXISTS/i)).toBe(1);
    expect(await tableCount(schema)).toBe(before);
    const { rows } = await adminPool.query(
      `SELECT to_regclass(format('%I.%I', $1::text, 'mastra_favorites')) IS NOT NULL AS present`,
      [schema],
    );
    expect(rows[0].present).toBe(true);
  }, 180000);
});
