import type { StorageColumn, TABLE_NAMES } from '@mastra/core/storage';
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
 * Prepare WHERE clause for PostgreSQL queries
 */
export function prepareWhereClause(
  filters: Record<string, any>,
  _schema?: Record<string, StorageColumn>,
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
 * Resilient JSON parser for values read from PostgreSQL jsonb columns.
 *
 * The `pg` driver auto-deserialises jsonb columns, so:
 *   - jsonb object → JS object  (already parsed, just return it)
 *   - jsonb array  → JS array   (already parsed, just return it)
 *   - jsonb scalar string `"x"` → bare JS string `"x"` (NOT valid JSON to re-parse)
 *   - jsonb null   → JS null
 *
 * Calling `JSON.parse` on a bare scalar like `"google/gemini-3-flash"` throws,
 * which combined with fail-fast `.map(parseRow)` in list methods crashes the
 * entire listing endpoint when a single row contains a jsonb scalar. This
 * helper falls back to returning the raw value so callers get the same scalar
 * the driver materialised.
 *
 * See https://github.com/mastra-ai/mastra/issues/16224.
 */
export function parseJsonResilient(value: any, _fieldName?: string): any {
  if (value == null) return undefined;
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
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

/**
 * Tenancy scope shape shared by domains that carry `organizationId` / `projectId`
 * columns (datasets, experiments, etc.). Structurally compatible with
 * `DatasetTenancyFilters` and `ExperimentTenancyFilters` in `@mastra/core/storage`.
 */
export type TenancyScope = {
  organizationId?: string;
  projectId?: string;
};

/**
 * Build additional `AND "col" = $N` conditions for a tenancy read-scope filter.
 * Uses double-quoted PG identifiers and continues numbering from `startIndex`.
 * Returns empty arrays and unchanged `nextIndex` when no filters apply.
 *
 * Shared across domains (datasets, experiments, ...) so tenancy predicates stay
 * consistent and cross-tenant reads/deletes do not leak.
 */
export function tenancyWhere(
  filters: TenancyScope | undefined,
  startIndex: number,
): { conditions: string[]; params: any[]; nextIndex: number } {
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = startIndex;
  if (filters?.organizationId !== undefined) {
    conditions.push(`"organizationId" = $${idx++}`);
    params.push(filters.organizationId);
  }
  if (filters?.projectId !== undefined) {
    conditions.push(`"projectId" = $${idx++}`);
    params.push(filters.projectId);
  }
  return { conditions, params, nextIndex: idx };
}
