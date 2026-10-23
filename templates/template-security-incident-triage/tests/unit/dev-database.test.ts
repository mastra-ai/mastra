import { access } from 'node:fs/promises';
import { join } from 'node:path';

import { createClient } from '@libsql/client';
import { afterEach, describe, expect, it } from 'vitest';

import { prepareDevelopmentDatabase } from '../../src/dev-database.js';
import { migrateOperationalStore } from '../../src/db/migrate.js';
import { migrations } from '../../src/db/migrations/index.js';
import { createTempDatabase, type TempDatabase } from '../helpers/temp-libsql.js';

const databases: TempDatabase[] = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map(database => database.cleanup()));
});

describe('development database preparation', () => {
  it('keeps a database that matches the current migration ledger', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const databasePath = join(database.directory, 'operational.db');
    const store = database.createStore();
    await migrateOperationalStore(store);
    store.close();

    await expect(
      prepareDevelopmentDatabase({
        environment: { MASTRA_STORAGE_URL: database.url },
      }),
    ).resolves.toEqual({ status: 'ready' });
    await expect(access(databasePath)).resolves.toBeUndefined();
  });

  it('keeps a database with a valid migration prefix so startup can upgrade it', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const databasePath = join(database.directory, 'operational.db');
    const store = database.createStore();
    await migrateOperationalStore(store, { migrationSet: [migrations[0]!] });
    store.close();

    await expect(
      prepareDevelopmentDatabase({
        environment: { MASTRA_STORAGE_URL: database.url },
      }),
    ).resolves.toEqual({ status: 'ready' });
    await expect(access(databasePath)).resolves.toBeUndefined();
  });

  it('archives an incompatible local database and its SQLite sidecars', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const databasePath = join(database.directory, 'operational.db');
    const client = createClient({ url: database.url });
    await client.execute(`CREATE TABLE soc_schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    ) STRICT`);
    await client.execute({
      sql: 'INSERT INTO soc_schema_migrations VALUES (1, ?, ?, ?)',
      args: ['superseded-schema', 'a'.repeat(64), '2026-09-01T00:00:00.000Z'],
    });
    client.close();
    const messages: string[] = [];

    const result = await prepareDevelopmentDatabase({
      environment: { MASTRA_STORAGE_URL: database.url },
      now: () => new Date('2026-09-01T12:34:56.789Z'),
      report: message => messages.push(message),
    });

    const backupPath = join(database.directory, 'operational.backup-20260901T123456789Z.db');
    expect(result).toEqual({ status: 'archived', backupPath });
    expect(messages).toEqual([
      `Existing development database used a different schema and was preserved at ${backupPath}`,
    ]);
    await expect(access(databasePath)).rejects.toThrow();
    await expect(access(backupPath)).resolves.toBeUndefined();
  });

  it('never modifies a remote database URL', async () => {
    await expect(
      prepareDevelopmentDatabase({
        environment: { MASTRA_STORAGE_URL: 'libsql://example.invalid' },
      }),
    ).resolves.toEqual({ status: 'remote' });
  });
});
