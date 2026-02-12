export const POSTGRES_IDENTIFIER_MAX_LENGTH = 63;

export function truncateIdentifier(value: string, maxLength = POSTGRES_IDENTIFIER_MAX_LENGTH): string {
  if (maxLength <= 0) return '';
  if (Buffer.byteLength(value, 'utf-8') <= maxLength) return value;

  let bytes = 0;
  let end = 0;
  for (const ch of value) {
    const chBytes = Buffer.byteLength(ch, 'utf-8');
    if (bytes + chBytes > maxLength) break;
    bytes += chBytes;
    end += ch.length; // surrogate pairs have .length === 2
  }
  return value.slice(0, end);
}

/**
 * Builds a constraint name with an optional schema prefix, truncated to fit
 * within Postgres' identifier length limit.  The result is always lowercased
 * because PostgreSQL folds unquoted identifiers to lowercase when storing them
 * in system catalogs (pg_constraint.conname, pg_indexes.indexname, etc.).
 * Without this normalisation, runtime lookups that compare a mixed-case name
 * against the catalog would silently fail.
 */
export function buildConstraintName({
  baseName,
  schemaName,
  maxLength = POSTGRES_IDENTIFIER_MAX_LENGTH,
}: {
  baseName: string;
  schemaName?: string;
  maxLength?: number;
}): string {
  const prefix = schemaName ? `${schemaName}_` : '';
  return truncateIdentifier(`${prefix}${baseName}`.toLowerCase(), maxLength);
}
