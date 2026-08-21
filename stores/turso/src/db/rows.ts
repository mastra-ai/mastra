/**
 * Schema-aware row mapping between Mastra records and Turso storage.
 *
 * The low-level binder in `values.ts` is schema-blind: it turns a `Date` into
 * epoch milliseconds, which round-trips exactly but is not what the rest of
 * Mastra reads back. `transformRow` in core reads `timestamp` columns as ISO
 * strings and `jsonb` columns as JSON text, and every other SQL adapter stores
 * them that way. These helpers apply the column types from `TABLE_SCHEMAS` so
 * Turso rows stay byte-compatible with the other adapters.
 */

import { TABLE_SCHEMAS } from '@mastra/core/storage';
import type { StorageColumn, TABLE_NAMES } from '@mastra/core/storage';
import { TursoError } from './errors';
import type { TursoValue } from './values';

/** Serializes one value according to its declared column type. */
export function serializeColumn(value: unknown, column: StorageColumn, label: string): TursoValue {
  if (value === undefined || value === null) return null;

  switch (column.type) {
    case 'timestamp': {
      const date = value instanceof Date ? value : new Date(value as string | number);
      if (Number.isNaN(date.getTime())) {
        throw new TursoError(`Cannot store an invalid date in ${label}.`, 'SQLITE_MISMATCH');
      }
      // ISO-8601 sorts lexicographically in the same order it sorts
      // chronologically, so ORDER BY on the text column stays correct.
      return date.toISOString();
    }

    case 'jsonb':
      return typeof value === 'string' ? value : JSON.stringify(value);

    case 'boolean':
      return value ? 1 : 0;

    case 'integer':
    case 'bigint':
      if (typeof value === 'bigint') return value;
      if (typeof value === 'boolean') return value ? 1 : 0;
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
          throw new TursoError(`Cannot store a non-finite number in ${label}.`, 'SQLITE_MISMATCH');
        }
        return value;
      }
      return Number(value);

    case 'float':
      return typeof value === 'number' ? value : Number(value);

    default:
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'bigint') return value;
      if (value instanceof Uint8Array) return value;
      // Objects reaching a text column are structured data; JSON keeps them
      // readable instead of storing "[object Object]".
      return JSON.stringify(value);
  }
}

/**
 * Serializes a record for a known table, dropping fields the schema does not
 * declare.
 */
export function serializeRow(tableName: TABLE_NAMES, record: Record<string, unknown>): Record<string, TursoValue> {
  const schema = TABLE_SCHEMAS[tableName];
  const serialized: Record<string, TursoValue> = {};

  for (const [key, value] of Object.entries(record)) {
    const column = schema?.[key];
    if (!column) continue;
    if (value === undefined) continue;
    serialized[key] = serializeColumn(value, column, `${tableName}.${key}`);
  }

  return serialized;
}

/** Parses JSON text, returning `fallback` when the column holds invalid JSON. */
export function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value as T;

  try {
    return JSON.parse(value) as T;
  } catch {
    // A malformed value should not take down a whole list query.
    return fallback;
  }
}

/** Converts a stored timestamp back to a `Date`. */
export function parseTimestamp(value: unknown): Date | undefined {
  if (value === null || value === undefined) return undefined;

  // Tolerates epoch numbers as well as ISO text, so rows written by an older
  // build still read back correctly.
  const date =
    typeof value === 'number' || typeof value === 'bigint' ? new Date(Number(value)) : new Date(String(value));

  return Number.isNaN(date.getTime()) ? undefined : date;
}
