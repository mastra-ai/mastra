import type { InValue } from '@libsql/client';
import type { IMastraLogger } from '@mastra/core/logger';
import { safelyParseJSON, TABLE_SCHEMAS } from '@mastra/core/storage';
import type { PaginationArgs, StorageColumn, TABLE_NAMES } from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';

export function createExecuteWriteOperationWithRetry({
  logger,
  maxRetries,
  initialBackoffMs,
}: {
  logger: IMastraLogger;
  maxRetries: number;
  initialBackoffMs: number;
}) {
  return async function executeWriteOperationWithRetry<T>(
    operationFn: () => Promise<T>,
    operationDescription: string,
  ): Promise<T> {
    let retries = 0;

    while (true) {
      try {
        return await operationFn();
      } catch (error: any) {
        if (
          error.message &&
          (error.message.includes('SQLITE_BUSY') || error.message.includes('database is locked')) &&
          retries < maxRetries
        ) {
          retries++;
          const backoffTime = initialBackoffMs * Math.pow(2, retries - 1);
          logger.warn(
            `LibSQLStore: Encountered SQLITE_BUSY during ${operationDescription}. Retrying (${retries}/${maxRetries}) in ${backoffTime}ms...`,
          );
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        } else {
          logger.error(`LibSQLStore: Error during ${operationDescription} after ${retries} retries: ${error}`);
          throw error;
        }
      }
    }
  };
}

