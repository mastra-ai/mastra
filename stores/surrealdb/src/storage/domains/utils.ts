import type { StorageListMessagesInput } from '@mastra/core/storage';
import { RecordId } from 'surrealdb';
import { recordKey } from '../../shared/connector';

export { recordKey };

/** Normalizes a stored datetime (native `Date`, SDK `DateTime`, ISO string or epoch) to a `Date`. */
export function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate() as Date;
  }
  return new Date(value as string | number);
}

/** Like {@link toDate}, but keeps absent values absent. */
export function toOptionalDate(value: unknown): Date | undefined {
  return value === undefined || value === null ? undefined : toDate(value);
}

/**
 * Prepares a top-level record for `CONTENT`/`MERGE` writes: `undefined` and `null` both
 * become `NONE` (SurrealDB v3 rejects `NULL` for `option<T>` fields). Nested values are
 * left as they are, since flexible objects accept `NULL`.
 */
export function toRecordContent(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) out[key] = value;
  }
  return out;
}

/** Converts SurrealDB record ids anywhere in a row to their plain keys. */
export function stripRecordId<T extends Record<string, unknown>>(row: T): T {
  return row.id instanceof RecordId ? { ...row, id: recordKey(row.id) } : row;
}

export interface Pagination {
  /** Rows to skip. */
  offset: number;
  /** Rows to return (`Number.MAX_SAFE_INTEGER` when unpaginated). */
  limit: number;
  /** `perPage` as reported back to the caller. */
  perPage: number | false;
}

/** Resolves `page`/`perPage` (where `false` means "everything") to an offset and limit. */
export function resolvePagination(page: number, perPageInput: number | false | undefined, defaultPerPage: number) {
  const perPage = perPageInput === undefined ? defaultPerPage : perPageInput;
  if (perPage === false) {
    return { offset: 0, limit: Number.MAX_SAFE_INTEGER, perPage } satisfies Pagination;
  }
  return { offset: page * perPage, limit: perPage, perPage } satisfies Pagination;
}

/** Appends `createdAt` range predicates for a `dateRange` filter. */
export function addDateRange(
  where: string[],
  bindings: Record<string, unknown>,
  dateRange: NonNullable<StorageListMessagesInput['filter']>['dateRange'],
  field = 'createdAt',
): void {
  if (dateRange?.start) {
    where.push(`${field} ${dateRange.startExclusive ? '>' : '>='} $dateStart`);
    bindings.dateStart = toDate(dateRange.start);
  }
  if (dateRange?.end) {
    where.push(`${field} ${dateRange.endExclusive ? '<' : '<='} $dateEnd`);
    bindings.dateEnd = toDate(dateRange.end);
  }
}

/** A page query and its total count, sent as one request. */
export function pageQuery(table: string, where: string[], orderBy: string, withTotal = true): string {
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const page = `SELECT * FROM ${table} ${whereClause} ORDER BY ${orderBy} LIMIT $limit START $offset`;
  return withTotal ? `${page}; SELECT count() AS count FROM ${table} ${whereClause} GROUP ALL;` : `${page};`;
}

/** Reads the total from the second result of {@link pageQuery}. */
export function totalFrom(result: unknown): number {
  const rows = result as Array<{ count?: number }> | undefined;
  return rows?.[0]?.count ?? 0;
}
