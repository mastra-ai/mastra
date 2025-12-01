import type { ScoreRowData } from '../evals/types';
import { TABLE_SCHEMAS, TABLE_SCORERS } from './constants';
import type { TABLE_NAMES } from './constants';

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
