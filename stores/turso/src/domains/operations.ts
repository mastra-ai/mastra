import { StoreOperations } from '@mastra/core/storage';
import type { StorageColumn, TABLE_NAMES } from '@mastra/core/storage';
import type { TursoConnection } from '../db/connection';
import { toBindValue } from '../db/values';
import type { TursoValue } from '../db/values';
import { buildCreateTable, buildDelete, buildInsert, buildSelect, quoteIdentifier, sqlTypeFor } from '../db/sql';

/**
 * Schema and row operations for Turso: table DDL, inserts, and key lookups.
 *
 * Other domains build on this for their storage primitives.
 */
export class TursoOperations extends StoreOperations {
  readonly #connection: TursoConnection;
  /** Column names per table, cached after the first `PRAGMA table_info` read. */
  readonly #columnCache = new Map<string, Set<string>>();

  constructor({ connection }: { connection: TursoConnection }) {
    super();
    this.#connection = connection;
  }

  /** Reads a table's column names, caching the result. */
  async #getColumns(table: string): Promise<Set<string>> {
    const cached = this.#columnCache.get(table);
    if (cached) return cached;

    // PRAGMA cannot be parameterized, so the identifier is quoted instead.
    const result = await this.#connection.execute(`PRAGMA table_info(${quoteIdentifier(table)})`);
    const columns = new Set(result.rows.map(row => String(row.name)));
    this.#columnCache.set(table, columns);
    return columns;
  }

  /** Drops a table's cached columns after its shape changes. */
  #invalidate(table: string): void {
    this.#columnCache.delete(table);
  }

  async hasColumn(table: string, column: string): Promise<boolean> {
    const columns = await this.#getColumns(table);
    if (columns.has(column)) return true;

    // A miss may be a stale cache from before an ALTER; re-read once to confirm.
    this.#invalidate(table);
    return (await this.#getColumns(table)).has(column);
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    await this.#connection.execute(buildCreateTable(tableName, schema));
    this.#invalidate(tableName);
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    await this.#connection.execute(buildDelete(tableName));
  }

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    await this.#connection.execute(`DROP TABLE IF EXISTS ${quoteIdentifier(tableName)}`);
    this.#invalidate(tableName);
  }

  /**
   * Adds any missing columns listed in `ifNotExists`.
   *
   * SQLite has no `ADD COLUMN IF NOT EXISTS`, so existing columns are filtered
   * out first.
   */
  async alterTable({
    tableName,
    schema,
    ifNotExists,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    if (ifNotExists.length === 0) return;

    const existing = await this.#getColumns(tableName);
    const missing = ifNotExists.filter(column => !existing.has(column) && schema[column]);
    if (missing.length === 0) return;

    for (const column of missing) {
      const definition = schema[column]!;
      const parts = [quoteIdentifier(column), sqlTypeFor(definition.type)];
      // An added column applies to existing rows, which have no value for it,
      // so a NOT NULL column must carry a default.
      if (definition.nullable === false) {
        parts.push('NOT NULL', `DEFAULT ${defaultLiteralFor(definition.type)}`);
      }
      await this.#connection.execute(`ALTER TABLE ${quoteIdentifier(tableName)} ADD COLUMN ${parts.join(' ')}`);
    }

    this.#invalidate(tableName);
  }

  /**
   * Restricts a record to columns the table actually has.
   *
   * A record may carry fields from a newer schema than the database has been
   * migrated to; inserting those would fail outright, so they are dropped.
   */
  async #project(tableName: string, record: Record<string, unknown>): Promise<Record<string, TursoValue>> {
    const columns = await this.#getColumns(tableName);
    const projected: Record<string, TursoValue> = {};

    for (const [key, value] of Object.entries(record)) {
      if (!columns.has(key)) continue;
      // The label names the offending column if the value cannot be bound.
      projected[key] = toBindValue(value as Parameters<typeof toBindValue>[0], `${tableName}.${key}`);
    }

    return projected;
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    const projected = await this.#project(tableName, record);
    await this.#connection.execute(buildInsert(tableName, projected));
  }

  /** Inserts many records atomically. */
  async batchInsert({
    tableName,
    records,
  }: {
    tableName: TABLE_NAMES;
    records: Record<string, any>[];
  }): Promise<void> {
    if (records.length === 0) return;

    const statements = await Promise.all(
      records.map(async record => buildInsert(tableName, await this.#project(tableName, record))),
    );
    await this.#connection.batch(statements);
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, any> }): Promise<R | null> {
    const filters = await this.#project(tableName, keys);
    const result = await this.#connection.execute(buildSelect(tableName, filters, { limit: 1 }));
    return (result.rows[0] as R | undefined) ?? null;
  }
}

/** Default literal used to backfill a NOT NULL column added to existing rows. */
function defaultLiteralFor(type: StorageColumn['type']): string {
  switch (type) {
    case 'integer':
    case 'bigint':
    case 'float':
    case 'boolean':
      return '0';
    case 'jsonb':
      return `'{}'`;
    default:
      return `''`;
  }
}
