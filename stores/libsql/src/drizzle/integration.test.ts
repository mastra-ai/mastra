/**
 * Integration tests for Drizzle schema with real LibSQL operations.
 */

import { rmSync } from 'node:fs';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { beforeAll, afterAll } from 'vitest';
import { describeDrizzleIntegration } from '../../../../scripts/drizzle-schema-generator/integration-test-utils';
import { LibSQLStore } from '../storage';
import { createMastraSchema } from './index';

const TEST_DB_PATH = '.drizzle-integration-test.db';
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

const schema = createMastraSchema();

let client: ReturnType<typeof createClient>;
let db: ReturnType<typeof drizzle>;

beforeAll(async () => {
  const store = new LibSQLStore({ id: 'drizzle-integration-test', url: TEST_DB_URL });
  await store.init();

  client = createClient({ url: TEST_DB_URL });
  db = drizzle(client, { schema });
});

afterAll(() => {
  client.close();
  rmSync(TEST_DB_PATH, { force: true });
  rmSync(`${TEST_DB_PATH}-shm`, { force: true });
  rmSync(`${TEST_DB_PATH}-wal`, { force: true });
});

describeDrizzleIntegration(() => db, schema);
