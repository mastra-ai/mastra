#!/usr/bin/env node
/** Generate Drizzle schema for @mastra/cloudflare-d1. Usage: pnpm generate:drizzle [--check] */

import { readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';
import { generateDrizzleSchema } from '../../../scripts/drizzle-schema-generator/index.mjs';
import { createSqliteFactorySchema } from '../../../scripts/drizzle-schema-generator/sqlite.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_ROOT = join(__dirname, '..');
const PERSIST_DIR = join(STORE_ROOT, '.mf-d1');
const cleanup = () => rmSync(PERSIST_DIR, { recursive: true, force: true });

cleanup();

const mf = new Miniflare({
  modules: true,
  script: 'export default {};',
  d1Databases: ['DB'],
  d1Persist: PERSIST_DIR,
});

try {
  const binding = await mf.getD1Database('DB');

  // Create tables via D1Store binding
  const { D1Store } = await import(join(STORE_ROOT, 'dist', 'index.js'));
  const store = new D1Store({ id: 'drizzle-gen', binding });
  for (const domain of Object.keys(store.stores).sort()) {
    await store.stores[domain].init();
  }

  // Find the persisted SQLite file (path: {PERSIST_DIR}/miniflare-D1DatabaseObject/{hash}.sqlite)
  const d1Dir = join(PERSIST_DIR, 'miniflare-D1DatabaseObject');
  const dbFiles = readdirSync(d1Dir).filter(f => f.endsWith('.sqlite') && !f.includes('-shm') && !f.includes('-wal'));
  if (dbFiles.length === 0) {
    throw new Error(`No SQLite database file found in ${d1Dir}. D1 database may not have been initialized properly.`);
  }
  const dbFile = join(d1Dir, dbFiles[0]);

  await generateDrizzleSchema({
    storeRoot: STORE_ROOT,
    dialect: 'sqlite',
    databaseUrl: `file:${dbFile}`,
    storeExport: 'D1Store',
    skipDocker: true,
    skipTableInit: true,
    postProcess: (schemaContent, relationsContent) => createSqliteFactorySchema({ schemaContent, relationsContent }),
  });
} finally {
  await mf.dispose();
  cleanup();
}
