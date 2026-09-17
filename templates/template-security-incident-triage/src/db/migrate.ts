import { DomainError } from '../domain/errors.js';
import type { OperationalStore } from './operational-store.js';
import { migrations, type Migration } from './migrations/index.js';

const ledgerSql = `CREATE TABLE IF NOT EXISTS soc_schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
) STRICT`;

export async function migrateOperationalStore(
  store: OperationalStore,
  options: Readonly<{
    migrationSet?: readonly Migration[];
    appliedAt?: string;
  }> = {},
): Promise<void> {
  const migrationSet = options.migrationSet ?? migrations;
  validateMigrationSet(migrationSet);

  const foreignKeys = await store.execute({ sql: 'PRAGMA foreign_keys' });
  if (Number(foreignKeys.rows[0]?.foreign_keys) !== 1) {
    throw new DomainError('STORAGE_UNAVAILABLE');
  }

  await store.execute({ sql: ledgerSql });
  await store.transaction(async tx => {
    const existing = await tx.execute({
      sql: 'SELECT version, name, checksum FROM soc_schema_migrations ORDER BY version',
    });
    validateAppliedRows(existing.rows, migrationSet);

    for (const migration of migrationSet) {
      const row = await tx.execute({
        sql: 'SELECT name, checksum FROM soc_schema_migrations WHERE version = ?',
        args: [migration.version],
      });
      if (row.rows.length > 0) {
        if (row.rows[0]?.name !== migration.name || row.rows[0]?.checksum !== migration.checksum) {
          throw new DomainError('VALIDATION_FAILED');
        }
        continue;
      }

      await tx.batch(migration.statements.map(sql => ({ sql })));
      await tx.execute({
        sql: 'INSERT INTO soc_schema_migrations(version, name, checksum, applied_at) VALUES (?, ?, ?, ?)',
        args: [migration.version, migration.name, migration.checksum, options.appliedAt ?? new Date().toISOString()],
      });
    }
  });
}

function validateMigrationSet(migrationSet: readonly Migration[]): void {
  migrationSet.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new DomainError('VALIDATION_FAILED');
    }
  });
}

function validateAppliedRows(rows: readonly Record<string, unknown>[], migrationSet: readonly Migration[]): void {
  for (const [index, row] of rows.entries()) {
    const version = Number(row.version);
    const expected = migrationSet[index];
    if (version !== index + 1 || !expected || row.name !== expected.name || row.checksum !== expected.checksum) {
      throw new DomainError('VALIDATION_FAILED');
    }
  }
}
