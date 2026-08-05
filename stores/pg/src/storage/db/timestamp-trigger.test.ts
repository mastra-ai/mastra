import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '..';
import { TEST_CONFIG, connectionString } from '../test-utils';

/**
 * The spans timestamp trigger is (re)established on every init. Recreating it
 * unconditionally means a `DROP TRIGGER` — and therefore an ACCESS EXCLUSIVE
 * lock on a hot table — every time any process starts. These cover that init
 * leaves the trigger alone when it is already correct, and still repairs it
 * when it is not.
 */

let adminPool: Pool;
const schemasToDrop: string[] = [];
const storesToClose: PostgresStore[] = [];

function uniqueSchema(prefix: string): string {
  const name = `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  schemasToDrop.push(name);
  return name;
}

async function newStore(schemaName: string): Promise<PostgresStore> {
  const store = new PostgresStore({ ...TEST_CONFIG, id: `trigger-test-${schemaName}`, schemaName });
  storesToClose.push(store);
  return store;
}

async function spansTrigger(schema: string): Promise<{ tgname: string; tgtype: number; fn: string } | undefined> {
  const { rows } = await adminPool.query(
    `SELECT tg.tgname, tg.tgtype, tg.tgfoid::regprocedure::text AS fn
       FROM pg_catalog.pg_trigger tg
      WHERE tg.tgrelid = format('%I.%I', $1::text, 'mastra_ai_spans')::regclass
        AND NOT tg.tgisinternal`,
    [schema],
  );
  return rows[0];
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
}, 60000);

describe('spans timestamp trigger', () => {
  it('does not take an exclusive lock on the spans table during a warm init', async () => {
    const schema = uniqueSchema('trg_lock');
    await adminPool.query(`CREATE SCHEMA "${schema}"`);

    const cold = await newStore(schema);
    await cold.init();
    await cold.close();

    // Hold an ordinary read lock from another session. An ACCESS EXCLUSIVE
    // request has to queue behind it, so an init that wants one cannot finish.
    const holder = await adminPool.connect();
    await holder.query('BEGIN');
    await holder.query(`SELECT count(*) FROM "${schema}"."mastra_ai_spans"`);

    try {
      const warm = await newStore(schema);
      const init = warm.init();

      const outcome = await Promise.race([
        init.then(() => 'completed' as const),
        new Promise<'blocked'>(resolve => setTimeout(() => resolve('blocked'), 5000)),
      ]);

      const { rows: waiting } = await adminPool.query(
        `SELECT mode FROM pg_locks
          WHERE relation = format('%I.%I', $1::text, 'mastra_ai_spans')::regclass
            AND NOT granted`,
        [schema],
      );

      expect(waiting.map(r => r.mode)).toEqual([]);
      expect(outcome).toBe('completed');
      await init;
    } finally {
      await holder.query('ROLLBACK');
      holder.release();
    }
  }, 90000);

  it('leaves an already-correct trigger in place and keeps it firing', async () => {
    const schema = uniqueSchema('trg_keep');
    await adminPool.query(`CREATE SCHEMA "${schema}"`);

    const cold = await newStore(schema);
    await cold.init();
    await cold.close();

    const before = await spansTrigger(schema);
    expect(before?.tgname).toBe('mastra_ai_spans_timestamps');

    const warm = await newStore(schema);
    await warm.init();

    // Same trigger row, not a rebuilt one.
    expect(await spansTrigger(schema)).toEqual(before);

    await adminPool.query(
      `INSERT INTO "${schema}"."mastra_ai_spans" ("traceId","spanId","name","spanType","startedAt","isEvent")
       VALUES ('t1','s1','n','agent_run', NOW(), false)`,
    );
    const { rows } = await adminPool.query(
      `SELECT "createdAt" IS NOT NULL AS stamped, "updatedAtZ" IS NOT NULL AS stamped_z
         FROM "${schema}"."mastra_ai_spans" WHERE "spanId" = 's1'`,
    );
    expect(rows[0]).toEqual({ stamped: true, stamped_z: true });
  }, 90000);

  it('rebuilds a trigger whose timing or events have drifted', async () => {
    const schema = uniqueSchema('trg_drift');
    await adminPool.query(`CREATE SCHEMA "${schema}"`);

    const cold = await newStore(schema);
    await cold.init();
    await cold.close();

    // Replace it with one that fires on INSERT only (tgtype 7, not 23). The
    // guard keys on the exact timing/events, so this must not be mistaken for
    // a correct trigger.
    await adminPool.query(`DROP TRIGGER mastra_ai_spans_timestamps ON "${schema}"."mastra_ai_spans"`);
    await adminPool.query(
      `CREATE TRIGGER mastra_ai_spans_timestamps
         BEFORE INSERT ON "${schema}"."mastra_ai_spans"
         FOR EACH ROW EXECUTE FUNCTION "${schema}".trigger_set_timestamps()`,
    );
    expect((await spansTrigger(schema))?.tgtype).toBe(7);

    const healer = await newStore(schema);
    await healer.init();

    expect((await spansTrigger(schema))?.tgtype).toBe(23);

    // And UPDATE stamping works again, which the drifted trigger had lost.
    await adminPool.query(
      `INSERT INTO "${schema}"."mastra_ai_spans" ("traceId","spanId","name","spanType","startedAt","isEvent")
       VALUES ('t1','s1','n','agent_run', NOW(), false)`,
    );
    const { rows: inserted } = await adminPool.query(
      `SELECT "updatedAt" FROM "${schema}"."mastra_ai_spans" WHERE "spanId" = 's1'`,
    );
    await adminPool.query(`UPDATE "${schema}"."mastra_ai_spans" SET name = 'n2' WHERE "spanId" = 's1'`);
    const { rows: updated } = await adminPool.query(
      `SELECT "updatedAt" FROM "${schema}"."mastra_ai_spans" WHERE "spanId" = 's1'`,
    );
    expect(updated[0].updatedAt.getTime()).toBeGreaterThan(inserted[0].updatedAt.getTime());
  }, 90000);
});
