import { TABLE_SCHEMAS } from '@mastra/core/storage';
import type { TABLE_NAMES } from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';

export type SqlParam = any;

export function quoteIdentifier(value: string, context: string): string {
  return `\`${parseSqlIdentifier(value, context)}\``;
}

export function formatTableName(tableName: TABLE_NAMES, database?: string): string {
  const tableIdent = quoteIdentifier(tableName, 'table name');
  if (!database) {
    return tableIdent;
  }
  return `${quoteIdentifier(database, 'database name')}.${tableIdent}`;
}

export function prepareWhereClause(
  filters: Record<string, any>,
): { sql: string; args: SqlParam[] } {
  const conditions: string[] = [];
  const args: SqlParam[] = [];

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined) return;

    if (key.endsWith('_gte')) {
      const fieldName = key.slice(0, -4);
      conditions.push(`${quoteIdentifier(fieldName, 'column name')} >= ?`);
      args.push(transformToSqlValue(value));
    } else if (key.endsWith('_lte')) {
      const fieldName = key.slice(0, -4);
      conditions.push(`${quoteIdentifier(fieldName, 'column name')} <= ?`);
      args.push(transformToSqlValue(value));
    } else if (key.endsWith('_like')) {
      const fieldName = key.slice(0, -5);
      conditions.push(`${quoteIdentifier(fieldName, 'column name')} LIKE ?`);
      args.push(transformToSqlValue(value));
    } else if (key.endsWith('_in')) {
      const fieldName = key.slice(0, -3);
      const list = Array.isArray(value) ? value : [value];
      if (list.length === 0) {
        conditions.push('FALSE');
      } else {
        const placeholders = list.map(() => '?').join(', ');
        conditions.push(`${quoteIdentifier(fieldName, 'column name')} IN (${placeholders})`);
        args.push(...list.map(transformToSqlValue));
      }
    } else if (key.endsWith('_null')) {
      const fieldName = key.slice(0, -5);
      if (value === true) {
        conditions.push(`${quoteIdentifier(fieldName, 'column name')} IS NULL`);
      } else if (value === false) {
        conditions.push(`${quoteIdentifier(fieldName, 'column name')} IS NOT NULL`);
      }
    } else if (value === null) {
      conditions.push(`${quoteIdentifier(key, 'column name')} IS NULL`);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        conditions.push('FALSE');
      } else {
        const placeholders = value.map(() => '?').join(', ');
        conditions.push(`${quoteIdentifier(key, 'column name')} IN (${placeholders})`);
        args.push(...value.map(transformToSqlValue));
      }
    } else {
      conditions.push(`${quoteIdentifier(key, 'column name')} = ?`);
      args.push(transformToSqlValue(value));
    }
  });

  return {
    sql: conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '',
    args,
  };
}

export function transformToSqlValue(value: any): SqlParam {
  if (value === undefined || value === null) {
    return null;
  }
  if (value instanceof Date) {
    // MySQL DATETIME accepts 'YYYY-MM-DD HH:mm:ss.SSS' (no timezone). Preserve ms precision.
    return value.toISOString().slice(0, 23).replace('T', ' ').replace('Z', '');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value;
}

export function prepareStatement({
  tableName,
  record,
  database,
}: {
  tableName: TABLE_NAMES;
  record: Record<string, any>;
  database?: string;
}): {
  sql: string;
  args: SqlParam[];
} {
  const tableIdent = formatTableName(tableName, database);
  const columns = Object.keys(record);
  if (columns.length === 0) {
    throw new Error('Cannot prepare statement for empty record');
  }
  const columnIdentifiers = columns.map(column => quoteIdentifier(column, 'column name'));
  const values = columns.map(column => transformToSqlValue(record[column]));
  const placeholders = columns.map(() => '?').join(', ');
  const updateAssignments = columnIdentifiers.map(column => `${column} = ?`).join(', ');

  const sql = `INSERT INTO ${tableIdent} (${columnIdentifiers.join(', ')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateAssignments}`;
  return {
    sql,
    args: [...values, ...values],
  };
}

export function prepareUpdateStatement({
  tableName,
  updates,
  keys,
  database,
}: {
  tableName: TABLE_NAMES;
  updates: Record<string, any>;
  keys: Record<string, any>;
  database?: string;
}): {
  sql: string;
  args: SqlParam[];
} {
  if (Object.keys(updates).length === 0) {
    throw new Error('Updates object cannot be empty');
  }
  const tableIdent = formatTableName(tableName, database);
  const setClause = Object.entries(updates)
    .map(([key]) => `${quoteIdentifier(key, 'column name')} = ?`)
    .join(', ');
  const updateValues = Object.values(updates).map(transformToSqlValue);
  const whereClause = prepareWhereClause(keys);

  return {
    sql: `UPDATE ${tableIdent} SET ${setClause}${whereClause.sql}`,
    args: [...updateValues, ...whereClause.args],
  };
}

export function prepareDeleteStatement({
  tableName,
  keys,
  database,
}: {
  tableName: TABLE_NAMES;
  keys: Record<string, any>;
  database?: string;
}): {
  sql: string;
  args: SqlParam[];
} {
  if (Object.keys(keys).length === 0) {
    throw new Error('Keys object cannot be empty for DELETE statement');
  }

  const tableIdent = formatTableName(tableName, database);
  const whereClause = prepareWhereClause(keys);

  return {
    sql: `DELETE FROM ${tableIdent}${whereClause.sql}`,
    args: whereClause.args,
  };
}

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

    if (columnSchema?.type === 'jsonb') {
      if (typeof value === 'string') {
        try {
          result[key] = JSON.parse(value);
        } catch {
          result[key] = value;
        }
      } else {
        result[key] = value;
      }
    } else if (columnSchema?.type === 'timestamp') {
      result[key] = value === null ? null : parseDateTime(value);
    } else if (columnSchema?.type === 'boolean') {
      result[key] = value === true || value === 1 || value === '1';
    } else {
      result[key] = value;
    }
  });

  return result as T;
}

export function parseDateTime(value: Date | string | number | null | undefined): Date | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'number') {
    return new Date(value);
  }
  const str = String(value).trim();
  if (!str) return undefined;
  const normalized = str.includes('T') ? str : str.replace(' ', 'T');
  const withZone = /[zZ]|[+-]\d\d:?\d\d$/.test(normalized) ? normalized : `${normalized}Z`;
  return new Date(withZone);
}
