/**
 * Postgres error classifiers for the v-next observability adapter.
 *
 * `init()` runs `CREATE SCHEMA`, `CREATE TABLE`, `CREATE INDEX`, and
 * `ATTACH PARTITION` statements with `IF NOT EXISTS` guards, but those
 * checks aren't atomic against concurrent backends. Two callers racing
 * past the existence probe can both proceed to the catalog insert, and
 * the loser will see one of a small set of duplicate-object errors.
 *
 * These helpers identify the exact codes / constraints we're willing to
 * swallow as "already exists by the time we look", so every other error
 * surfaces normally.
 */

interface PgErrorLike {
  code?: string;
  constraint?: string;
  message?: string;
}

function asPgError(error: unknown): PgErrorLike {
  return (error ?? {}) as PgErrorLike;
}

/**
 * True when `error` is the Postgres signal for "a relation with this name
 * already exists in this schema".
 *
 *   - `42P07 duplicate_table` — the clean case from `CREATE TABLE`.
 *   - `23505 unique_violation` on `pg_type_typname_nsp_index` — two
 *     backends race past `CREATE TABLE IF NOT EXISTS` and both insert
 *     the rowtype row into `pg_type` before either commits.
 *   - `23505 unique_violation` on `pg_class_relname_nsp_index` — same
 *     race, but the catalog conflict surfaces on `pg_class` first
 *     (PG version + concurrency timing dependent).
 *   - Fallback regex on `/already exists/i` — defensive guard for
 *     drivers / forks that surface the error without populating `code`
 *     or `constraint`.
 */
export function isDuplicateRelationError(error: unknown): boolean {
  const { code, constraint, message = '' } = asPgError(error);
  if (code === '42P07') return true;
  if (
    code === '23505' &&
    (constraint === 'pg_type_typname_nsp_index' ||
      constraint === 'pg_class_relname_nsp_index' ||
      /pg_(type_typname|class_relname)/i.test(message))
  ) {
    return true;
  }
  return /already exists/i.test(message);
}

/**
 * True when `error` is the Postgres signal for "a schema with this name
 * already exists".
 *
 *   - `42P06 duplicate_schema` — the clean case from `CREATE SCHEMA`.
 *   - `23505 unique_violation` on `pg_namespace_nspname_index` — two
 *     backends race past `CREATE SCHEMA IF NOT EXISTS` and both insert
 *     into `pg_namespace` before either commits.
 *   - Fallback regex on `/already exists/i` for the same defensive
 *     reason as `isDuplicateRelationError`.
 */
export function isDuplicateSchemaError(error: unknown): boolean {
  const { code, constraint, message = '' } = asPgError(error);
  if (code === '42P06') return true;
  if (
    code === '23505' &&
    (constraint === 'pg_namespace_nspname_index' || /pg_namespace_nspname/i.test(message))
  ) {
    return true;
  }
  return /schema .* already exists/i.test(message);
}
