import type { DateRange, TABLE_NAMES } from '@mastra/core/storage';
import { TABLE_SCHEMAS } from '@mastra/core/storage';
import { quoteIdent } from '../db/utils';

export { quoteIdent };

/**
 * Build storage filter entries for a date range, using the operator suffixes
 * understood by `SpannerDB.prepareWhereClause`.
 */
export function buildDateRangeFilter(dateRange: DateRange | undefined, fieldName: string): Record<string, any> {
  const filters: Record<string, any> = {};
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

/**
 * Convert a Spanner JSON-serialized row into the storage-layer expected shape.
 * Mirrors the helper exported by other adapters so domain code can stay similar.
 */
export function transformFromSpannerRow<T>({
  tableName,
  row,
}: {
  tableName: TABLE_NAMES;
  row: Record<string, any>;
}): T {
  const schema = TABLE_SCHEMAS[tableName];
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    const colDef = schema?.[key];
    if (value === null || value === undefined) {
      result[key] = value;
      continue;
    }
    if (colDef?.type === 'jsonb' && typeof value === 'string') {
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    } else if (colDef?.type === 'timestamp') {
      if (value instanceof Date) {
        // Spanner returns PreciseDate (which extends Date) for TIMESTAMP columns.
        // Normalize to a plain Date so .toISOString() emits millisecond precision
        // matching the values the storage layer expects.
        result[key] = new Date(value.getTime());
      } else if (typeof value === 'string') {
        result[key] = new Date(value);
      } else if (typeof value === 'object' && typeof (value as any).value === 'string') {
        result[key] = new Date((value as any).value);
      } else {
        result[key] = value;
      }
    } else if (colDef?.type === 'integer' || colDef?.type === 'bigint') {
      if (typeof value === 'string') {
        const n = Number(value);
        result[key] = Number.isSafeInteger(n) ? n : value;
      } else if (typeof value === 'bigint') {
        const n = Number(value);
        result[key] = Number.isSafeInteger(n) ? n : value.toString();
      } else {
        result[key] = value;
      }
    } else if (colDef?.type === 'boolean') {
      result[key] = Boolean(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}
