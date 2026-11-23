import { randomUUID } from 'node:crypto';

import type { FactoryStorage } from '@mastra/core/storage';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { createIsolatedFactoryPostgresForTests } from '../../test-utils.js';
import { WorkItemsStorage } from './base.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;
const THREAD_ADDRESS = ['org_id', 'thread_id', 'resource_id', 'session_id'];

interface Statement {
  sql: string;
  args: unknown[];
}

interface LibSQLExecutor {
  execute(statement: Statement): Promise<{ rows: ArrayLike<Record<string, unknown>> }>;
}

interface PgClient {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  release(): void;
}

interface PgPool {
  query(text: string, values?: unknown[]): Promise<unknown>;
  connect(): Promise<PgClient>;
}

interface QueryProbe {
  bindingReads(): Statement[];
  indexKeys(statement: Statement): Promise<string[]>;
}

function hasMethod<K extends string>(value: unknown, key: K): value is Record<K, unknown> {
  return typeof value === 'object' && value !== null && typeof Reflect.get(value, key) === 'function';
}

function isLibSQLExecutor(value: unknown): value is LibSQLExecutor {
  return hasMethod(value, 'execute');
}

function isPgPool(value: unknown): value is PgPool {
  return hasMethod(value, 'query') && hasMethod(value, 'connect');
}

function probeLibSQL(storage: FactoryStorage): QueryProbe {
  const db = storage.authDatabase();
  if (db.dialect !== 'libsql' || !isLibSQLExecutor(db.client)) throw new Error('expected a libsql client');
  const client = db.client;
  const clientClass: LibSQLExecutor = Object.getPrototypeOf(client);
  const execute = vi.spyOn(clientClass, 'execute');
  onTestFinished(() => execute.mockRestore());
  return {
    bindingReads: () =>
      execute.mock.calls
        .map(([statement]) => statement)
        .filter(({ sql }) => sql.includes('FROM "factory_run_bindings"')),
    async indexKeys({ sql, args }) {
      const { rows } = await client.execute({ sql: `EXPLAIN QUERY PLAN ${sql}`, args });
      return Array.from(rows).flatMap(row => {
        const keys = /USING (?:COVERING )?INDEX \w+ \(([^)]*)\)/.exec(String(row.detail))?.[1];
        return keys ? keys.split(' AND ').map(key => key.split('=')[0]!) : [];
      });
    },
  };
}

function probePostgres(storage: FactoryStorage): QueryProbe {
  const db = storage.authDatabase();
  if (db.dialect !== 'postgres' || !isPgPool(db.pool)) throw new Error('expected a pg pool');
  const pool = db.pool;
  const query = vi.spyOn(pool, 'query');
  onTestFinished(() => query.mockRestore());
  return {
    bindingReads: () =>
      query.mock.calls
        .map(([sql, args]) => ({ sql, args: args ?? [] }))
        .filter(({ sql }) => sql.includes('FROM "factory_run_bindings"')),
    async indexKeys({ sql, args }) {
      const client = await pool.connect();
      try {
        await client.query('ANALYZE factory_run_bindings');
        await client.query('BEGIN');
        await client.query('SET LOCAL enable_seqscan = off');
        const { rows } = await client.query(`EXPLAIN ${sql}`, args);
        await client.query('ROLLBACK');
        return rows
          .map(row => String(row['QUERY PLAN']))
          .filter(line => line.includes('Index Cond:'))
          .flatMap(line => Array.from(line.matchAll(/\((\w+) = /g), match => match[1]!));
      } finally {
        client.release();
      }
    },
  };
}

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])('run binding lookups by thread on %s', backend => {
  async function setup() {
    const storage =
      backend === 'postgres'
        ? await createIsolatedFactoryPostgresForTests(postgresUrl!)
        : new LibSQLFactoryStorage({ id: `run-bindings-${randomUUID()}`, url: ':memory:' });
    const workItems = storage.registerDomain(new WorkItemsStorage());
    await storage.init();
    onTestFinished(() => storage.close());

    const now = new Date();
    for (let i = 0; i < 40; i++) {
      await storage.ops.insertOne('factory_run_bindings', {
        org_id: `org-${i % 4}`,
        factory_project_id: `project-${i % 2}`,
        work_item_id: `item-${i}`,
        role: 'work',
        thread_id: `thread-${i}`,
        resource_id: `project-${i % 2}`,
        session_id: `session-${i}`,
        branch: `factory/item-${i}`,
        status: i % 5 === 0 ? 'active' : 'revoked',
        created_at: now,
        revoked_at: i % 5 === 0 ? null : now,
      });
    }
    const probe = backend === 'postgres' ? probePostgres(storage) : probeLibSQL(storage);
    return { workItems, probe };
  }

  const address = { orgId: 'org-2', threadId: 'thread-10', resourceId: 'project-0', sessionId: 'session-10' };

  it('finds the active binding of a session that lost its factory project through an index on the thread address', async () => {
    const { workItems, probe } = await setup();

    const binding = await workItems.findActiveRunBindingByThread(address);

    expect(binding).toMatchObject({ workItemId: 'item-10', status: 'active' });
    const [read] = probe.bindingReads();
    expect(await probe.indexKeys(read!)).toEqual(expect.arrayContaining(THREAD_ADDRESS));
  });

  it('finds the historical binding of a thread through an index on the thread address', async () => {
    const { workItems, probe } = await setup();

    const binding = await workItems.findRunBindingByThread(address);

    expect(binding).toMatchObject({ workItemId: 'item-10' });
    const [read] = probe.bindingReads();
    expect(await probe.indexKeys(read!)).toEqual(expect.arrayContaining(THREAD_ADDRESS));
  });
});
