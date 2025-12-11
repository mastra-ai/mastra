import type { StorageColumn, TABLE_NAMES, DateRange } from '@mastra/core/storage';
import { TABLE_SCHEMAS } from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';

export function getSchemaName(schema?: string) {
  return schema ? `[${parseSqlIdentifier(schema, 'schema name')}]` : undefined;
}

export function getTableName({ indexName, schemaName }: { indexName: string; schemaName?: string }) {
  const parsedIndexName = parseSqlIdentifier(indexName, 'index name');
  const quotedIndexName = `[${parsedIndexName}]`;
  const quotedSchemaName = schemaName;
  return quotedSchemaName ? `${quotedSchemaName}.${quotedIndexName}` : quotedIndexName;
}

/**
 * Build date range filter for queries
 */
export function buildDateRangeFilter(dateRange: DateRange | undefined, fieldName: string): Record<string, any> {
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
 * Check if a value is an $in operator object
 */
function isInOperator(value: unknown): value is { $in: unknown[] } {
  return (
    typeof value === 'object' && value !== null && '$in' in value && Array.isArray((value as { $in: unknown[] }).$in)
  );
}

/**
 * Prepare WHERE clause for MSSQL queries with @param substitution
 */
export function prepareWhereClause(
  filters: Record<string, any>,
  _schema?: Record<string, StorageColumn>,
): { sql: string; params: Record<string, any> } {
  const conditions: string[] = [];
  const params: Record<string, any> = {};
  let paramIndex = 1;

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined) return;

    // Handle special operators
    if (key.endsWith('_gte')) {
      const paramName = `p${paramIndex++}`;
      const fieldName = key.slice(0, -4);
      conditions.push(`[${parseSqlIdentifier(fieldName, 'field name')}] >= @${paramName}`);
      params[paramName] = value instanceof Date ? value.toISOString() : value;
    } else if (key.endsWith('_lte')) {
      const paramName = `p${paramIndex++}`;
      const fieldName = key.slice(0, -4);
      conditions.push(`[${parseSqlIdentifier(fieldName, 'field name')}] <= @${paramName}`);
      params[paramName] = value instanceof Date ? value.toISOString() : value;
    } else if (value === null) {
      conditions.push(`[${parseSqlIdentifier(key, 'field name')}] IS NULL`);
    } else if (isInOperator(value)) {
      // Handle $in operator for multiple values
      const inValues = value.$in;
      if (inValues.length === 0) {
        // Empty $in array means no matches - add a false condition
        conditions.push('1 = 0');
      } else if (inValues.length === 1) {
        // Single value - use equality for efficiency
        const paramName = `p${paramIndex++}`;
        conditions.push(`[${parseSqlIdentifier(key, 'field name')}] = @${paramName}`);
        params[paramName] = inValues[0] instanceof Date ? inValues[0].toISOString() : inValues[0];
      } else {
        // Multiple values - use IN clause
        const inParamNames: string[] = [];
        for (const item of inValues) {
          const paramName = `p${paramIndex++}`;
          inParamNames.push(`@${paramName}`);
          params[paramName] = item instanceof Date ? item.toISOString() : item;
        }
        conditions.push(`[${parseSqlIdentifier(key, 'field name')}] IN (${inParamNames.join(', ')})`);
      }
    } else if (Array.isArray(value)) {
      // Handle array values as implicit $in
      if (value.length === 0) {
        conditions.push('1 = 0');
      } else if (value.length === 1) {
        const paramName = `p${paramIndex++}`;
        conditions.push(`[${parseSqlIdentifier(key, 'field name')}] = @${paramName}`);
        params[paramName] = value[0] instanceof Date ? value[0].toISOString() : value[0];
      } else {
        const inParamNames: string[] = [];
        for (const item of value) {
          const paramName = `p${paramIndex++}`;
          inParamNames.push(`@${paramName}`);
          params[paramName] = item instanceof Date ? item.toISOString() : item;
        }
        conditions.push(`[${parseSqlIdentifier(key, 'field name')}] IN (${inParamNames.join(', ')})`);
      }
    } else {
      const paramName = `p${paramIndex++}`;
      conditions.push(`[${parseSqlIdentifier(key, 'field name')}] = @${paramName}`);
      params[paramName] = value instanceof Date ? value.toISOString() : value;
    }
  });

  return {
    sql: conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '',
    params,
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

    // Handle JSON columns (stored as NVARCHAR(MAX) in MSSQL)
    if (columnSchema?.type === 'jsonb' && typeof value === 'string') {
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    }
    // Handle Date columns - convert to Date objects for timestamp columns
    else if (columnSchema?.type === 'timestamp' && value && typeof value === 'string') {
      result[key] = new Date(value);
    } else if (columnSchema?.type === 'timestamp' && value instanceof Date) {
      result[key] = value;
    }
    // Handle boolean columns
    else if (columnSchema?.type === 'boolean') {
      result[key] = Boolean(value);
    } else {
      result[key] = value;
    }
  });

  return result as T;
}
