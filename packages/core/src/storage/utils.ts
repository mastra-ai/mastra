import type { ScoreRowData } from '../evals/types';
import { TABLE_SCHEMAS, TABLE_SCORERS } from './constants';
import type { TABLE_NAMES } from './constants';
import type { StorageColumn } from './types';

/**
 * Canonical store names for type safety.
 * Provides autocomplete suggestions while still accepting any string.
 */
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
  // If already an object (and not null), return as-is
  if (input && typeof input === 'object') return input;
  if (input == null) return {};
  // If it's a string, try to parse
  if (typeof input === 'string') {
    try {
      return JSON.parse(input);
    } catch {
      return input;
    }
  }
  // For anything else (number, boolean, etc.), return empty object
  return {};
}

/**
 * Options for transforming storage rows
 */
export interface TransformRowOptions {
  /**
   * Preferred source fields for timestamps (e.g., { createdAt: 'createdAtZ' } means use createdAtZ if available, else createdAt)
   */
  preferredTimestampFields?: Record<string, string>;

  /**
   * Convert timestamp strings to Date objects (default: false for backwards compatibility)
   */
  convertTimestamps?: boolean;

  /**
   * Pattern to treat as null (e.g., '_null_' for ClickHouse)
   */
  nullValuePattern?: string;

  /**
   * Custom field mappings from source to target (e.g., { entity: 'entityData' } for DynamoDB)
   */
  fieldMappings?: Record<string, string>;
}

/**
 * Generic schema-driven row transformer.
 * Uses TABLE_SCHEMAS to determine field types and apply appropriate transformations:
 * - 'jsonb' fields: parsed from JSON strings using safelyParseJSON
 * - 'timestamp' fields: optionally converted to Date objects
 *
 * @param row - The raw row from storage
 * @param tableName - The table name to look up schema from TABLE_SCHEMAS
 * @param options - Optional configuration for store-specific behavior
 * @returns Transformed row with proper types
 */
export function transformRow<T = Record<string, any>>(
  row: Record<string, any>,
  tableName: TABLE_NAMES,
  options: TransformRowOptions = {},
): T {
  const { preferredTimestampFields = {}, convertTimestamps = false, nullValuePattern, fieldMappings = {} } = options;

  const tableSchema = TABLE_SCHEMAS[tableName];
  const result: Record<string, any> = {};

  for (const [key, columnSchema] of Object.entries(tableSchema)) {
    // Handle field mappings (e.g., entityData -> entity for DynamoDB)
    const sourceKey = fieldMappings[key] ?? key;
    let value = row[sourceKey];

    // Handle preferred timestamp sources (e.g., use createdAtZ if available, else createdAt)
    if (preferredTimestampFields[key]) {
      value = row[preferredTimestampFields[key]] ?? value;
    }

    // Skip null/undefined values
    if (value === undefined || value === null) {
      continue;
    }

    // Skip null pattern values (e.g., ClickHouse's '_null_')
    if (nullValuePattern && value === nullValuePattern) {
      continue;
    }

    // Transform based on column type
    if (columnSchema.type === 'jsonb') {
      if (typeof value === 'string') {
        result[key] = safelyParseJSON(value);
      } else if (typeof value === 'object') {
        result[key] = value; // Already parsed
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

/**
 * Transform a raw score row from storage to ScoreRowData.
 * Convenience wrapper around transformRow for the scores table (TABLE_SCORERS).
 *
 * @param row - The raw row from storage
 * @param options - Optional configuration for store-specific behavior
 * @returns Transformed ScoreRowData
 */
export function transformScoreRow(row: Record<string, any>, options: TransformRowOptions = {}): ScoreRowData {
  return transformRow<ScoreRowData>(row, TABLE_SCORERS, options);
}

/**
 * Converts a string to UPPER_SNAKE_CASE, preserving word boundaries from camelCase, PascalCase, kebab-case, etc.
 */
function toUpperSnakeCase(str: string): string {
  return (
    str
      // Insert underscore before uppercase letters that follow lowercase letters (camelCase -> camel_Case)
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      // Insert underscore before uppercase letters that are followed by lowercase letters (XMLParser -> XML_Parser)
      .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
      // Convert to uppercase
      .toUpperCase()
      // Replace any non-alphanumeric characters with underscore
      .replace(/[^A-Z0-9]+/g, '_')
      // Remove leading/trailing underscores
      .replace(/^_+|_+$/g, '')
  );
}

/**
 * Generates a standardized error ID for storage and vector operations.
 *
 * Formats:
 * - Storage: MASTRA_STORAGE_{STORE}_{OPERATION}_{STATUS}
 * - Vector:  MASTRA_VECTOR_{STORE}_{OPERATION}_{STATUS}
 *
 * This function auto-normalizes inputs to UPPER_SNAKE_CASE for flexibility.
 * The store parameter is type-checked against canonical store names for IDE autocomplete.
 *
 * @param type - The operation type ('storage' or 'vector')
 * @param store - The store adapter name (type-checked canonical names)
 * @param operation - The operation that failed (e.g., 'LIST_THREADS_BY_RESOURCE_ID', 'QUERY')
 * @param status - The status/error type (e.g., 'FAILED', 'INVALID_THREAD_ID', 'DUPLICATE_KEY')
 *
 * @example
 * ```ts
 * // Storage operations
 * createStoreErrorId('storage', 'PG', 'LIST_THREADS_BY_RESOURCE_ID', 'FAILED')
 * // Returns: 'MASTRA_STORAGE_PG_LIST_THREADS_BY_RESOURCE_ID_FAILED'
 *
 * // Vector operations
 * createStoreErrorId('vector', 'CHROMA', 'QUERY', 'FAILED')
 * // Returns: 'MASTRA_VECTOR_CHROMA_QUERY_FAILED'
 *
 * // Auto-normalizes any casing
 * createStoreErrorId('storage', 'PG', 'listMessagesById', 'failed')
 * // Returns: 'MASTRA_STORAGE_PG_LIST_MESSAGES_BY_ID_FAILED'
 * ```
 */
export function createStoreErrorId(
  type: 'storage' | 'vector',
  store: StoreName,
  operation: string,
  status: string,
): Uppercase<string> {
  const normalizedStore = toUpperSnakeCase(store);
  const normalizedOperation = toUpperSnakeCase(operation);
  const normalizedStatus = toUpperSnakeCase(status);
  const typePrefix = type === 'storage' ? 'STORAGE' : 'VECTOR';

  return `MASTRA_${typePrefix}_${normalizedStore}_${normalizedOperation}_${normalizedStatus}` as Uppercase<string>;
}

export function createStorageErrorId(store: StoreName, operation: string, status: string): Uppercase<string> {
  return createStoreErrorId('storage', store, operation, status);
}

export function createVectorErrorId(store: StoreName, operation: string, status: string): Uppercase<string> {
  return createStoreErrorId('vector', store, operation, status);
}

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
    default:
      return "DEFAULT ''";
  }
}

export function ensureDate(date: Date | string | undefined): Date | undefined {
  if (!date) return undefined;
  return date instanceof Date ? date : new Date(date);
}

export function serializeDate(date: Date | string | undefined): string | undefined {
  if (!date) return undefined;
  const dateObj = ensureDate(date);
  return dateObj?.toISOString();
}
