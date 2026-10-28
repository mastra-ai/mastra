import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Client, Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DbClient } from '../client';
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

function captureIndexStatements(client: DbClient) {
  const statements: string[] = [];
  const record = (sql: string) => {
    if (/^(CREATE|DROP) (UNIQUE )?INDEX/i.test(sql)) statements.push(sql);
  };
  const none = client.none.bind(client);
  client.none = async (...args) => {
    record(args[0]);
    return none(...args);
  };
  const transaction = client.tx.bind(client);
  client.tx = callback =>
    transaction(async tx => {
      const none = tx.none.bind(tx);
      tx.none = async (...args) => {
        record(args[0]);
        return none(...args);
      };
      return callback(tx);
    });
  return statements;
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

  it.each(['statement', 'generated', 'finishes during probe'] as const)(
    'leaves a pre-existing external %s builder to its owner',
    async kind => {
      const name = await schema();
      await admin.query(`CREATE TABLE "${name}".mastra_favorites ("entityId" text)`);
      const writer = await admin.connect();
      const builder = await admin.connect();
      const pool = new Pool({ connectionString });
      const client = new RoutingDbClient(new PoolAdapter(pool));
      const snapshot = await loadSchemaSnapshot(client, name);
      client.setSchemaSnapshot(snapshot);
      const db = new PgDB({ client, schemaName: name });
      let building: Promise<unknown> | undefined;
      let recovering: Promise<void> | undefined;
      try {
        await writer.query('BEGIN');
        await writer.query(`INSERT INTO "${name}".mastra_favorites VALUES ('held writer')`);
        building = builder.query(
          `CREATE INDEX CONCURRENTLY idx_favorites_entity ON "${name}".mastra_favorites ("entityId")`,
        );
        void building.catch(() => {});
        await waitFor(
          async () =>
            (
              await admin.query('SELECT 1 FROM pg_stat_progress_create_index WHERE index_relid = to_regclass($1)', [
                `"${name}".idx_favorites_entity`,
              ])
            ).rows.length > 0,
        );
        const statements = captureIndexStatements(client);
        if (kind === 'finishes during probe') {
          const oneOrNone = client.oneOrNone.bind(client);
          client.oneOrNone = async (...args) => {
            if (args[0].includes('FROM pg_locks')) {
              await writer.query('COMMIT');
              await building;
            }
            return oneOrNone(...args);
          };
        }
        recovering =
          kind !== 'generated'
            ? db.createIndexFromStatement(
                'idx_favorites_entity',
                `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_favorites_entity ON "${name}".mastra_favorites ("entityId")`,
              )
            : db.createIndex({ name: 'idx_favorites_entity', table: 'mastra_favorites', columns: ['entityId'] });
        void recovering.catch(() => {});
        const result = await Promise.race([recovering.then(() => 'returned'), delay(1000).then(() => 'blocked')]);
        expect(result).toBe('returned');
        const finished = kind === 'finishes during probe';
        expect(snapshot.indexes.has('idx_favorites_entity')).toBe(finished);
        expect(await validIndexes(name)).toEqual([{ name: 'idx_favorites_entity', valid: finished }]);
        expect(statements).toEqual([]);
        await writer.query('COMMIT');
        await building;
        expect(await validIndexes(name)).toEqual([{ name: 'idx_favorites_entity', valid: true }]);
      } finally {
        await writer.query('ROLLBACK');
        writer.release();
        await building?.catch(() => {});
        await recovering?.catch(() => {});
        builder.release();
        await pool.end();
      }
    },
    60000,
  );

  it.each(['finishes', 'is cancelled'] as const)(
    'skips an active builder that %s and repairs a cancelled build on the next call',
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
        await recovery;
        expect(completed).toBe(true);
        if (outcome === 'is cancelled') {
          await admin.query(`SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE application_name = $1`, [
            `${name}_builder`,
          ]);
          await expect(building).rejects.toMatchObject({ code: '57014' });
        }
        await writer.query('COMMIT');
        if (outcome === 'finishes') await building;
        else await db.createIndexFromStatement('item_index', sql);
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

  it('does not drop a peer replacement after observing an abandoned index', async () => {
    const name = await schema();
    await admin.query(`CREATE TABLE "${name}".items (value text);
      CREATE INDEX item_index ON "${name}".items (value)`);
    await admin.query(`UPDATE pg_index SET indisvalid = false WHERE indexrelid = to_regclass($1)`, [
      `"${name}".item_index`,
    ]);
    const pools = [new Pool({ connectionString }), new Pool({ connectionString })];
    let release!: () => void;
    let observed!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const paused = new Promise<void>(resolve => {
      observed = resolve;
    });
    const client = new PoolAdapter(pools[0]!);
    const statements = captureIndexStatements(client);
    const transaction = client.tx.bind(client);
    client.tx = async callback => {
      observed();
      await gate;
      return transaction(callback);
    };
    const sql = `CREATE INDEX CONCURRENTLY IF NOT EXISTS item_index ON "${name}".items (value)`;
    const first = new PgDB({ client, schemaName: name }).createIndexFromStatement('item_index', sql);
    void first.catch(() => {});
    try {
      await paused;
      await new PgDB({ client: new PoolAdapter(pools[1]!), schemaName: name }).createIndexFromStatement(
        'item_index',
        sql,
      );
      const replacement = (await admin.query('SELECT to_regclass($1)::oid AS oid', [`"${name}".item_index`])).rows;
      release();
      await first;
      expect(statements).toEqual([]);
      expect((await admin.query('SELECT to_regclass($1)::oid AS oid', [`"${name}".item_index`])).rows).toEqual(
        replacement,
      );
      expect(await validIndexes(name)).toEqual([{ name: 'item_index', valid: true }]);
    } finally {
      release();
      await first.catch(() => {});
      await Promise.all(pools.map(pool => pool.end()));
    }
  }, 60000);

  it('serializes overlapping repair transactions without dropping a replacement', async () => {
    const name = await schema();
    await admin.query(`CREATE TABLE "${name}".items (value text);
      CREATE INDEX item_index ON "${name}".items (value)`);
    await admin.query('UPDATE pg_index SET indisvalid = false WHERE indexrelid = to_regclass($1)', [
      `"${name}".item_index`,
    ]);
    const pools = [new Pool({ connectionString, max: 1 }), new Pool({ connectionString, max: 1 })];
    const clients = pools.map(pool => new PoolAdapter(pool));
    const statements = clients.map(captureIndexStatements);
    let acquired!: () => void;
    let release!: () => void;
    const locked = new Promise<void>(resolve => {
      acquired = resolve;
    });
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const transaction = clients[0]!.tx.bind(clients[0]);
    clients[0]!.tx = callback =>
      transaction(async tx => {
        const none = tx.none.bind(tx);
        tx.none = async (...args) => {
          const result = await none(...args);
          if (args[0].startsWith('LOCK TABLE')) {
            acquired();
            await gate;
          }
          return result;
        };
        return callback(tx);
      });
    const secondTransaction = clients[1]!.tx.bind(clients[1]);
    let timeouts = 0;
    clients[1]!.tx = async callback => {
      try {
        return await secondTransaction(callback);
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === '55P03') timeouts++;
        throw error;
      }
    };
    const sql = `CREATE INDEX CONCURRENTLY IF NOT EXISTS item_index ON "${name}".items (value)`;
    const first = new PgDB({ client: clients[0]!, schemaName: name }).createIndexFromStatement('item_index', sql);
    void first.catch(() => {});
    let second: Promise<void> | undefined;
    try {
      await locked;
      second = new PgDB({ client: clients[1]!, schemaName: name }).createIndexFromStatement('item_index', sql);
      void second.catch(() => {});
      await waitFor(async () => timeouts > 0);
      expect(statements[1]).toEqual([]);
      release();
      await Promise.all([first, second]);
      expect(statements.flat().filter(sql => sql.startsWith('DROP INDEX'))).toHaveLength(1);
      expect(await validIndexes(name)).toEqual([{ name: 'item_index', valid: true }]);
    } finally {
      release();
      await Promise.allSettled([first, second]);
      await Promise.all(pools.map(pool => pool.end()));
    }
  }, 60000);

  it.each(['reader', 'maintenance'] as const)(
    'defers abandoned-index cleanup behind %s activity, then repairs',
    async activity => {
      const name = await schema();
      await admin.query(`CREATE TABLE "${name}".items (value text);
      CREATE INDEX item_index ON "${name}".items (value)`);
      await admin.query('UPDATE pg_index SET indisvalid = false WHERE indexrelid = to_regclass($1)', [
        `"${name}".item_index`,
      ]);
      const reader = await admin.connect();
      const pool = new Pool({ connectionString, max: 1 });
      const client = new PoolAdapter(pool);
      const statements = captureIndexStatements(client);
      const transaction = client.tx.bind(client);
      let lockTimeouts = 0;
      client.tx = async callback => {
        try {
          return await transaction(callback);
        } catch (error) {
          if (typeof error === 'object' && error !== null && 'code' in error && error.code === '55P03') lockTimeouts++;
          throw error;
        }
      };
      let recovery: Promise<void> | undefined;
      try {
        await reader.query('BEGIN');
        if (activity === 'maintenance') await reader.query(`LOCK TABLE "${name}".items IN SHARE UPDATE EXCLUSIVE MODE`);
        else await reader.query(`SELECT * FROM "${name}".items`);
        recovery = new PgDB({ client, schemaName: name }).createIndexFromStatement(
          'item_index',
          `CREATE INDEX CONCURRENTLY IF NOT EXISTS item_index ON "${name}".items (value)`,
        );
        void recovery.catch(() => {});
        await waitFor(async () => lockTimeouts > 0);
        expect(statements).toEqual([]);
        expect(await validIndexes(name)).toEqual([{ name: 'item_index', valid: false }]);
        const newReader = new Pool({ connectionString, options: '-c statement_timeout=1000' });
        try {
          await expect(newReader.query(`SELECT * FROM "${name}".items`)).resolves.toMatchObject({ rows: [] });
        } finally {
          await newReader.end();
        }
        await reader.query('COMMIT');
        await recovery;
        expect(await validIndexes(name)).toEqual([{ name: 'item_index', valid: true }]);
      } finally {
        await reader.query('ROLLBACK');
        reader.release();
        await recovery?.catch(() => {});
        await pool.end();
      }
    },
    60000,
  );

  it('rolls back the repair lock when cancelled before dropping the index', async () => {
    const name = await schema();
    await admin.query(`CREATE TABLE "${name}".items (value text);
      CREATE INDEX item_index ON "${name}".items (value)`);
    await admin.query('UPDATE pg_index SET indisvalid = false WHERE indexrelid = to_regclass($1)', [
      `"${name}".item_index`,
    ]);
    const pool = new Pool({ connectionString, max: 1, application_name: name });
    const client = new PoolAdapter(pool);
    const transaction = client.tx.bind(client);
    client.tx = callback =>
      transaction(async tx => {
        const none = tx.none.bind(tx);
        tx.none = async (...args) => {
          const result = await none(...args);
          if (args[0].startsWith('LOCK TABLE')) await none('SELECT pg_sleep(30)');
          return result;
        };
        return callback(tx);
      });
    const sql = `CREATE INDEX CONCURRENTLY IF NOT EXISTS item_index ON "${name}".items (value)`;
    const db = new PgDB({ client, schemaName: name });
    const recovery = db.createIndexFromStatement('item_index', sql);
    void recovery.catch(() => {});
    try {
      await waitFor(async () => {
        const { rows } = await admin.query(
          "SELECT pid FROM pg_stat_activity WHERE application_name = $1 AND wait_event = 'PgSleep'",
          [name],
        );
        if (!rows.length) return false;
        await admin.query('SELECT pg_cancel_backend($1)', [rows[0].pid]);
        return true;
      });
      await expect(recovery).rejects.toMatchObject({ code: '57014' });
      expect(await validIndexes(name)).toEqual([{ name: 'item_index', valid: false }]);
      client.tx = transaction;
      await db.createIndexFromStatement('item_index', sql);
      expect(await validIndexes(name)).toEqual([{ name: 'item_index', valid: true }]);
    } finally {
      await recovery.catch(() => {});
      await pool.end();
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
          await admin.query(`GRANT CREATE ON SCHEMA "${name}" TO "${observer}";
            CREATE TABLE "${name}".other_items (value text);
            ALTER TABLE "${name}".other_items OWNER TO "${observer}"`);
          const otherSql = `CREATE INDEX CONCURRENTLY other_index ON "${name}".other_items (value)`;
          await observerPool.query(otherSql);
          await admin.query(`UPDATE pg_index SET indisvalid = false WHERE indexrelid = to_regclass($1)`, [
            `"${name}".other_index`,
          ]);
          const before = await admin.query(`SELECT to_regclass($1)::oid AS oid`, [`"${name}".item_index`]);
          const progress = await observerPool.query(
            `SELECT pid, relid, index_relid FROM pg_stat_progress_create_index`,
          );
          expect(progress.rows.some(row => row.relid === null && row.index_relid === null)).toBe(true);
          const observerClient = new PoolAdapter(observerPool);
          const statements = captureIndexStatements(observerClient);
          const db = new PgDB({ client: observerClient, schemaName: name });
          const target = db.createIndexFromStatement('item_index', sql);
          void target.catch(() => {});
          expect(await Promise.race([target.then(() => 'returned'), delay(1000).then(() => 'blocked')])).toBe(
            'returned',
          );
          expect(statements).toEqual([]);
          recovery = db.createIndexFromStatement('other_index', otherSql);
          void recovery.catch(() => {});
          expect(await Promise.race([recovery.then(() => 'returned'), delay(1000).then(() => 'blocked')])).toBe(
            'returned',
          );
          expect((await validIndexes(name)).find(index => index.name === 'other_index')?.valid).toBe(true);
          expect(statements.filter(sql => /^DROP INDEX/i.test(sql))).toEqual([`DROP INDEX "${name}"."other_index"`]);
          await writer.query('COMMIT');
          await building;
          expect((await admin.query(`SELECT to_regclass($1)::oid AS oid`, [`"${name}".item_index`])).rows).toEqual(
            before.rows,
          );
          await expect(
            db.createIndexFromStatement('denied_index', `CREATE INDEX denied_index ON "${name}".items (value)`),
          ).rejects.toMatchObject({ code: '42501' });
        }
        expect(await validIndexes(name)).toEqual([
          { name: 'item_index', valid: true },
          ...(scenario === 'cross-role builder' ? [{ name: 'other_index', valid: true }] : []),
        ]);
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
      const statements = captureIndexStatements(client);
      const none = client.none.bind(client);
      client.none = async (...args) => {
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