export function prepareStatement({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): {
  sql: string;
  args: InValue[];
} {
  const parsedTableName = parseSqlIdentifier(tableName, 'table name');
  const columns = Object.keys(record).map(col => parseSqlIdentifier(col, 'column name'));
  const values = Object.values(record).map(v => {
    if (typeof v === `undefined` || v === null) {
      // returning an undefined value will cause libsql to throw
      return null;
    }
    if (v instanceof Date) {
      return v.toISOString();
    }
    return typeof v === 'object' ? JSON.stringify(v) : v;
  });
  const placeholders = values.map(() => '?').join(', ');

  return {
    sql: `INSERT OR REPLACE INTO ${parsedTableName} (${columns.join(', ')}) VALUES (${placeholders})`,
    args: values,
  };
}

export function prepareUpdateStatement({
  tableName,
  updates,
  keys,
}: {
  tableName: TABLE_NAMES;
  updates: Record<string, any>;
  keys: Record<string, any>;
}): {
  sql: string;
  args: InValue[];
} {
  const parsedTableName = parseSqlIdentifier(tableName, 'table name');
  const schema = TABLE_SCHEMAS[tableName];

  // Prepare SET clause
  const updateColumns = Object.keys(updates).map(col => parseSqlIdentifier(col, 'column name'));
  const updateValues = Object.values(updates).map(transformToSqlValue);
  const setClause = updateColumns.map(col => `${col} = ?`).join(', ');

  const whereClause = prepareWhereClause(keys, schema);

  return {
    sql: `UPDATE ${parsedTableName} SET ${setClause}${whereClause.sql}`,
    args: [...updateValues, ...whereClause.args],
  };
}

export function transformToSqlValue(value: any): InValue {
  if (typeof value === 'undefined' || value === null) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return typeof value === 'object' ? JSON.stringify(value) : value;
}

export function prepareDeleteStatement({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, any> }): {
  sql: string;
  args: InValue[];
} {
  const parsedTableName = parseSqlIdentifier(tableName, 'table name');
  const whereClause = prepareWhereClause(keys, TABLE_SCHEMAS[tableName]);

  return {
    sql: `DELETE FROM ${parsedTableName}${whereClause.sql}`,
    args: whereClause.args,
  };
}

type WhereValue = InValue | { startAt?: InValue; endAt?: InValue };

export function prepareWhereClause(
  filters: Record<string, WhereValue>,
  schema: Record<string, StorageColumn>,
): {
  sql: string;
  args: InValue[];
} {
  const conditions: string[] = [];
  const args: InValue[] = [];

  for (const [columnName, filterValue] of Object.entries(filters)) {
    const column = schema[columnName];
    if (!column) {
      throw new Error(`Unknown column: ${columnName}`);
    }

    const parsedColumn = parseSqlIdentifier(columnName, 'column name');
    const result = buildCondition(parsedColumn, filterValue);

    conditions.push(result.condition);
    args.push(...result.args);
  }

  return {
    sql: conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '',
    args,
  };
}

function buildCondition(columnName: string, filterValue: WhereValue): { condition: string; args: InValue[] } {
  // Handle null values - IS NULL
  if (filterValue === null) {
    return { condition: `${columnName} IS NULL`, args: [] };
  }

  // Handle date range objects
  if (typeof filterValue === 'object' && filterValue !== null && ('startAt' in filterValue || 'endAt' in filterValue)) {
    return buildDateRangeCondition(columnName, filterValue);
  }

  // Handle exact match
  return {
    condition: `${columnName} = ?`,
    args: [transformToSqlValue(filterValue)],
  };
}

function buildDateRangeCondition(
  columnName: string,
  range: { startAt?: InValue; endAt?: InValue },
): { condition: string; args: InValue[] } {
  const conditions: string[] = [];
  const args: InValue[] = [];

  if (range.startAt !== undefined) {
    conditions.push(`${columnName} >= ?`);
    args.push(transformToSqlValue(range.startAt));
  }

  if (range.endAt !== undefined) {
    conditions.push(`${columnName} <= ?`);
    args.push(transformToSqlValue(range.endAt));
  }

  if (conditions.length === 0) {
    throw new Error('Date range must specify at least startAt or endAt');
  }

  return {
    condition: conditions.join(' AND '),
    args,
  };
}

type DateRangeFilter = {
  startAt?: string;
  endAt?: string;
};

/**
 * Converts pagination date range to where clause date range format
 * @param dateRange - The date range from pagination
 * @param columnName - The timestamp column to filter on (defaults to 'createdAt')
 * @returns Object with the date range filter, or empty object if no date range
 */
export function buildDateRangeFilter(
  dateRange?: PaginationArgs['dateRange'],
  columnName: string = 'createdAt',
): Record<string, DateRangeFilter> {
  if (!dateRange?.start && !dateRange?.end) {
    return {};
  }

  const filter: DateRangeFilter = {};

  if (dateRange.start) {
    filter.startAt = new Date(dateRange.start).toISOString();
  }

  if (dateRange.end) {
    filter.endAt = new Date(dateRange.end).toISOString();
  }

  return { [columnName]: filter };
}

/**
 * Transforms SQL row data back to a typed object format
 * Reverses the transformations done in prepareStatement
 */
export function transformFromSqlRow<T>({
  tableName,
  sqlRow,
}: {
  tableName: TABLE_NAMES;
  sqlRow: Record<string, any>;
}): T {
  const result: Record<string, any> = {};
  const jsonColumns = new Set(
    Object.keys(TABLE_SCHEMAS[tableName])
      .filter(key => TABLE_SCHEMAS[tableName][key]!.type === 'jsonb')
      .map(key => key),
  );
  const dateColumns = new Set(
    Object.keys(TABLE_SCHEMAS[tableName])
      .filter(key => TABLE_SCHEMAS[tableName][key]!.type === 'timestamp')
      .map(key => key),
  );

  for (const [key, value] of Object.entries(sqlRow)) {
    if (value === null || value === undefined) {
      result[key] = value;
      continue;
    }

    if (dateColumns.has(key) && typeof value === 'string') {
      result[key] = new Date(value);
      continue;
    }

    if (jsonColumns.has(key) && typeof value === 'string') {
      result[key] = safelyParseJSON(value);
      continue;
    }

    result[key] = value;
  }

  return result as T;
}
