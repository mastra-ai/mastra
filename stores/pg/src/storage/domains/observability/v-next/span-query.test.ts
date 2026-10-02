import { randomUUID } from 'node:crypto';
import { createSpanQueryTests } from '@internal/storage-test-utils';
import { Pool } from 'pg';
import { afterAll, beforeAll } from 'vitest';
import { PoolAdapter } from '../../../client';
import { ObservabilityStoragePostgresVNext } from './index';

const schemaName = `span_query_${randomUUID().replaceAll('-', '')}`;
const pool = new Pool({
  connectionString: process.env.DB_URL ?? 'postgres://postgres:postgres@localhost:5434/postgres',
});
const client = new PoolAdapter(pool);
const storage = new ObservabilityStoragePostgresVNext({ client, schemaName });
beforeAll(async () => {
  await client.none(`CREATE SCHEMA "${schemaName}"`);
  await storage.init();
}, 60_000);
afterAll(async () => {
  await client.none(`DROP SCHEMA "${schemaName}" CASCADE`);
  await pool.end();
});
createSpanQueryTests(() => storage);
