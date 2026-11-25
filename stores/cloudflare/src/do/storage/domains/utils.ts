export function isArrayOfRecords(value: unknown): value is Record<string, unknown>[] {
  return value !== null && value !== undefined && Array.isArray(value);
}

/**
 * Builds an `IN` condition that takes the whole id list as a single bound parameter.
 *
 * Durable Object SQL caps a statement at 100 bound parameters, so interpolating one `?` per id
 * made `listMessagesById`/`updateMessages`/`deleteMessages` fail with "too many SQL variables" for
 * threads holding more than ~100 messages. Binding the list once as a JSON array keeps the
 * parameter count constant no matter how many ids the caller passes, and `json_each` is part of
 * SQLite's JSON1 extension, which workerd enables.
 *
 * Callers must bind `JSON.stringify(values)` for the returned placeholder.
 */
export function inJsonArray(column: string): string {
  return `${column} IN (SELECT value FROM json_each(?))`;
}

export function deserializeValue(value: unknown, type?: string): unknown {
  if (value === null || value === undefined) return null;

  if (type === 'date' && typeof value === 'string') {
    return new Date(value);
  }

  if (type === 'jsonb' && typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}
