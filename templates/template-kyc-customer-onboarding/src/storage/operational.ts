import { createClient, type Client } from '@libsql/client';

import { ensureParentDirectory, fileUrlToPath } from './paths.js';
import { runOperationalMigrations } from './migrations.js';

const foundationMigration = `
  CREATE TABLE IF NOT EXISTS foundation_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`;

export const initializeOperationalDatabase = async (url: string): Promise<Client> => {
  await ensureParentDirectory(fileUrlToPath(url));
  const client = createClient({ url });
  await client.execute(foundationMigration);
  await client.execute({
    sql: 'INSERT OR IGNORE INTO foundation_migrations (id, applied_at) VALUES (?, ?)',
    args: ['000-foundation', new Date(0).toISOString()],
  });
  await client.execute('PRAGMA foreign_keys = ON');
  await runOperationalMigrations(client);
  return client;
};
