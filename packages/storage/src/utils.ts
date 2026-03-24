import { TABLE_SCHEMAS, TABLE_SCORERS } from './constants';
import type { TABLE_NAMES } from './constants';
import type { StorageColumn } from './types';

export type StoreName =
  | 'PG'
  | 'MSSQL'
  | 'LIBSQL'
  | 'MONGODB'
  | 'CLICKHOUSE'
  | 'CLOUDFLARE'
  | 'CLOUDFLARE_D1'
  | 'DYNAMODB'
  | 'LANCE'
  | 'UPSTASH'
  | 'ASTRA'
  | 'CHROMA'
  | 'COUCHBASE'
  | 'OPENSEARCH'
  | 'PINECONE'
  | 'QDRANT'
  | 'S3'
  | 'TURBOPUFFER'
  | 'VECTORIZE'
  | (string & {});

export function safelyParseJSON(input: any): any {
  if (input && typeof input === 'object') return input;
  if (input == null) return {};
  if (typeof input === 'string') {
    try {
      return JSON.parse(input);
    } catch {
      return input;
    }
  }
  return {};
}

export interface TransformRowOptions {
  preferredTimestampFields?: Record<string, string>;
  convertTimestamps?: boolean;
  nullValuePattern?: string;
  fieldMappings?: Record<string, string>;
}

export function transformRow<T = Record<string, any>>(
  row: Record<string, any>,
  tableName: TABLE_NAMES,
  options: TransformRowOptions = {},
): T {
  const { preferredTimestampFields = {}, convertTimestamps = false, nullValuePattern, fieldMappings = {} } = options;

  const tableSchema = TABLE_SCHEMAS[tableName];
  const result: Record<string, any> = {};

  for (const [key, columnSchema] of Object.entries(tableSchema)) {
    const sourceKey = fieldMappings[key] ?? key;
    let value = row[sourceKey];

    if (preferredTimestampFields[key]) {
      value = row[preferredTimestampFields[key]] ?? value;
    }

    if (value === undefined || value === null) {
      continue;
    }

    if (nullValuePattern && value === nullValuePattern) {
      continue;
    }

    if (columnSchema.type === 'jsonb') {
      if (typeof value === 'string') {
        result[key] = safelyParseJSON(value);
      } else if (typeof value === 'object') {
        result[key] = value;
      } else {
        result[key] = value;
      }
    } else if (columnSchema.type === 'timestamp' && convertTimestamps && typeof value === 'string') {
      result[key] = new Date(value);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

export function transformScoreRow<T = Record<string, any>>(row: Record<string, any>, options: TransformRowOptions = {}): T {
  return transformRow<T>(row, TABLE_SCORERS, options);
}

export function toUpperSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function createStoreErrorId(
  kind: 'storage' | 'vector',
  store: StoreName,
  operation: string,
  status: string,
): Uppercase<string> {
  return `MASTRA_${kind.toUpperCase()}_${toUpperSnakeCase(store)}_${toUpperSnakeCase(operation)}_${toUpperSnakeCase(status)}` as Uppercase<string>;
}

export function createStorageErrorId(store: StoreName, operation: string, status: string): Uppercase<string> {
  return createStoreErrorId('storage', store, operation, status);
}

export function createVectorErrorId(store: StoreName, operation: string, status: string): Uppercase<string> {
  return createStoreErrorId('vector', store, operation, status);
}

export const generateStorageErrorId = createStorageErrorId;

export function getSqlType(type: StorageColumn['type']): string {
  switch (type) {
    case 'text':
      return 'TEXT';
    case 'timestamp':
      return 'TIMESTAMP';
    case 'float':
      return 'FLOAT';
    case 'integer':
      return 'INTEGER';
    case 'bigint':
      return 'BIGINT';
    case 'jsonb':
      return 'JSONB';
    case 'boolean':
      return 'BOOLEAN';
    default:
      return 'TEXT';
  }
}

export function getDefaultValue(type: StorageColumn['type']): string {
  switch (type) {
    case 'text':
    case 'uuid':
      return "DEFAULT ''";
    case 'timestamp':
      return "DEFAULT '1970-01-01 00:00:00'";
    case 'integer':
    case 'bigint':
    case 'float':
      return 'DEFAULT 0';
    case 'jsonb':
      return "DEFAULT '{}'";
    case 'boolean':
      return 'DEFAULT FALSE';
    default:
      return "DEFAULT ''";
  }
}

export function ensureDate(date: Date | string | number): Date {
  return date instanceof Date ? date : new Date(date);
}

export function serializeDate(date: Date | string | number): string {
  return ensureDate(date).toISOString();
}

export interface DateRangeFilter {
  start?: Date | string;
  end?: Date | string;
  startExclusive?: boolean;
  endExclusive?: boolean;
}

export function filterByDateRange<T>(items: T[], getDate: (item: T) => Date | string | undefined, range?: DateRangeFilter): T[] {
  if (!range?.start && !range?.end) {
    return items;
  }

  const start = range.start ? ensureDate(range.start) : undefined;
  const end = range.end ? ensureDate(range.end) : undefined;

  return items.filter(item => {
    const value = getDate(item);
    if (!value) return false;

    const date = ensureDate(value);

    if (start) {
      if (range.startExclusive ? date <= start : date < start) {
        return false;
      }
    }

    if (end) {
      if (range.endExclusive ? date >= end : date > end) {
        return false;
      }
    }

    return true;
  });
}

export function jsonValueEquals(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function normalizePerPage(perPageInput: number | false | undefined, defaultValue: number): number {
  if (perPageInput === false) {
    return Number.MAX_SAFE_INTEGER;
  } else if (perPageInput === 0) {
    return 0;
  } else if (typeof perPageInput === 'number' && perPageInput > 0) {
    return perPageInput;
  } else if (typeof perPageInput === 'number' && perPageInput < 0) {
    throw new Error('perPage must be >= 0');
  }
  return defaultValue;
}

export function calculatePagination(
  page: number,
  perPageInput: number | false | undefined,
  normalizedPerPage: number,
): { offset: number; perPage: number | false } {
  return {
    offset: perPageInput === false ? 0 : page * normalizedPerPage,
    perPage: perPageInput === false ? false : normalizedPerPage,
  };
}
