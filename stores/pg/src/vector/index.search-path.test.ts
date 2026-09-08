import * as pg from 'pg';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { PgVector } from '.';

/**
 * Regression test for #22545.
 *
 * When PgVector is constructed without `schemaName`, its DDL/DML use unqualified relation
 * names and therefore follow PostgreSQL's `search_path` (default `"$user", public`). If the
 * connecting role has a same-named schema, tables land there. Catalog lookups must resolve
 * the same relation instead of assuming `public`.
 */
describe('PgVector without schemaName honours the "$user" search_path schema', () => {
  const adminConnectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';
  const role = 'pgvector_user_schema';
  const password = 'pgvector_user_schema_pw';
  const indexName = 'user_schema_vectors';

  let admin: pg.Pool;
  let vectorDB: PgVector;
  let roleConnectionString: string;

  const dropRole = async () => {
    await admin.query(`DROP SCHEMA IF EXISTS "${role}" CASCADE`);
    const exists = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
    if (exists.rowCount) {
      // Removes the privilege grants on public that otherwise block DROP ROLE.
      await admin.query(`DROP OWNED BY "${role}"`);
      await admin.query(`DROP ROLE "${role}"`);
    }
  };

  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: adminConnectionString });
    const adminUrl = new URL(adminConnectionString);
    // Keep any DB_URL query parameters (e.g. sslmode) so the role connects the same way admin does.
    roleConnectionString = `postgresql://${role}:${password}@${adminUrl.host}${adminUrl.pathname}${adminUrl.search}`;

    await admin.query('CREATE EXTENSION IF NOT EXISTS vector');
    await dropRole();
    await admin.query(`CREATE ROLE "${role}" LOGIN PASSWORD '${password}'`);
    await admin.query(`CREATE SCHEMA "${role}" AUTHORIZATION "${role}"`);
    // USAGE only: the role can resolve names in public but cannot create tables there,
    // so unqualified CREATE TABLE must land in the "$user" schema.
    await admin.query(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    await admin.query(`REVOKE CREATE ON SCHEMA public FROM "${role}"`);

    vectorDB = new PgVector({ connectionString: roleConnectionString, id: 'pg-vector-user-schema-test' });
  });

  afterAll(async () => {
    await vectorDB?.disconnect();
    await dropRole();
    await admin.end();
  });

  it('creates, lists, describes, upserts, queries and deletes an index that lives in the role schema', async () => {
    await vectorDB.createIndex({ indexName, dimension: 3 });

    // The table really lives in the "$user" schema, not public.
    const located = await admin.query<{ schema: string }>(
      `SELECT n.nspname AS schema
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relname = $1 AND c.relkind = 'r'`,
      [indexName],
    );
    expect(located.rows.map(r => r.schema)).toEqual([role]);

    expect(await vectorDB.listIndexes()).toContain(indexName);

    const stats = await vectorDB.describeIndex({ indexName });
    expect(stats.dimension).toBe(3);
    expect(stats.metric).toBe('cosine');
    expect(stats.count).toBe(0);

    const [id] = await vectorDB.upsert({ indexName, vectors: [[1, 0, 0]], metadata: [{ tag: 'a' }] });
    const results = await vectorDB.query({ indexName, queryVector: [1, 0, 0], topK: 1 });
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(id);
    expect(results[0]?.metadata).toEqual({ tag: 'a' });

    expect((await vectorDB.describeIndex({ indexName })).count).toBe(1);

    await vectorDB.deleteIndex({ indexName });
    expect(await vectorDB.listIndexes()).not.toContain(indexName);
  });
});
