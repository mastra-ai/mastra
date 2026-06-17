import type { TABLE_NAMES } from '@mastra/core/storage';
import { TABLE_SCHEMAS } from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';

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
