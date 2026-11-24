import { access, rename } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@libsql/client';

import { readStorageConfig } from './db/config.js';
import { migrations } from './db/migrations/index.js';

export type DevelopmentDatabasePreparation = Readonly<{
  status: 'ready' | 'archived' | 'remote';
  backupPath?: string;
}>;

/**
 * Preserves an incompatible local development database before the application
 * opens it. Remote databases are never modified by the development launcher.
 */
export async function prepareDevelopmentDatabase(
  options: Readonly<{
    root?: string;
    environment?: NodeJS.ProcessEnv;
    now?: () => Date;
    report?: (message: string) => void;
  }> = {},
): Promise<DevelopmentDatabasePreparation> {
  const root = options.root ?? process.cwd();
  const environment = options.environment ?? process.env;
  const config = readStorageConfig(environment, root);
  if (!config.url.startsWith('file:') || config.url === 'file::memory:') {
    return { status: 'remote' };
  }

  const databasePath = fileURLToPath(config.url);
  if (!(await pathExists(databasePath))) return { status: 'ready' };

  const client = createClient({ ...config, timeout: 5_000 });
  let compatible: boolean;
  try {
    const ledger = await client.execute({
      sql: `SELECT name FROM sqlite_schema
        WHERE type = 'table' AND name = 'soc_schema_migrations'`,
      args: [],
    });
    if (ledger.rows.length === 0) return { status: 'ready' };

    const applied = await client.execute({
      sql: 'SELECT version, name, checksum FROM soc_schema_migrations ORDER BY version',
      args: [],
    });
    compatible =
      applied.rows.length <= migrations.length &&
      applied.rows.every((row, index) => {
        const expected = migrations[index];
        return (
          expected !== undefined &&
          Number(row.version) === expected.version &&
          row.name === expected.name &&
          row.checksum === expected.checksum
        );
      });
  } finally {
    client.close();
  }

  if (compatible) return { status: 'ready' };

  const backupPath = developmentBackupPath(databasePath, options.now?.() ?? new Date());
  await moveDatabaseFiles(databasePath, backupPath);
  (options.report ?? console.warn)(
    `Existing development database used a different schema and was preserved at ${backupPath}`,
  );
  return { status: 'archived', backupPath };
}

function developmentBackupPath(databasePath: string, now: Date): string {
  const extension = extname(databasePath) || '.db';
  const name = basename(databasePath, extname(databasePath));
  const timestamp = now.toISOString().replaceAll(/[-:.]/gu, '');
  return join(dirname(databasePath), `${name}.backup-${timestamp}${extension}`);
}

async function moveDatabaseFiles(databasePath: string, backupPath: string): Promise<void> {
  await rename(databasePath, backupPath);
  for (const suffix of ['-wal', '-shm'] as const) {
    const source = `${databasePath}${suffix}`;
    if (await pathExists(source)) await rename(source, `${backupPath}${suffix}`);
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
