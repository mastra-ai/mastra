import { createHash } from 'node:crypto';

import type { ObjectRow } from '../shared/connection';
import { normalizeIdentifier } from '../vector/identifiers';
import type { OracleQueryBinds, OracleTxClient } from './db';

export const DEFAULT_ORACLE_MIGRATIONS_TABLE = 'MASTRA_ORACLE_MIGRATIONS';

// Versioned migrations protect one-time schema changes. Repeatable migrations
// reconcile domain tables and indexes when checksums change or migrate() is forced.
export type OracleMigrationKind = 'versioned' | 'repeatable';
export type OracleMigrationStatus = 'applied' | 'reapplied' | 'skipped';

export interface OracleMigration {
  id: string;
  name: string;
  description?: string;
  kind?: OracleMigrationKind;
  checksum?: string;
  run(): Promise<void>;
}

export interface OracleMigrationRecord {
  id: string;
  name: string;
  kind: OracleMigrationKind;
  checksum: string;
  description?: string | null;
  appliedAt?: unknown;
  updatedAt?: unknown;
}

export interface OracleMigrationResult {
  id: string;
  name: string;
  kind: OracleMigrationKind;
  status: OracleMigrationStatus;
  checksum: string;
}

export interface OracleMigrationRunOptions {
  forceRepeatable?: boolean;
}

export interface OracleMigrationDatabase {
  table(tableName: string): string;
  executeDdl(sql: string, ignoredErrorCodes?: number[]): Promise<void>;
  manyOrNone<T extends ObjectRow = ObjectRow>(sql: string, binds?: OracleQueryBinds): Promise<T[]>;
  tx<T>(callback: (client: OracleTxClient) => Promise<T>): Promise<T>;
}

export interface OracleMigrationRegistryConfig {
  db: OracleMigrationDatabase;
  tableName?: string;
}

type OracleMigrationTableRow = {
  id: string;
  name: string;
  kind: OracleMigrationKind;
  checksum: string;
  description?: string | null;
  appliedAt?: unknown;
  updatedAt?: unknown;
};

const MIGRATION_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]*$/;
const MAX_MIGRATION_ID_LENGTH = 256;
const MAX_MIGRATION_NAME_LENGTH = 512;
const MAX_MIGRATION_DESCRIPTION_LENGTH = 4000;
// Matches the ledger's checksum VARCHAR2(128) column so an oversized custom
// checksum fails fast in normalizeMigration() instead of during record().
const MAX_MIGRATION_CHECKSUM_LENGTH = 128;

// The ledger is intentionally small: it only records migration identity,
// checksum, and timestamps, leaving domain code responsible for idempotent DDL.
export class OracleMigrationRegistry {
  private readonly db: OracleMigrationDatabase;
  private readonly tableName: string;

  constructor(config: OracleMigrationRegistryConfig) {
    this.db = config.db;
    this.tableName = normalizeIdentifier(config.tableName ?? DEFAULT_ORACLE_MIGRATIONS_TABLE, 'migration table name');
  }

  async init(): Promise<void> {
    await this.db.executeDdl(oracleMigrationTableSql(this.table()), [-955]);
  }

  async list(): Promise<OracleMigrationRecord[]> {
    await this.init();
    return this.readRecords();
  }

  async run(migrations: OracleMigration[], options: OracleMigrationRunOptions = {}): Promise<OracleMigrationResult[]> {
    await this.init();
    const applied = new Map((await this.readRecords()).map(record => [record.id, record]));
    const results: OracleMigrationResult[] = [];

    // Run migrations in the order provided by OracleStore. Normal init skips
    // unchanged repeatables; explicit migrate() can force reconciliation after upgrades.
    for (const migration of migrations) {
      const normalized = normalizeMigration(migration);
      const current = applied.get(normalized.id);

      if (current && current.kind !== normalized.kind) {
        throw new Error(
          `Oracle migration ${normalized.id} was already applied as ${current.kind} and cannot be changed to ${normalized.kind}.`,
        );
      }

      if (current && normalized.kind === 'versioned') {
        if (current.checksum !== normalized.checksum) {
          throw new Error(
            `Oracle migration ${normalized.id} was already applied with checksum ${current.checksum}, but the current definition has checksum ${normalized.checksum}. Add a new migration instead of changing an applied versioned migration.`,
          );
        }
        results.push({ ...normalized, status: 'skipped' });
        continue;
      }

      if (
        current &&
        normalized.kind === 'repeatable' &&
        current.checksum === normalized.checksum &&
        !options.forceRepeatable
      ) {
        results.push({ ...normalized, status: 'skipped' });
        continue;
      }

      await normalized.run();
      await this.record(normalized);
      applied.set(normalized.id, normalized);
      results.push({ ...normalized, status: current ? 'reapplied' : 'applied' });
    }

    return results;
  }

