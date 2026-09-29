import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { Client } from '@libsql/client';

const migrationsDirectory = resolve(import.meta.dirname, '../../migrations/operational');

const ensureColumn = async (client: Client, table: string, column: string, definition: string): Promise<void> => {
  const columns = await client.execute(`PRAGMA table_info(${table})`);
  if (columns.rows.some(row => row.name === column)) return;
  await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
};

const prepareRestartSafeMigration = async (client: Client, id: string): Promise<void> => {
  if (id !== '009-analytics-projector-lease') return;
  await ensureColumn(client, 'analytics_outbox', 'lease_owner', 'TEXT');
  await ensureColumn(client, 'analytics_outbox', 'lease_expires_at', 'TEXT');
  await ensureColumn(client, 'analytics_outbox', 'attempt_count', 'INTEGER NOT NULL DEFAULT 0');
};

export const runOperationalMigrations = async (client: Client): Promise<void> => {
  const files = (await readdir(migrationsDirectory)).filter(file => file.endsWith('.sql')).sort();

  for (const file of files) {
    const id = file.replace(/\.sql$/u, '');
    const existing = await client.execute({
      sql: 'SELECT 1 FROM foundation_migrations WHERE id = ?',
      args: [id],
    });
    if (existing.rows.length > 0) continue;
    await prepareRestartSafeMigration(client, id);
    const migration = await readFile(resolve(migrationsDirectory, file), 'utf8');
    await client.executeMultiple(`BEGIN IMMEDIATE;\n${migration}\nCOMMIT;`);
  }
};
