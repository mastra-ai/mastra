import { DuckDBConnection } from '../../db/index';

/** Shorthand for {@link DuckDBConnection.sqlValue}. */
export const v = DuckDBConnection.sqlValue;

/** Serialize a value to JSON then SQL-escape it, or return 'NULL'. */
export function jsonV(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  return DuckDBConnection.sqlValue(JSON.stringify(val));
}

/**
 * `span_events` JSON columns that can hold large payloads. Missing values are
 * stored as the JSON literal `null` instead of SQL NULL.
 *
 * DuckDB only reads the selected rows of a large-string column when the
 * column's validity mask is constant (no NULLs in the row group). Any SQL NULL
 * makes it fall back to reading the whole 2,048-row vector, which loads every
 * large string in it even when the query needs one row. Keeping these columns
 * NULL-free lets point lookups and page reads load only what they return.
 */
export const SPAN_PAYLOAD_COLUMNS = ['attributes', 'input', 'output', 'requestContext'] as const;

/** Stored in {@link SPAN_PAYLOAD_COLUMNS} in place of SQL NULL; read back as missing. */
export const JSON_NULL_PLACEHOLDER = 'null';

/** Like {@link jsonV}, but writes the JSON `null` placeholder instead of SQL NULL. */
export function payloadJsonV(val: unknown): string {
  if (val === null || val === undefined) return `'${JSON_NULL_PLACEHOLDER}'`;
  return jsonV(val);
}

/** SQL for a payload column that maps the JSON `null` placeholder back to SQL NULL. */
export function payloadColumnSql(column: string): string {
  return `NULLIF(${column}, '${JSON_NULL_PLACEHOLDER}')`;
}

/**
 * Trim, drop blank, and dedupe tags before they are written, matching the
 * PostgreSQL and ClickHouse stores so tag predicates and discovery agree.
 */
export function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of tags) {
    if (typeof t !== 'string') continue;
    const trimmed = t.trim();
    if (trimmed === '' || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

/** Coerce a value to a Date. Throws if value is nullish. */
export function toDate(val: unknown): Date {
  if (val === null || val === undefined) {
    throw new Error('Expected date value but received null/undefined');
  }
  const date = val instanceof Date ? val : new Date(String(val));
  if (Number.isNaN(date.getTime())) {
    throw new Error('Expected valid date but received invalid date');
  }
  return date;
}

/** Coerce a value to a Date, returning null for nullish values. */
export function toDateOrNull(val: unknown): Date | null {
  if (val === null || val === undefined) return null;
  return val instanceof Date ? val : new Date(String(val));
}

/** Parse a JSON string, returning the original value if parsing fails. */
export function parseJson(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

/** Parse a JSON string and return the result only if it is an array. */
export function parseJsonArray(value: unknown): unknown[] | null {
  if (value === null || value === undefined) return null;
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed : null;
}
