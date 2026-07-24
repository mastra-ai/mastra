import type { StorageColumn, TABLE_NAMES, DateRange } from '@mastra/core/storage';
import { TABLE_SCHEMAS } from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';

/**
 * Returns a schema-qualified table identifier using HANA double-quote quoting.
 * e.g. "mySchema"."mastra_threads"
 */
export function getSchemaName(schema?: string): string | undefined {
  if (!schema) return undefined;
  return `"${parseSqlIdentifier(schema, 'schema name')}"`;
}

/**
 * Returns a fully-qualified HANA table name.
 * e.g. "mySchema"."mastra_threads" or "mastra_threads"
 */
export function getTableName({ indexName, schemaName }: { indexName: string; schemaName?: string }): string {
  const parsedName = parseSqlIdentifier(indexName, 'table name');
  const quoted = `"${parsedName}"`;
  return schemaName ? `${schemaName}."${parsedName}"` : quoted;
}

/**
 * Build date range filter entries for prepareWhereClause.
 */
export function buildDateRangeFilter(dateRange: DateRange | undefined, fieldName: string): Record<string, unknown> {
  const filters: Record<string, unknown> = {};
  if (dateRange?.start) {
    const suffix = dateRange.startExclusive ? '_gt' : '_gte';
    filters[`${fieldName}${suffix}`] = dateRange.start;
  }
  if (dateRange?.end) {
    const suffix = dateRange.endExclusive ? '_lt' : '_lte';
    filters[`${fieldName}${suffix}`] = dateRange.end;
  }
  return filters;
}

function isInOperator(value: unknown): value is { $in: unknown[] } {
  return (
    typeof value === 'object' && value !== null && '$in' in value && Array.isArray((value as { $in: unknown[] }).$in)
  );
}

/**
 * Build a WHERE clause with positional `?` parameters for HANA.
 * Returns the SQL fragment (starting with " WHERE ") and the ordered params array.
 */
export function prepareWhereClause(
  filters: Record<string, unknown>,
  _schema?: Record<string, StorageColumn>,
): { sql: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined) continue;

    if (key.endsWith('_gte')) {
      const fieldName = key.slice(0, -4);
      conditions.push(`"${parseSqlIdentifier(fieldName, 'field name')}" >= ?`);
      params.push(value instanceof Date ? value.toISOString() : value);
    } else if (key.endsWith('_gt')) {
      const fieldName = key.slice(0, -3);
      conditions.push(`"${parseSqlIdentifier(fieldName, 'field name')}" > ?`);
      params.push(value instanceof Date ? value.toISOString() : value);
    } else if (key.endsWith('_lte')) {
      const fieldName = key.slice(0, -4);
      conditions.push(`"${parseSqlIdentifier(fieldName, 'field name')}" <= ?`);
      params.push(value instanceof Date ? value.toISOString() : value);
    } else if (key.endsWith('_lt')) {
      const fieldName = key.slice(0, -3);
      conditions.push(`"${parseSqlIdentifier(fieldName, 'field name')}" < ?`);
      params.push(value instanceof Date ? value.toISOString() : value);
    } else if (value === null) {
      conditions.push(`"${parseSqlIdentifier(key, 'field name')}" IS NULL`);
    } else if (isInOperator(value)) {
      const inValues = value.$in;
      if (inValues.length === 0) {
        conditions.push('1 = 0');
      } else if (inValues.length === 1) {
        conditions.push(`"${parseSqlIdentifier(key, 'field name')}" = ?`);
        params.push(inValues[0] instanceof Date ? (inValues[0] as Date).toISOString() : inValues[0]);
      } else {
        const placeholders = inValues.map(() => '?').join(', ');
        conditions.push(`"${parseSqlIdentifier(key, 'field name')}" IN (${placeholders})`);
        for (const item of inValues) {
          params.push(item instanceof Date ? (item as Date).toISOString() : item);
        }
      }
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        conditions.push('1 = 0');
      } else if (value.length === 1) {
        conditions.push(`"${parseSqlIdentifier(key, 'field name')}" = ?`);
        params.push(value[0] instanceof Date ? (value[0] as Date).toISOString() : value[0]);
      } else {
        const placeholders = value.map(() => '?').join(', ');
        conditions.push(`"${parseSqlIdentifier(key, 'field name')}" IN (${placeholders})`);
        for (const item of value) {
          params.push(item instanceof Date ? (item as Date).toISOString() : item);
        }
      }
    } else {
      conditions.push(`"${parseSqlIdentifier(key, 'field name')}" = ?`);
      params.push(value instanceof Date ? value.toISOString() : value);
    }
  }

  return {
    sql: conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

/**
 * Transform a HANA result row to the typed record, parsing NCLOB JSON strings
 * and converting timestamps to Date objects.
 */
export function transformFromRow<T>({ tableName, row }: { tableName: TABLE_NAMES; row: Record<string, unknown> }): T {
  const schema = TABLE_SCHEMAS[tableName];
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    const columnSchema = schema?.[key];

    if (columnSchema?.type === 'jsonb' && typeof value === 'string') {
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    } else if (columnSchema?.type === 'timestamp') {
      if (value instanceof Date) {
        result[key] = value;
      } else if (typeof value === 'string') {
        result[key] = new Date(value);
      } else {
        result[key] = value;
      }
    } else if (columnSchema?.type === 'boolean') {
      // HANA stores booleans as TINYINT (0/1)
      result[key] = Boolean(value);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Prepare a value for insertion into HANA.
 * - JSON objects/arrays are serialised to strings (stored as NCLOB).
 * - Dates are converted to ISO strings.
 * - Booleans are converted to 0/1.
 */
export function prepareValue(value: unknown, columnName: string, tableName: TABLE_NAMES): unknown {
  if (value === null || value === undefined) return null;

  const schema = TABLE_SCHEMAS[tableName];
  const columnSchema = schema?.[columnName];

  if (columnSchema?.type === 'jsonb') {
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
  if (columnSchema?.type === 'timestamp') {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    return value;
  }
  if (columnSchema?.type === 'boolean') {
    return value ? 1 : 0;
  }
  if (typeof value === 'object' && !(value instanceof Date)) {
    // Unknown JSONB column — still serialise objects
    return JSON.stringify(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}
