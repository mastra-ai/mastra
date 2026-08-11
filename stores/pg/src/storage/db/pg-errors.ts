/**
 * Postgres error classifiers for concurrent DDL.
 *
 * `CREATE SCHEMA / TABLE / INDEX IF NOT EXISTS` checks aren't atomic against
 * concurrent backends. Two callers racing past the existence probe can both
 * reach the catalog insert; the loser sees a duplicate-object error. These
 * helpers identify the exact codes we treat as "already exists by the time we
 * look" so every other error surfaces normally.
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
 * True when `error` says a relation with this name already exists in this
 * schema. Covers `42P07` (clean case from `CREATE TABLE`) and `23505`
 * unique-violation races on the relevant pg_catalog indexes, plus a final
 * `/already exists/i` regex fallback for drivers that don't surface a code.
 */
export function isDuplicateRelationError(error: unknown): boolean {
  const { code, constraint, message = '' } = asPgError(error);
  if (code === '42P07') return true;
  if (code === '23505' && (constraint === 'pg_type_typname_nsp_index' || constraint === 'pg_class_relname_nsp_index')) {
    return true;
  }
  return /already exists/i.test(message);
}

/**
 * True when `error` says a schema with this name already exists. Covers
 * `42P06` and the `23505` race on `pg_namespace_nspname_index`, plus a
 * narrower regex fallback than `isDuplicateRelationError` so this helper
 * only swallows schema-existence errors.
 */
export function isDuplicateSchemaError(error: unknown): boolean {
  const { code, constraint, message = '' } = asPgError(error);
  if (code === '42P06') return true;
  if (code === '23505' && constraint === 'pg_namespace_nspname_index') return true;
  return /schema .* already exists/i.test(message);
}
