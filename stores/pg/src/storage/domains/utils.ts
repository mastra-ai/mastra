import { parseSqlIdentifier } from '@mastra/core/utils';
import type { PaginationArgs, StorageColumn, TABLE_NAMES } from '@mastra/core/storage';
import { TABLE_SCHEMAS } from '@mastra/core/storage';

export function getSchemaName(schema?: string) {
  return schema ? `"${parseSqlIdentifier(schema, 'schema name')}"` : undefined;
}

export function getTableName({ indexName, schemaName }: { indexName: string; schemaName?: string }) {
  const parsedIndexName = parseSqlIdentifier(indexName, 'index name');
  const quotedIndexName = `"${parsedIndexName}"`;
  const quotedSchemaName = schemaName;
  return quotedSchemaName ? `${quotedSchemaName}.${quotedIndexName}` : quotedIndexName;
}

/**
 * Build date range filter for queries
 */
export function buildDateRangeFilter(
  dateRange: PaginationArgs['dateRange'],
  fieldName: string,
): Record<string, any> {
  const filters: Record<string, any> = {};
  if (dateRange?.start) {
    filters[`${fieldName}_gte`] = dateRange.start;
  }
  if (dateRange?.end) {
    filters[`${fieldName}_lte`] = dateRange.end;
  }
  return filters;
}

/**
 * Prepare WHERE clause for PostgreSQL queries
 */
export function prepareWhereClause(
  filters: Record<string, any>,
  schema?: Record<string, StorageColumn>,
): { sql: string; args: any[] } {
  const conditions: string[] = [];
  const args: any[] = [];
  let paramIndex = 1;

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined) return;

    // Handle special operators
    if (key.endsWith('_gte')) {
      const fieldName = key.slice(0, -4);
      conditions.push(`"${parseSqlIdentifier(fieldName, 'field name')}" >= $${paramIndex++}`);
      args.push(value instanceof Date ? value.toISOString() : value);
    } else if (key.endsWith('_lte')) {
      const fieldName = key.slice(0, -4);
      conditions.push(`"${parseSqlIdentifier(fieldName, 'field name')}" <= $${paramIndex++}`);
      args.push(value instanceof Date ? value.toISOString() : value);
    } else if (value === null) {
      conditions.push(`"${parseSqlIdentifier(key, 'field name')}" IS NULL`);
    } else {
      conditions.push(`"${parseSqlIdentifier(key, 'field name')}" = $${paramIndex++}`);
      args.push(value instanceof Date ? value.toISOString() : value);
    }
  });

  return {
    sql: conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '',
    args,
  };
}

/**
 * Transform SQL row to record format, handling JSON columns
 */
export function transformFromSqlRow<T>({
  tableName,
  sqlRow,
}: {
  tableName: TABLE_NAMES;
  sqlRow: Record<string, any>;
}): T {
  const schema = TABLE_SCHEMAS[tableName];
  const result: Record<string, any> = {};

  Object.entries(sqlRow).forEach(([key, value]) => {
    const columnSchema = schema?.[key];

    // Handle JSON columns
    if (columnSchema?.type === 'jsonb' && typeof value === 'string') {
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    }
    // Handle Date columns
    else if (columnSchema?.type === 'timestamp' && value) {
      result[key] = value instanceof Date ? value : new Date(value);
    }
    // Handle boolean columns
    else if (columnSchema?.type === 'boolean') {
      result[key] = Boolean(value);
    }
    else {
      result[key] = value;
    }
  });

  return result as T;
}
