/**
 * Integration tests for Drizzle schema with real PostgreSQL operations.
 *
 * Uses unique schema names per test run (matching the pattern from migration.test.ts)
 * to avoid conflicts with existing tables from previous runs.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { beforeAll, afterAll } from 'vitest';
import { describeDrizzleIntegration } from '../../../../scripts/drizzle-schema-generator/integration-test-utils';
import { PostgresStore } from '../storage';
import { createMastraSchema } from './index';

const TEST_CONNECTION_STRING = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';

// Use unique schema names per test run to avoid conflicts with existing tables
const TEST_SCHEMA = `drizzle_test_${Date.now()}_${Math.random().toString(16).slice(2)}`;
const CUSTOM_SCHEMA = `drizzle_custom_${Date.now()}_${Math.random().toString(16).slice(2)}`;

// Both test suites use isolated schemas
const schema = createMastraSchema({ schemaName: TEST_SCHEMA });
const customSchema = createMastraSchema({ schemaName: CUSTOM_SCHEMA });

let pool: pg.Pool;
let db: ReturnType<typeof drizzle>;
let customDb: ReturnType<typeof drizzle>;
let store: PostgresStore;
let customStore: PostgresStore;

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_CONNECTION_STRING });

  // Create both test schemas fresh
  await pool.query(`CREATE SCHEMA ${TEST_SCHEMA}`);
  await pool.query(`CREATE SCHEMA ${CUSTOM_SCHEMA}`);

  // Initialize stores with their respective schemas
  store = new PostgresStore({
    id: 'test',
    connectionString: TEST_CONNECTION_STRING,
    schemaName: TEST_SCHEMA,
  });
  await store.init();
  db = drizzle(pool, { schema });

  customStore = new PostgresStore({
    id: 'test-custom',
    connectionString: TEST_CONNECTION_STRING,
    schemaName: CUSTOM_SCHEMA,
  });
  await customStore.init();
  customDb = drizzle(pool, { schema: customSchema });
});

afterAll(async () => {
  // Close stores first (they have their own pools)
  await store?.close();
  await customStore?.close();
  // Then clean up schemas and end our pool
  await pool.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
  await pool.query(`DROP SCHEMA IF EXISTS ${CUSTOM_SCHEMA} CASCADE`);
  await pool.end();
});

describeDrizzleIntegration(() => db, schema);
describeDrizzleIntegration(() => customDb, customSchema, 'with schemaName');
