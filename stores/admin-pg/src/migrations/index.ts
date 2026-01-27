import type { Pool } from 'pg';
import { up as migration001 } from './001_initial';

interface Migration {
  version: number;
  name: string;
  up: (pool: Pool, schema: string) => Promise<void>;
}

const migrations: Migration[] = [{ version: 1, name: '001_initial', up: migration001 }];

export async function runMigrations(pool: Pool, schema: string): Promise<void> {
  // Create migrations tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${schema}.migrations (
      version INTEGER PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Get applied migrations
  const result = await pool.query(`SELECT version FROM ${schema}.migrations ORDER BY version`);
  const appliedVersions = new Set(result.rows.map((row: { version: number }) => row.version));

  // Run pending migrations
  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      await migration.up(pool, schema);
      await pool.query(`INSERT INTO ${schema}.migrations (version, name) VALUES ($1, $2)`, [
        migration.version,
        migration.name,
      ]);
    }
  }
}
