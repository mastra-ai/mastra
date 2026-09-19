import { randomUUID } from 'node:crypto';

import { createSampleSessionRecord } from '@internal/storage-test-utils';
import {
  MastraCompositeStore,
  TABLE_HARNESS_SESSION_EVENTS,
  TABLE_HARNESS_THREAD_DELETE_FENCES,
} from '@mastra/core/storage';
import { Client, Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PostgresStore, WorkflowsPG } from '..';
import { TEST_CONFIG, connectionString } from '../test-utils';
import { truncateIdentifierWithHash } from './constraint-utils';

const WRITE_DDL = /^\s*(CREATE|ALTER|DROP)\s+/i;
const ENABLED_DOMAINS = ['memory', 'harness', 'workflows'] as const;

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function uniqueName(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
}

function restrictedStoreConfig(schemaName: string, id: string, user: string, password: string): any {
  return {
    ...TEST_CONFIG,
    id,
    schemaName,
    user,
    password,
    disableInit: true,
    enabledDomains: ENABLED_DOMAINS,
  };
}

/** Records statements sent by the pg driver while the runtime operation runs. */
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

describe('PostgresStore externally managed schema mode', () => {
  const adminPool = new Pool({ connectionString });
  let schemaName: string | undefined;
  let roleName: string | undefined;
  let rolePassword: string | undefined;
  let databaseName: string | undefined;
  let privilegedStore: PostgresStore | undefined;

  beforeAll(async () => {
    schemaName = uniqueName('external_schema');
    roleName = uniqueName('external_runtime');
    rolePassword = randomUUID().replaceAll('-', '');

    await adminPool.query(
      `CREATE ROLE ${quoteIdentifier(roleName)} LOGIN PASSWORD ${quoteLiteral(rolePassword)} NOSUPERUSER NOCREATEDB NOCREATEROLE`,
    );
    await adminPool.query(`CREATE SCHEMA ${quoteIdentifier(schemaName)} AUTHORIZATION CURRENT_USER`);

    const database = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    databaseName = database.rows[0]!.name;
    await adminPool.query(`GRANT CONNECT ON DATABASE ${quoteIdentifier(databaseName)} TO ${quoteIdentifier(roleName)}`);

    privilegedStore = new PostgresStore({
      ...TEST_CONFIG,
      id: uniqueName('external_migrator'),
      schemaName,
      enabledDomains: ENABLED_DOMAINS,
      disableInit: false,
    } as any);
    await privilegedStore.init();

    // Retention indexes are lazy by design. The migration role owns their
    // creation so the runtime role only has to validate and use them.
    await privilegedStore.stores.memory!.prune({ threads: { maxAge: '30d' } });
    await privilegedStore.stores.workflows!.prune({ workflowSnapshot: { maxAge: '30d' } });

    await adminPool.query(
      `REVOKE CREATE ON SCHEMA ${quoteIdentifier(schemaName)} FROM PUBLIC, ${quoteIdentifier(roleName)};
       GRANT USAGE ON SCHEMA ${quoteIdentifier(schemaName)} TO ${quoteIdentifier(roleName)};
       GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${quoteIdentifier(schemaName)} TO ${quoteIdentifier(roleName)};
       GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA ${quoteIdentifier(schemaName)} TO ${quoteIdentifier(roleName)};`,
    );

    const role = await adminPool.query<{
      rolsuper: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
    }>(
      `SELECT rolsuper, rolcreatedb, rolcreaterole
         FROM pg_catalog.pg_roles
        WHERE rolname = $1`,
      [roleName],
    );
    expect(role.rows[0]).toMatchObject({ rolsuper: false, rolcreatedb: false, rolcreaterole: false });

    const schemaPrivileges = await adminPool.query<{ can_create: boolean }>(
      `SELECT has_schema_privilege($1, $2, 'CREATE') AS can_create`,
      [roleName, schemaName],
    );
    expect(schemaPrivileges.rows[0]?.can_create).toBe(false);

    const ownedRelations = await adminPool.query<{ count: number }>(
      `SELECT count(*)::int AS count
         FROM pg_catalog.pg_class AS relation_row
         JOIN pg_catalog.pg_namespace AS namespace_row
           ON namespace_row.oid = relation_row.relnamespace
         JOIN pg_catalog.pg_roles AS role_row
           ON role_row.oid = relation_row.relowner
        WHERE namespace_row.nspname = $1
          AND role_row.rolname = $2`,
      [schemaName, roleName],
    );
    expect(ownedRelations.rows[0]?.count).toBe(0);
  }, 180_000);

  afterAll(async () => {
    const cleanupErrors: unknown[] = [];
    try {
      if (privilegedStore) await privilegedStore.close();
    } catch (error) {
      cleanupErrors.push(error);
    }
    try {
      if (schemaName) {
        await adminPool.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schemaName)} CASCADE`);
      }
    } catch (error) {
      cleanupErrors.push(error);
    }
    try {
      if (databaseName && roleName) {
        await adminPool.query(
          `REVOKE CONNECT ON DATABASE ${quoteIdentifier(databaseName)} FROM ${quoteIdentifier(roleName)}`,
        );
      }
      if (roleName) await adminPool.query(`DROP ROLE IF EXISTS ${quoteIdentifier(roleName)}`);
    } catch (error) {
      cleanupErrors.push(error);
    }
    try {
      await adminPool.end();
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (cleanupErrors.length > 0) {
      throw new AggregateError(cleanupErrors, 'PostgreSQL external-schema fixture cleanup failed');
    }
  });

  it('keeps an explicitly composed workflow domain initializer DDL-free', async () => {
    const schema = schemaName!;
    const role = roleName!;
    const password = rolePassword!;
    const workflowPool = new Pool({
      ...(TEST_CONFIG as any),
      user: role,
      password,
      max: 1,
    });
    const workflows = new WorkflowsPG({ pool: workflowPool, schemaName: schema, disableInit: true });
    const composite = new MastraCompositeStore({
      id: uniqueName('external_workflow_composite'),
      domains: { workflows },
    });

    try {
      const statements = await captureStatements(() => composite.init());
      expect(statements.filter(statement => WRITE_DDL.test(statement))).toEqual([]);
    } finally {
      await workflowPool.end();
    }
  }, 180_000);

  it('renames the legacy observational-memory lookup index during concurrent privileged migrations', async () => {
    const schema = schemaName!;
    const desiredIndexName = truncateIdentifierWithHash(`${schema}_idx_om_lookup_key`);
    await adminPool.query(
      `ALTER INDEX ${quoteIdentifier(schema)}.${quoteIdentifier(desiredIndexName)} RENAME TO ${quoteIdentifier('idx_om_lookup_key')}`,
    );

    const migrationStores = [
      new PostgresStore({
        ...TEST_CONFIG,
        id: uniqueName('external_om_index_migrator'),
        schemaName: schema,
        enabledDomains: ['memory'],
        disableInit: false,
      } as any),
      new PostgresStore({
        ...TEST_CONFIG,
        id: uniqueName('external_om_index_migrator'),
        schemaName: schema,
        enabledDomains: ['memory'],
        disableInit: false,
      } as any),
    ];
    try {
      await Promise.all(migrationStores.map(store => store.init()));
    } finally {
      await Promise.all(migrationStores.map(store => store.close()));
    }

    const indexes = await adminPool.query<{ indexname: string }>(
      `SELECT indexname
         FROM pg_catalog.pg_indexes
        WHERE schemaname = $1
          AND tablename = $2`,
      [schema, 'mastra_observational_memory'],
    );
    expect(indexes.rows.map(row => row.indexname)).toContain(desiredIndexName);
    expect(indexes.rows.map(row => row.indexname)).not.toContain('idx_om_lookup_key');
  }, 180_000);

  it('runs lazy Harness and retention operations through a restricted DML-only role without runtime DDL', async () => {
    const schema = schemaName!;
    const role = roleName!;
    const password = rolePassword!;
    const runtime = new PostgresStore(
      restrictedStoreConfig(schema, uniqueName('external_runtime_store'), role, password),
    );

    try {
      const initStatements = await captureStatements(async () => {
        await runtime.init();
      });
      expect(initStatements).toEqual([]);

      const harness = runtime.stores.harness!;
      const session = createSampleSessionRecord({
        id: uniqueName('session'),
        resourceId: uniqueName('resource'),
        threadId: uniqueName('thread'),
      });
      let memoryPruneResults: unknown;
      let workflowPruneResults: unknown;
      const statements = await captureStatements(async () => {
        await harness.saveSession(session, { ownerId: 'external-runtime', ifVersion: 0 });
        await harness.appendSessionEvent({
          harnessName: session.harnessName,
          sessionId: session.id,
          resourceId: session.resourceId,
          threadId: session.threadId,
          eventId: uniqueName('event'),
          epoch: 'external-epoch',
          sequence: 1,
          event: { type: 'external-schema-fixture' },
          emittedAt: Date.now(),
          storedAt: Date.now(),
        });
        await harness.withThreadDeleteFence(
          { threadId: session.threadId, ownerId: 'external-runtime', ttlMs: 30_000 },
          fence => fence.assertActive(),
        );
        memoryPruneResults = await runtime.stores.memory!.prune({ threads: { maxAge: '30d' } });
        workflowPruneResults = await runtime.stores.workflows!.prune({ workflowSnapshot: { maxAge: '30d' } });
      });

      expect(statements.filter(statement => WRITE_DDL.test(statement))).toEqual([]);
      expect(memoryPruneResults).toEqual([
        expect.objectContaining({ domain: 'memory', table: 'mastra_threads', done: true }),
      ]);
      expect(workflowPruneResults).toEqual([
        expect.objectContaining({ domain: 'workflows', table: 'mastra_workflow_snapshot', done: true }),
      ]);

      const repeatedEnsureStatements = await captureStatements(async () => {
        await harness.appendSessionEvent({
          harnessName: session.harnessName,
          sessionId: session.id,
          resourceId: session.resourceId,
          threadId: session.threadId,
          eventId: uniqueName('event'),
          epoch: 'external-epoch',
          sequence: 2,
          event: { type: 'external-schema-fixture-repeat' },
          emittedAt: Date.now(),
          storedAt: Date.now(),
        });
        await harness.appendSessionEvent({
          harnessName: session.harnessName,
          sessionId: session.id,
          resourceId: session.resourceId,
          threadId: session.threadId,
          eventId: uniqueName('event'),
          epoch: 'external-epoch',
          sequence: 3,
          event: { type: 'external-schema-fixture-repeat' },
          emittedAt: Date.now(),
          storedAt: Date.now(),
        });
      });
      expect(
        repeatedEnsureStatements.filter(
          statement => statement.includes('pg_catalog.pg_attribute') || statement.includes('pg_catalog.pg_index'),
        ),
      ).toEqual([]);

      const eventRows = await adminPool.query<{ count: number }>(
        `SELECT count(*)::int AS count
           FROM ${quoteIdentifier(schema)}.${quoteIdentifier(TABLE_HARNESS_SESSION_EVENTS)}
          WHERE session_id = $1`,
        [session.id],
      );
      expect(eventRows.rows[0]?.count).toBe(3);

      await runtime.close();
      await adminPool.query(
        `DROP TABLE ${quoteIdentifier(schema)}.${quoteIdentifier(TABLE_HARNESS_THREAD_DELETE_FENCES)}`,
      );

      const missingStructureRuntime = new PostgresStore(
        restrictedStoreConfig(schema, uniqueName('external_missing_structure'), role, password),
      );
      try {
        const missingStatements = await captureStatements(async () => {
          await expect(
            missingStructureRuntime.stores.harness!.withThreadDeleteFence(
              { threadId: uniqueName('missing-thread'), ownerId: 'external-runtime', ttlMs: 30_000 },
              fence => fence.assertActive(),
            ),
          ).rejects.toMatchObject({
            id: 'MASTRA_STORAGE_PG_CREATE_TABLE_FAILED',
            cause: expect.objectContaining({ message: expect.stringContaining('missing required table') }),
          });
        });
        expect(missingStatements.filter(statement => WRITE_DDL.test(statement))).toEqual([]);
      } finally {
        await missingStructureRuntime.close();
      }
    } finally {
      await runtime.close().catch(() => {});
    }
  }, 180_000);

  it('rejects direct workflow init when a managed terminal table is missing', async () => {
    const schema = schemaName!;
    const role = roleName!;
    const password = rolePassword!;
    const workflowPool = new Pool({
      ...(TEST_CONFIG as any),
      user: role,
      password,
      max: 1,
    });
    const workflows = new WorkflowsPG({ pool: workflowPool, schemaName: schema, disableInit: true });

    try {
      await adminPool.query(
        `DROP TABLE ${quoteIdentifier(schema)}.${quoteIdentifier('mastra_workflow_terminal_snapshots_v2')}`,
      );
      const statements = await captureStatements(async () => {
        await expect(workflows.init()).rejects.toMatchObject({
          id: 'MASTRA_STORAGE_PG_CREATE_TABLE_FAILED',
          cause: expect.objectContaining({ message: expect.stringContaining('missing required table') }),
        });
      });
      expect(statements.filter(statement => WRITE_DDL.test(statement))).toEqual([]);
    } finally {
      await workflowPool.end();
    }
  }, 180_000);
});
