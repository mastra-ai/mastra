import { createHash } from 'node:crypto';

export const POSTGRES_IDENTIFIER_MAX_LENGTH = 63;

/** Bytes reserved for the `_xxxxxxxx` collision suffix when hashWhenTruncated applies. */
const TRUNCATION_HASH_SUFFIX_LENGTH = 9;

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
 *
 * With `hashWhenTruncated`, a name that exceeds the limit is truncated further
 * to make room for `_` + 8 hex chars of the full name's sha256. Plain
 * truncation cuts the tail, so two names sharing a long `<schema>_<prefix>`
 * collapse to the same identifier and `CREATE INDEX IF NOT EXISTS` (which
 * matches by name only) silently skips the second one. The suffix is
 * deterministic, so creation, warm-init snapshot checks, and DDL export all
 * agree on the same name. Opt-in because renaming already-released constraint
 * names would orphan the existing objects in deployed catalogs.
 */
export function buildConstraintName({
  baseName,
  schemaName,
  maxLength = POSTGRES_IDENTIFIER_MAX_LENGTH,
  hashWhenTruncated = false,
}: {
  baseName: string;
  schemaName?: string;
  maxLength?: number;
  hashWhenTruncated?: boolean;
}): string {
  const prefix = schemaName ? `${schemaName}_` : '';
  const fullName = `${prefix}${baseName}`.toLowerCase();
  if (hashWhenTruncated && Buffer.byteLength(fullName, 'utf-8') > maxLength) {
    // Cap the suffix to the available budget so the result never exceeds
    // maxLength. Below 2 bytes there is no room for `_` + at least one hex
    // char, so fall back to plain truncation.
    const suffixLength = Math.min(TRUNCATION_HASH_SUFFIX_LENGTH, maxLength);
    if (suffixLength < 2) {
      return truncateIdentifier(fullName, maxLength);
    }
    const hash = createHash('sha256')
      .update(fullName)
      .digest('hex')
      .slice(0, suffixLength - 1);
    return `${truncateIdentifier(fullName, maxLength - suffixLength)}_${hash}`;
  }
  return truncateIdentifier(fullName, maxLength);
}
