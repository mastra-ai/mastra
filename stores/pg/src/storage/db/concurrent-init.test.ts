import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Client, Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PoolAdapter, RoutingDbClient } from '../client';
import { WorkflowsPG, workflowSnapshotStatusIndexName, workflowSnapshotThreadIdIndexName } from '../domains/workflows';
import { PostgresStore } from '../index';
import { loadSchemaSnapshot } from './schema-snapshot';
import { PgDB } from './index';

const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';
let admin: Pool;
const schemas: string[] = [];

async function schema(prefix = 'cold') {
  const name = `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  schemas.push(name);
  await admin.query(`CREATE SCHEMA "${name}"`);
  return name;
}

async function waitFor(check: () => Promise<boolean>) {
  const deadline = Date.now() + 10000;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for database barrier');
    await delay(20);
  }
}

async function validIndexes(name: string) {
  const { rows } = await admin.query<{ name: string; valid: boolean }>(
    `SELECT c.relname AS name, i.indisvalid AS valid FROM pg_index i
     JOIN pg_class c ON c.oid = i.indexrelid JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = $1 ORDER BY c.relname`,
    [name],
  );
  return rows;
}

beforeAll(() => {
  admin = new Pool({ connectionString });
});
afterAll(async () => {
  for (const name of schemas) await admin.query(`DROP SCHEMA IF EXISTS "${name}" CASCADE`);
  await admin.end();
});

describe('concurrent first boot (COR-1495)', () => {
  it.each(['statement', 'generated'] as const)(
    'accepts a committed competing %s index without hiding catalog errors',
    async kind => {
      const name = await schema();
      await admin.query(`CREATE TABLE "${name}".mastra_favorites ("entityId" text)`);
      const winner = await admin.connect();
      const pool = new Pool({ connectionString, max: 1, application_name: `${name}_loser` });
      const db = new PgDB({ client: new PoolAdapter(pool), schemaName: name });
      let build: Promise<void> | undefined;
      try {
        await winner.query('BEGIN');
        await winner.query(`CREATE INDEX idx_favorites_entity ON "${name}".mastra_favorites ("entityId")`);
        build =
          kind === 'statement'
            ? db.createIndexFromStatement(
                'idx_favorites_entity',
                `CREATE INDEX IF NOT EXISTS idx_favorites_entity ON "${name}".mastra_favorites ("entityId")`,
              )
            : db.createIndex({ name: 'idx_favorites_entity', table: 'mastra_favorites', columns: ['entityId'] });
        // Attach immediately so a regression rejection is never unhandled.
        void build.catch(() => {});
        await waitFor(async () => {
          const { rows } = await admin.query(
            `SELECT 1 FROM pg_stat_activity WHERE application_name = $1 AND wait_event_type = 'Lock'`,
            [`${name}_loser`],
          );
          return rows.length > 0;
        });
        await winner.query('COMMIT');
        await build;
        expect(await validIndexes(name)).toEqual([{ name: 'idx_favorites_entity', valid: true }]);
      } finally {
        await winner.query('ROLLBACK');
        winner.release();
        await build?.catch(() => {});
        await pool.end();
      }
    },
  );

  it.each(['unique data', 'non-index name', 'syntax'] as const)('preserves genuine %s failures', async kind => {
    const name = await schema();
    await admin.query(
      `CREATE TABLE "${name}".items (value text); INSERT INTO "${name}".items VALUES ('duplicate'), ('duplicate')`,
    );
    if (kind === 'non-index name') await admin.query(`CREATE TABLE "${name}".item_index (value text)`);
    const pool = new Pool({ connectionString });
    const db = new PgDB({ client: new PoolAdapter(pool), schemaName: name });
    try {
      const sql =
        kind === 'syntax'
          ? 'CREATE INDEX invalid syntax'
          : `CREATE UNIQUE INDEX CONCURRENTLY item_index ON "${name}".items (value)`;
      await expect(db.createIndexFromStatement('item_index', sql)).rejects.toThrow();
      expect((await validIndexes(name)).some(index => index.name === 'item_index' && index.valid)).toBe(false);
    } finally {
      await pool.end();
    }
  });

  it.each(['finishes', 'is cancelled'] as const)(
    'waits for an active builder that %s, then leaves a valid index',
    async outcome => {
      const name = await schema();
      await admin.query(`CREATE TABLE "${name}".items (value text)`);
      const writer = await admin.connect();
      const builder = new Client({ connectionString, application_name: `${name}_builder` });
      await builder.connect();
      const pool = new Pool({ connectionString });
      const db = new PgDB({ client: new PoolAdapter(pool), schemaName: name });
      let building: Promise<unknown> | undefined;
      let recovery: Promise<void> | undefined;
      const sql = `CREATE INDEX CONCURRENTLY item_index ON "${name}".items (value)`;
      try {
        await writer.query('BEGIN');
        await writer.query(`INSERT INTO "${name}".items VALUES ('open writer')`);
        building = builder.query(sql);
        void building.catch(() => {});
        await waitFor(async () => {
          const { rows } = await admin.query(
            `SELECT 1 FROM pg_stat_progress_create_index WHERE index_relid = to_regclass($1)`,
            [`"${name}".item_index`],
          );
          return rows.length > 0;
        });
        let completed = false;
        recovery = db.createIndexFromStatement('item_index', sql).then(() => {
          completed = true;
        });
        void recovery.catch(() => {});
        await delay(150);
        expect(completed).toBe(false);
        if (outcome === 'is cancelled') {
          await admin.query(`SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE application_name = $1`, [
            `${name}_builder`,
          ]);
          await expect(building).rejects.toMatchObject({ code: '57014' });
        }
        await writer.query('COMMIT');
        if (outcome === 'finishes') await building;
        await recovery;
        expect(await validIndexes(name)).toEqual([{ name: 'item_index', valid: true }]);
      } finally {
        await writer.query('ROLLBACK');
        writer.release();
        await building?.catch(() => {});
        await recovery?.catch(() => {});
        await builder.end();
        await pool.end();
      }
    },
    60000,
  );

  it('repairs an invalid artifact created after the init snapshot and tolerates two repairers', async () => {
    const name = await schema();
    await admin.query(`CREATE TABLE "${name}".items (value text)`);
    const pools = [new Pool({ connectionString }), new Pool({ connectionString })];
    try {
      const clients = pools.map(pool => new RoutingDbClient(new PoolAdapter(pool)));
      for (const client of clients) client.setSchemaSnapshot(await loadSchemaSnapshot(client, name));
      await admin.query(`CREATE INDEX item_index ON "${name}".items (value)`);
      await admin.query(`UPDATE pg_index SET indisvalid = false WHERE indexrelid = to_regclass($1)`, [
        `"${name}".item_index`,
      ]);
      const results = await Promise.allSettled(
        clients.map(client =>
          new PgDB({ client, schemaName: name }).createIndexFromStatement(
            'item_index',
            `CREATE INDEX IF NOT EXISTS item_index ON "${name}".items (value)`,
          ),
        ),
      );
      expect(results.filter(result => result.status === 'rejected')).toEqual([]);
      expect(await validIndexes(name)).toEqual([{ name: 'item_index', valid: true }]);
    } finally {
      await Promise.all(pools.map(pool => pool.end()));
    }
  }, 60000);

  it.each(['same role repair', 'cross-role builder'] as const)(
    'handles non-superuser visibility: %s',
    async scenario => {
      const name = await schema();
      const owner = `${name}_owner`;
      const observer = `${name}_observer`;
      const password = randomUUID();
      const rolePool = (role: string) => {
        const url = new URL(connectionString);
        url.username = role;
        url.password = password;
        return new Pool({ connectionString: url.toString(), max: 1 });
      };
      await admin.query(`CREATE ROLE "${owner}" LOGIN PASSWORD '${password}'`);
      await admin.query(`CREATE ROLE "${observer}" LOGIN PASSWORD '${password}'`);
      const ownerPool = rolePool(owner);
      const observerPool = rolePool(observer);
      const writer = await admin.connect();
      let building: Promise<unknown> | undefined;
      let recovery: Promise<void> | undefined;
      try {
        await admin.query(
          `GRANT USAGE, CREATE ON SCHEMA "${name}" TO "${owner}"; GRANT USAGE ON SCHEMA "${name}" TO "${observer}"`,
        );
        await admin.query(`CREATE TABLE "${name}".items (value text); ALTER TABLE "${name}".items OWNER TO "${owner}"`);
        const sql = `CREATE INDEX CONCURRENTLY item_index ON "${name}".items (value)`;
        if (scenario === 'same role repair') {
          await ownerPool.query(sql);
          await admin.query(`UPDATE pg_index SET indisvalid = false WHERE indexrelid = to_regclass($1)`, [
            `"${name}".item_index`,
          ]);
          const db = new PgDB({ client: new PoolAdapter(ownerPool), schemaName: name });
          await db.createIndexFromStatement('item_index', sql);
        } else {
          await writer.query('BEGIN');
          await writer.query(`INSERT INTO "${name}".items VALUES ('open writer')`);
          building = ownerPool.query(sql);
          void building.catch(() => {});
          await waitFor(async () => {
            const { rows } = await admin.query(
              `SELECT 1 FROM pg_stat_progress_create_index WHERE index_relid = to_regclass($1)`,
              [`"${name}".item_index`],
            );
            return rows.length > 0;
          });
          const before = await admin.query(`SELECT to_regclass($1)::oid AS oid`, [`"${name}".item_index`]);
          const progress = await observerPool.query(
            `SELECT pid, relid, index_relid FROM pg_stat_progress_create_index`,
          );
          expect(progress.rows.some(row => row.relid === null && row.index_relid === null)).toBe(true);
          const observerClient = new PoolAdapter(observerPool);
          const statements: string[] = [];
          const none = observerClient.none.bind(observerClient);
          observerClient.none = async (...args) => {
            statements.push(args[0]);
            return none(...args);
          };
          const db = new PgDB({ client: observerClient, schemaName: name });
          recovery = db.createIndexFromStatement('item_index', sql);
          void recovery.catch(() => {});
          await delay(150);
          await writer.query('COMMIT');
          await building;
          await recovery;
          expect(statements.filter(sql => /^DROP INDEX/i.test(sql))).toEqual([]);
          expect((await admin.query(`SELECT to_regclass($1)::oid AS oid`, [`"${name}".item_index`])).rows).toEqual(
            before.rows,
          );
          await expect(
            db.createIndexFromStatement('denied_index', `CREATE INDEX denied_index ON "${name}".items (value)`),
          ).rejects.toMatchObject({ code: '42501' });
        }
        expect(await validIndexes(name)).toEqual([{ name: 'item_index', valid: true }]);
      } finally {
        await writer.query('ROLLBACK');
        writer.release();
        await building?.catch(() => {});
        await recovery?.catch(() => {});
        await Promise.all([ownerPool.end(), observerPool.end()]);
        await admin.query(`DROP SCHEMA "${name}" CASCADE`);
        await admin.query(`DROP ROLE "${owner}"; DROP ROLE "${observer}"`);
      }
    },
    60000,
  );

  it.each(['recovers', 'exhausts', 'finishes past the observation deadline'] as const)(
    'a real builder %s',
    async scenario => {
      const name = await schema();
      const lockKey = Math.floor(Math.random() * 1000000000);
      await admin.query(`CREATE TABLE "${name}".items (value text); INSERT INTO "${name}".items VALUES ('indexed')`);
      await admin.query(`CREATE FUNCTION "${name}".locked_value(value text) RETURNS text
      LANGUAGE plpgsql IMMUTABLE PARALLEL UNSAFE AS $$ BEGIN
        PERFORM pg_advisory_xact_lock(${lockKey}); RETURN value; END $$`);
      const controller = await admin.connect();
      const pool = new Pool({
        connectionString,
        max: 1,
        options: '-c deadlock_timeout=50ms -c max_parallel_maintenance_workers=0',
        application_name: `${name}_deadlock`,
      });
      const client = new PoolAdapter(pool);
      const errors: string[] = [];
      const statements: string[] = [];
      const none = client.none.bind(client);
      client.none = async (...args) => {
        statements.push(args[0]);
        try {
          return await none(...args);
        } catch (error) {
          if (typeof error === 'object' && error !== null && 'code' in error) errors.push(String(error.code));
          throw error;
        }
      };
      const db = new PgDB({ client, schemaName: name });
      let recovery: Promise<void> | undefined;
      try {
        expect((await pool.query('SHOW deadlock_timeout')).rows[0].deadlock_timeout).toBe('50ms');
        await controller.query('BEGIN');
        await controller.query(`SET LOCAL deadlock_timeout = '10s'`);
        await controller.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);
        recovery = db.createIndexFromStatement(
          'item_index',
          `CREATE INDEX CONCURRENTLY item_index ON "${name}".items ("${name}".locked_value(value))`,
        );
        void recovery.catch(() => {});
        for (let attempt = 1; attempt <= (scenario === 'exhausts' ? 3 : 1); attempt++) {
          await waitFor(async () => {
            const { rows } = await admin.query(
              `SELECT 1 FROM pg_stat_activity WHERE application_name = $1 AND wait_event = 'advisory'`,
              [`${name}_deadlock`],
            );
            return rows.length > 0;
          });
          if (scenario === 'finishes past the observation deadline') {
            await delay(30100);
          } else {
            await controller.query(`LOCK TABLE "${name}".items IN ACCESS EXCLUSIVE MODE`);
          }
          await controller.query('COMMIT');
          if (scenario === 'exhausts' && attempt < 3) {
            await controller.query('BEGIN');
            await controller.query(`SET LOCAL deadlock_timeout = '10s'`);
            await controller.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);
          }
        }
        if (scenario === 'exhausts') {
          await expect(recovery).rejects.toMatchObject({ name: 'IndexBuildError' });
          expect(errors.filter(code => code === '40P01')).toHaveLength(3);
          expect(statements.filter(sql => /^CREATE INDEX/i.test(sql))).toHaveLength(3);
          expect(statements.filter(sql => /^DROP INDEX/i.test(sql))).toHaveLength(2);
        } else {
          await recovery;
          if (scenario === 'recovers') expect(errors).toContain('40P01');
          expect(await validIndexes(name)).toEqual([{ name: 'item_index', valid: true }]);
        }
      } finally {
        await controller.query('ROLLBACK');
        controller.release();
        await recovery?.catch(() => {});
        await pool.end();
      }
    },
    60000,
  );

  it('retries a real non-index initialization deadlock with a fresh snapshot', async () => {
    const name = await schema();
    const trigger = `guard_${name}`;
    const lockKey = Math.floor(Math.random() * 1000000000);
    const controller = await admin.connect();
    const errors: string[] = [];
    const statements: string[] = [];
    const pool = new Pool({ connectionString, max: 1, options: '-c deadlock_timeout=50ms', application_name: name });
    pool.on('connect', client => {
      const query = client.query;
      (client as any).query = function (...args: any[]) {
        statements.push(typeof args[0] === 'string' ? args[0] : args[0]?.text);
        const result = (query as any).apply(this, args);
        if (!result?.catch) return result;
        return result.catch((error: { code: string }) => {
          errors.push(error.code);
          throw error;
        });
      };
    });
    const store = new PostgresStore({ id: name, pool, schemaName: name });
    let initializing: Promise<void> | undefined;
    try {
      await admin.query(`CREATE TABLE "${name}".blocker (value text)`);
      await admin.query(`CREATE FUNCTION "${name}".before_create() RETURNS event_trigger
        LANGUAGE plpgsql AS $$ BEGIN
          IF position('"${name}"."mastra_favorites"' IN current_query()) > 0 THEN
            PERFORM 1 FROM "${name}".blocker;
            PERFORM pg_advisory_xact_lock(${lockKey});
          END IF;
        END $$`);
      await admin.query(`CREATE EVENT TRIGGER "${trigger}" ON ddl_command_start
        WHEN TAG IN ('CREATE TABLE') EXECUTE FUNCTION "${name}".before_create()`);
      await controller.query('BEGIN');
      await controller.query(`SET LOCAL deadlock_timeout = '10s'`);
      await controller.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);
      initializing = store.init();
      void initializing.catch(() => {});
      await waitFor(async () => {
        const { rows } = await admin.query(
          `SELECT 1 FROM pg_stat_activity WHERE application_name = $1 AND wait_event = 'advisory'`,
          [name],
        );
        return rows.length > 0;
      });
      await controller.query(`LOCK TABLE "${name}".blocker IN ACCESS EXCLUSIVE MODE`);
      await controller.query('COMMIT');
      await initializing;
      expect(errors).toContain('40P01');
      expect(statements.filter(sql => /FROM pg_catalog\.pg_index\b/.test(sql))).toHaveLength(2);
      expect(await validIndexes(name)).toContainEqual({ name: 'idx_favorites_entity', valid: true });
    } finally {
      await controller.query('ROLLBACK');
      controller.release();
      await initializing?.catch(() => {});
      await admin.query(`DROP EVENT TRIGGER IF EXISTS "${trigger}"`);
      await store.close();
      await pool.end();
    }
  }, 60000);

  it('does not hide an unrelated existing spans primary key', async () => {
    const name = await schema();
    await admin.query(`CREATE TABLE "${name}".mastra_ai_spans (
      "traceId" text PRIMARY KEY, "spanId" text NOT NULL)`);
    const pool = new Pool({ connectionString });
    try {
      const db = new PgDB({ client: new PoolAdapter(pool), schemaName: name });
      await expect(db.migrateSpans()).rejects.toMatchObject({ cause: { code: '42P16' } });
    } finally {
      await pool.end();
    }
  });

  it('isolates identically named indexes in quoted tenant schemas', async () => {
    const names = await Promise.all([schema('tenant-a'), schema('tenant-b')]);
    const pool = new Pool({ connectionString });
    try {
      for (const name of names) {
        await admin.query(`CREATE TABLE "${name}".items (value text)`);
        const db = new PgDB({ client: new PoolAdapter(pool), schemaName: name });
        await db.createIndexFromStatement('item-index', `CREATE INDEX "item-index" ON "${name}".items (value)`);
        await admin.query(`UPDATE pg_index SET indisvalid = false WHERE indexrelid = to_regclass($1)`, [
          `"${name}"."item-index"`,
        ]);
        await db.createIndexFromStatement('item-index', `CREATE INDEX "item-index" ON "${name}".items (value)`);
        expect(await validIndexes(name)).toEqual([{ name: 'item-index', valid: true }]);
      }
    } finally {
      await pool.end();
    }
  });

  it('boots two independent stores against an empty schema', async () => {
    const name = await schema();
    const stores = [0, 1].map(i => new PostgresStore({ id: `cold-${i}`, connectionString, schemaName: name }));
    const original = Client.prototype.query;
    const arrivals = new Set<Client>();
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const timeout = setTimeout(release, 10000);
    // Pass real query results through, holding only the final snapshot read so
    // both independent backends capture the same empty schema before DDL.
    (Client.prototype as any).query = function (this: Client, ...args: any[]) {
      const text = typeof args[0] === 'string' ? args[0] : args[0]?.text;
      const result = (original as any).apply(this, args);
      if (/FROM pg_catalog\.pg_index\b/.test(text ?? '') && args[1]?.[0] === name) {
        return result.then(async (value: unknown) => {
          arrivals.add(this);
          if (arrivals.size === 2) release();
          await gate;
          return value;
        });
      }
      return result;
    };
    try {
      const results = await Promise.allSettled(stores.map(store => store.init()));
      expect(arrivals.size).toBe(2);
      expect(results.filter(result => result.status === 'rejected')).toEqual([]);
      const indexes = await validIndexes(name);
      const workflows = await stores[0]!.getStore('workflows');
      expect(workflows).toBeInstanceOf(WorkflowsPG);
      const expected = [
        'idx_favorites_entity',
        workflowSnapshotStatusIndexName(name),
        workflowSnapshotThreadIdIndexName(name),
        ...(workflows as WorkflowsPG).getDefaultIndexDefinitions().map(index => index.name),
      ];
      for (const indexName of expected) expect(indexes).toContainEqual({ name: indexName, valid: true });
      expect(indexes.filter(index => !index.valid)).toEqual([]);
      const tables = await admin.query('SELECT tablename FROM pg_tables WHERE schemaname = $1', [name]);
      expect(tables.rows.map(row => row.tablename)).toEqual(
        expect.arrayContaining([
          'mastra_favorites',
          'mastra_workflow_snapshot',
          'mastra_ai_spans',
          'mastra_skill_blobs',
        ]),
      );
      const blobs = await stores[0]!.getStore('blobs');
      await blobs!.put({ hash: 'boot', content: 'ready', size: 5, mimeType: 'text/plain' });
      expect((await (await stores[1]!.getStore('blobs'))!.get('boot'))?.content).toBe('ready');
    } finally {
      release();
      clearTimeout(timeout);
      Client.prototype.query = original;
      await Promise.all(stores.map(store => store.close()));
    }
  }, 120000);
});
