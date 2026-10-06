import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '..';
import { TEST_CONFIG } from '../test-utils';

const { host, port, user, password, database } = TEST_CONFIG as any;
const urlFor = (db: string) => `postgresql://${user}:${password}@${host}:${port}/${db}`;

describe('schema setup across databases', () => {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const databaseA = `schema_setup_a_${suffix}`;
  const databaseB = `schema_setup_b_${suffix}`;
  const admin = new Pool({ connectionString: urlFor(database) });
  const stores: PostgresStore[] = [];

  beforeAll(async () => {
    await admin.query(`CREATE DATABASE ${databaseA}`);
    await admin.query(`CREATE DATABASE ${databaseB}`);
  });

  afterAll(async () => {
    await Promise.all(stores.map(store => store.close()));
    await admin.query(`DROP DATABASE IF EXISTS ${databaseA} WITH (FORCE)`);
    await admin.query(`DROP DATABASE IF EXISTS ${databaseB} WITH (FORCE)`);
    await admin.end();
  });

  it('creates the schema in a second database that shares the schema name', async () => {
    const schemaName = 'tenant_schema';
    const storeA = new PostgresStore({ id: 'schema-setup-a', connectionString: urlFor(databaseA), schemaName });
    const storeB = new PostgresStore({ id: 'schema-setup-b', connectionString: urlFor(databaseB), schemaName });
    stores.push(storeA, storeB);

    await storeA.init();
    await expect(storeB.init()).resolves.toBeUndefined();

    const probe = new Pool({ connectionString: urlFor(databaseB) });
    try {
      const { rows } = await probe.query(
        `SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = $1`,
        [schemaName],
      );
      expect(rows[0].count).toBeGreaterThan(0);
    } finally {
      await probe.end();
    }
  });
});