  private table(): string {
    return this.db.table(this.tableName);
  }

  private async readRecords(): Promise<OracleMigrationRecord[]> {
    return this.db.manyOrNone<OracleMigrationTableRow>(
      `SELECT
  id AS "id",
  name AS "name",
  kind AS "kind",
  checksum AS "checksum",
  description AS "description",
  applied_at AS "appliedAt",
  updated_at AS "updatedAt"
FROM ${this.table()}
ORDER BY id`,
    );
  }

  private async record(migration: NormalizedOracleMigration): Promise<void> {
    await this.db.tx(async client => {
      // MERGE keeps the ledger accurate for both first application and repeatable re-application.
      await client.none(
        `MERGE INTO ${this.table()} target
USING (
  SELECT
    :id AS id,
    :name AS name,
    :kind AS kind,
    :checksum AS checksum,
    :description AS description
  FROM dual
) source
ON (target.id = source.id)
WHEN MATCHED THEN UPDATE SET
  target.name = source.name,
  target.kind = source.kind,
  target.checksum = source.checksum,
  target.description = source.description,
  target.updated_at = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT (id, name, kind, checksum, description, applied_at, updated_at)
VALUES (source.id, source.name, source.kind, source.checksum, source.description, SYSTIMESTAMP, SYSTIMESTAMP)`,
        {
          id: migration.id,
          name: migration.name,
          kind: migration.kind,
          checksum: migration.checksum,
          description: migration.description ?? null,
        },
      );
    });
  }
}

export function oracleMigrationTableSql(qualifiedTableName: string): string {
  return `CREATE TABLE ${qualifiedTableName} (
  id VARCHAR2(256) PRIMARY KEY,
  name VARCHAR2(512) NOT NULL,
  kind VARCHAR2(32) NOT NULL,
  checksum VARCHAR2(128) NOT NULL,
  description VARCHAR2(4000),
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
)`;
}

type NormalizedOracleMigration = Omit<OracleMigration, 'kind' | 'description' | 'checksum'> & {
  kind: OracleMigrationKind;
  checksum: string;
  description?: string;
};

function normalizeMigration(migration: OracleMigration): NormalizedOracleMigration {
  // Normalize before checksum calculation so equivalent ids/names produce stable
  // ledger records across platforms and CI environments.
  const id = normalizeMigrationId(migration.id);
  const name = normalizeMigrationName(migration.name);
  const kind = migration.kind ?? 'versioned';
  const description = normalizeMigrationDescription(migration.description);
  const checksum = normalizeMigrationChecksum(migration.checksum) ?? checksumMigration({ id, name, kind, description });

  return {
    ...migration,
    id,
    name,
    kind,
    description,
    checksum,
  };
}

function normalizeMigrationId(value: string): string {
  const id = value.trim();
  if (!MIGRATION_ID_PATTERN.test(id)) {
    throw new Error('Oracle migration id must start with a letter and contain only letters, numbers, _, ., :, or -');
  }
  if (id.length > MAX_MIGRATION_ID_LENGTH) {
    throw new Error(`Oracle migration id must be ${MAX_MIGRATION_ID_LENGTH} characters or fewer`);
  }
  return id;
}

function normalizeMigrationName(value: string): string {
  const name = value.trim();
  if (!name) {
    throw new Error('Oracle migration name must be provided and cannot be empty');
  }
  if (name.length > MAX_MIGRATION_NAME_LENGTH) {
    throw new Error(`Oracle migration name must be ${MAX_MIGRATION_NAME_LENGTH} characters or fewer`);
  }
  return name;
}

function normalizeMigrationDescription(value: string | undefined): string | undefined {
  const description = value?.trim();
  if (!description) return undefined;
  if (description.length > MAX_MIGRATION_DESCRIPTION_LENGTH) {
    throw new Error(`Oracle migration description must be ${MAX_MIGRATION_DESCRIPTION_LENGTH} characters or fewer`);
  }
  return description;
}

function normalizeMigrationChecksum(value: string | undefined): string | undefined {
  const checksum = value?.trim();
  if (!checksum) return undefined;
  if (checksum.length > MAX_MIGRATION_CHECKSUM_LENGTH) {
    throw new Error(`Oracle migration checksum must be ${MAX_MIGRATION_CHECKSUM_LENGTH} characters or fewer`);
  }
  return checksum;
}

function checksumMigration(input: {
  id: string;
  name: string;
  kind: OracleMigrationKind;
  description?: string;
}): string {
  // The checksum covers migration identity/description so accidental edits to
  // versioned migrations are caught before any DDL runs.
  return createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex')
    .toUpperCase();
}
