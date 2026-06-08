import type { StorageColumn, TABLE_NAMES } from '@mastra/core/storage';
import { TABLE_SCHEMAS } from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';

/**
 * Quote a Spanner identifier with backticks. GoogleSQL uses backticks for
 * identifiers that may collide with reserved keywords.
 */
export function quoteIdent(name: string, kind = 'identifier'): string {
  const parsed = parseSqlIdentifier(name, kind);
  return `\`${parsed}\``;
}

/**
 * Returns the GoogleSQL type literal corresponding to a storage column type.
 */
export function getSpannerType(type: StorageColumn['type']): string {
  switch (type) {
    case 'text':
      return 'STRING(MAX)';
    case 'uuid':
      return 'STRING(36)';
    case 'jsonb':
      // Stored as JSON in Spanner. JSON columns can hold up to 10 MB.
      return 'JSON';
    case 'timestamp':
      return 'TIMESTAMP';
    case 'integer':
    case 'bigint':
      return 'INT64';
    case 'float':
      return 'FLOAT64';
    case 'boolean':
      return 'BOOL';
    default:
      throw new Error(`Unsupported Spanner storage column type: ${type as string}`);
  }
}

/**
 * Returns the @google-cloud/spanner param type spec for a storage column type.
 * Used when binding `null` values where Spanner needs an explicit type hint.
 */
export function getSpannerParamType(type: StorageColumn['type'] | undefined): string {
  switch (type) {
    case 'jsonb':
      return 'json';
    case 'timestamp':
      return 'timestamp';
    case 'integer':
    case 'bigint':
      return 'int64';
    case 'float':
      return 'float64';
    case 'boolean':
      return 'bool';
    case 'uuid':
    case 'text':
    default:
      return 'string';
  }
}

/**
 * Look up the storage column definition for a (table, column) pair.
 * Returns undefined for columns not defined in the schema (e.g. internal columns).
 */
export function getColumnDef(table: TABLE_NAMES, column: string): StorageColumn | undefined {
  return TABLE_SCHEMAS[table]?.[column];
}

/**
 * Returns true if the value is the `$in` operator object used by storage filters.
 */
export function isInOperator(value: unknown): value is { $in: unknown[] } {
  return (
    typeof value === 'object' && value !== null && '$in' in value && Array.isArray((value as { $in: unknown[] }).$in)
  );
}
