/**
 * Safely extract array from JSONB column that may be null, undefined, or malformed.
 * Critical for defensive handling of PostgreSQL JSONB columns.
 */
export function safeArray<T>(value: unknown, defaultValue: T[] = []): T[] {
  return Array.isArray(value) ? value : defaultValue;
}
