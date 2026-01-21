#!/usr/bin/env node
/** Generate Drizzle schema for @mastra/libsql. Usage: pnpm generate:drizzle [--check] */

import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateDrizzleSchema } from '../../../scripts/drizzle-schema-generator/index.mjs';
import { createSqliteFactorySchema } from '../../../scripts/drizzle-schema-generator/sqlite.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_ROOT = join(__dirname, '..');
const TEST_DB = join(STORE_ROOT, '.drizzle-test.db');

const cleanup = () => [TEST_DB, `${TEST_DB}-shm`, `${TEST_DB}-wal`].forEach(f => rmSync(f, { force: true }));

cleanup();
try {
  await generateDrizzleSchema({
    storeRoot: STORE_ROOT,
    dialect: 'sqlite',
    databaseUrl: `file:${TEST_DB}`,
    storeExport: 'LibSQLStore',
    createStoreConfig: url => ({ id: 'drizzle-gen', url }),
    skipDocker: true,
    postProcess: (schemaContent, relationsContent) =>
      createSqliteFactorySchema({ schemaContent, relationsContent, supportsTablePrefix: false }),
  });
} finally {
  cleanup();
}
