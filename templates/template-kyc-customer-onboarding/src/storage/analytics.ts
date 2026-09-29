import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { DuckDBInstance } from '@duckdb/node-api';

import { ensureParentDirectory } from './paths.js';

const foundationMigration = `
  CREATE TABLE IF NOT EXISTS foundation_migrations (
    id VARCHAR PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL
  )
`;
const migrationsDirectory = resolve(import.meta.dirname, '../../migrations/analytics');

const runAnalyticsMigrations = async (instance: DuckDBInstance): Promise<void> => {
  const connection = await instance.connect();
  try {
    const files = (await readdir(migrationsDirectory)).filter(file => file.endsWith('.sql')).sort();
    for (const file of files) {
      const id = file.replace(/\.sql$/u, '');
      const existing = await connection.runAndReadAll('SELECT 1 FROM foundation_migrations WHERE id = ?', [id]);
      if (existing.currentRowCount > 0) continue;
      await connection.run('BEGIN TRANSACTION');
      try {
        await connection.run(await readFile(resolve(migrationsDirectory, file), 'utf8'));
        await connection.run('COMMIT');
      } catch (error) {
        await connection.run('ROLLBACK');
        throw error;
      }
    }
  } finally {
    connection.closeSync();
  }
};

export const initializeAnalyticsDatabase = async (path: string): Promise<DuckDBInstance> => {
  await ensureParentDirectory(path);
  const instance = await DuckDBInstance.create(path);
  const connection = await instance.connect();
  await connection.run(foundationMigration);
  await connection.run(
    "INSERT OR IGNORE INTO foundation_migrations VALUES ('000-foundation', TIMESTAMP '1970-01-01 00:00:00')",
  );
  connection.closeSync();
  await runAnalyticsMigrations(instance);
  return instance;
};
