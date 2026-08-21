/**
 * SQL construction helpers shared by the Turso storage domains.
 *
 * Identifiers are quoted rather than interpolated raw, and values always travel
 * as bind parameters, so table and column names coming from schema definitions
 * cannot terminate a literal.
 */

import type { StorageColumn } from '@mastra/core/storage';
import type { TursoStatement } from './connection';
import type { TursoValue } from './values';

/**
 * Quotes an identifier for use in SQL.
 *
 * SQLite escapes a double quote inside a quoted identifier by doubling it.
 */
export function quoteIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

/** Maps a Mastra storage column type to its SQLite declared type. */
export function sqlTypeFor(type: StorageColumn['type']): string {
  switch (type) {
    case 'integer':
      return 'INTEGER';
    case 'bigint':
      return 'BIGINT';
    case 'float':
      return 'REAL';
    case 'boolean':
      return 'INTEGER';
    case 'timestamp':
      return 'TEXT';
    case 'jsonb':
      return 'TEXT';
    case 'uuid':
    case 'text':
      return 'TEXT';
    default:
      return 'TEXT';
  }
}

/**
 * Builds the column definition fragment of a CREATE TABLE statement.
 *
 * `primaryKey` columns are emitted inline when a single column carries the key,
 * and as a table-level constraint when the key is composite.
 */
export function buildColumnDefinitions(schema: Record<string, StorageColumn>): string {
  const primaryKeys = Object.entries(schema)
    .filter(([, column]) => column.primaryKey)
    .map(([name]) => name);

  const definitions = Object.entries(schema).map(([name, column]) => {
    const parts = [quoteIdentifier(name), sqlTypeFor(column.type)];
    // A single-column key is declared inline so SQLite treats an INTEGER key as
    // a rowid alias; composite keys must be a table-level constraint instead.
    if (column.primaryKey && primaryKeys.length === 1) parts.push('PRIMARY KEY');
    if (column.nullable === false) parts.push('NOT NULL');
    return parts.join(' ');
  });

  if (primaryKeys.length > 1) {
    definitions.push(`PRIMARY KEY (${primaryKeys.map(quoteIdentifier).join(', ')})`);
  }

  return definitions.join(', ');
}

/** Builds `CREATE TABLE IF NOT EXISTS`. */
export function buildCreateTable(tableName: string, schema: Record<string, StorageColumn>): string {
  return `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(tableName)} (${buildColumnDefinitions(schema)})`;
}

/**
 * Builds an INSERT statement.
 *
 * `onConflict` chooses between failing on a duplicate key, ignoring it, or
 * updating the existing row (upsert).
 */
export function buildInsert(
  tableName: string,
  record: Record<string, TursoValue>,
  options: { onConflict?: 'fail' | 'ignore'; upsertOn?: string[] } = {},
): TursoStatement {
  const columns = Object.keys(record);
  if (columns.length === 0) {
    throw new Error(`Cannot insert an empty record into ${tableName}`);
  }

  const placeholders = columns.map(() => '?').join(', ');
  const columnList = columns.map(quoteIdentifier).join(', ');
  const params = columns.map(column => record[column]!);

  const { onConflict, upsertOn } = options;

  if (upsertOn && upsertOn.length > 0) {
    // Columns in the conflict target are the row's identity, so they are not
    // reassigned; only the remaining columns are refreshed.
    const updates = columns.filter(column => !upsertOn.includes(column));
    const conflictTarget = upsertOn.map(quoteIdentifier).join(', ');
    const action =
      updates.length === 0
        ? 'DO NOTHING'
        : `DO UPDATE SET ${updates.map(column => `${quoteIdentifier(column)} = excluded.${quoteIdentifier(column)}`).join(', ')}`;

    return {
      sql: `INSERT INTO ${quoteIdentifier(tableName)} (${columnList}) VALUES (${placeholders}) ON CONFLICT (${conflictTarget}) ${action}`,
      params,
    };
  }

  const verb = onConflict === 'ignore' ? 'INSERT OR IGNORE' : 'INSERT';
  return {
    sql: `${verb} INTO ${quoteIdentifier(tableName)} (${columnList}) VALUES (${placeholders})`,
    params,
  };
}

/** A rendered `WHERE` clause and its bind parameters. */
export type WhereClause = { sql: string; params: TursoValue[] };

/**
 * Builds a `WHERE` clause matching every entry in `filters` by equality.
 *
 * `null` becomes `IS NULL`, since `= NULL` never matches in SQL. Returns an
 * empty clause when there are no filters, so callers can always concatenate.
 */
export function buildWhere(filters: Record<string, TursoValue | null | undefined>): WhereClause {
  const conditions: string[] = [];
  const params: TursoValue[] = [];

  for (const [column, value] of Object.entries(filters)) {
    if (value === undefined) continue;
    if (value === null) {
      conditions.push(`${quoteIdentifier(column)} IS NULL`);
      continue;
    }
    conditions.push(`${quoteIdentifier(column)} = ?`);
    params.push(value);
  }

  if (conditions.length === 0) return { sql: '', params: [] };
  return { sql: ` WHERE ${conditions.join(' AND ')}`, params };
}

/** Builds a `SELECT` filtered by equality on `filters`. */
export function buildSelect(
  tableName: string,
  filters: Record<string, TursoValue | null | undefined> = {},
  options: { columns?: string[]; orderBy?: string; limit?: number; offset?: number } = {},
): TursoStatement {
  const { columns, orderBy, limit, offset } = options;
  const projection = columns && columns.length > 0 ? columns.map(quoteIdentifier).join(', ') : '*';
  const where = buildWhere(filters);

  let sql = `SELECT ${projection} FROM ${quoteIdentifier(tableName)}${where.sql}`;
  if (orderBy) sql += ` ORDER BY ${orderBy}`;
  // SQLite rejects OFFSET without LIMIT; -1 is its documented "no limit".
  if (limit !== undefined) sql += ` LIMIT ${Number(limit)}`;
  else if (offset !== undefined) sql += ` LIMIT -1`;
  if (offset !== undefined) sql += ` OFFSET ${Number(offset)}`;

  return { sql, params: where.params };
}

/** Builds an `UPDATE` applying `values` to rows matching `filters`. */
export function buildUpdate(
  tableName: string,
  values: Record<string, TursoValue>,
  filters: Record<string, TursoValue | null | undefined>,
): TursoStatement {
  const columns = Object.keys(values);
  if (columns.length === 0) {
    throw new Error(`Cannot update ${tableName} with no values`);
  }

  const assignments = columns.map(column => `${quoteIdentifier(column)} = ?`).join(', ');
  const where = buildWhere(filters);

  return {
    sql: `UPDATE ${quoteIdentifier(tableName)} SET ${assignments}${where.sql}`,
    params: [...columns.map(column => values[column]!), ...where.params],
  };
}

/** Builds a `DELETE` for rows matching `filters`. */
export function buildDelete(
  tableName: string,
  filters: Record<string, TursoValue | null | undefined> = {},
): TursoStatement {
  const where = buildWhere(filters);
  return { sql: `DELETE FROM ${quoteIdentifier(tableName)}${where.sql}`, params: where.params };
}
