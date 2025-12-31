#!/usr/bin/env node
/** Generate Drizzle schema for @mastra/libsql. Usage: pnpm generate:drizzle [--check] */

import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateDrizzleSchema,
  fixAnySQLiteColumn,
  extractSqliteTableNames,
  extractImports,
  createSqliteFactorySchema,
} from '../../../scripts/drizzle-schema-generator/index.mjs';

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
    postProcess: content => {
      content = fixAnySQLiteColumn(content);
      const tableNames = extractSqliteTableNames(content);
      if (!tableNames.length) return content;
      const { imports, body } = extractImports(content);
      return createSqliteFactorySchema({ imports, body, tableNames, supportsTablePrefix: false });
    },
  });
} finally {
  cleanup();
}
