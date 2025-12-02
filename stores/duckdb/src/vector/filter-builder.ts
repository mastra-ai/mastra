import type { DuckDBVectorFilter } from './types.js';

export interface FilterResult {
  clause: string;
  params: unknown[];
}

/**
 * Escape a string for safe use in SQL.
 */
function escapeString(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Convert a value to a SQL literal for comparison with JSON-extracted values.
 * DuckDB's ->> operator returns the raw value without JSON quoting.
 */
function toSqlLiteral(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'string') {
    return `'${escapeString(value)}'`;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  // For objects/arrays, JSON stringify but don't add extra quotes
  return `'${escapeString(JSON.stringify(value))}'`;
}

/**
 * Build a SQL WHERE clause from a filter object.
 * Supports MongoDB-style query operators.
 */
export function buildFilterClause(filter: DuckDBVectorFilter): FilterResult {
  if (!filter || Object.keys(filter).length === 0) {
    return { clause: '1=1', params: [] };
  }

  const conditions: string[] = [];

  for (const [key, value] of Object.entries(filter)) {
    // Handle logical operators
    if (key === '$and') {
      if (Array.isArray(value) && value.length > 0) {
        const subConditions = value.map(subFilter => buildFilterClause(subFilter));
        const andClause = subConditions.map(sc => `(${sc.clause})`).join(' AND ');
        conditions.push(`(${andClause})`);
      }
      continue;
    }

    if (key === '$or') {
      if (Array.isArray(value) && value.length > 0) {
        const subConditions = value.map(subFilter => buildFilterClause(subFilter));
        const orClause = subConditions.map(sc => `(${sc.clause})`).join(' OR ');
        conditions.push(`(${orClause})`);
      }
      continue;
    }

    if (key === '$not') {
      if (typeof value === 'object' && value !== null) {
        const subResult = buildFilterClause(value);
        conditions.push(`NOT (${subResult.clause})`);
      }
      continue;
    }

    if (key === '$nor') {
      if (Array.isArray(value) && value.length > 0) {
        const subConditions = value.map(subFilter => buildFilterClause(subFilter));
        const norClause = subConditions.map(sc => `(${sc.clause})`).join(' OR ');
        conditions.push(`NOT (${norClause})`);
      }
      continue;
    }

    // Handle field conditions
    const fieldPath = buildJsonPath(key);

    if (value === null) {
      conditions.push(`${fieldPath} IS NULL`);
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Handle operators
      const operatorResult = buildOperatorCondition(key, value);
      if (operatorResult) {
        conditions.push(operatorResult);
      }
    } else {
      // Direct equality - for strings, compare directly; for others, use SQL literal
      conditions.push(`${fieldPath} = ${toSqlLiteral(value)}`);
    }
  }

  if (conditions.length === 0) {
    return { clause: '1=1', params: [] };
  }

  return { clause: conditions.join(' AND '), params: [] };
}

/**
 * Build a JSON path expression for accessing nested fields in metadata.
 * DuckDB uses json_extract_string for extracting string values from JSON.
 */
function buildJsonPath(field: string): string {
  // Handle nested paths with dot notation
  const parts = field.split('.');

  // Build the JSON path with $ prefix for DuckDB
  const jsonPath = '$.' + parts.map(p => escapeString(p)).join('.');

  // Use json_extract_string for proper string extraction in DuckDB
  return `json_extract_string(metadata, '${jsonPath}')`;
}

/**
 * Build a condition from an operator object.
 */
function buildOperatorCondition(field: string, operators: Record<string, unknown>): string | null {
  const conditions: string[] = [];
  const fieldPath = buildJsonPath(field);

  for (const [op, value] of Object.entries(operators)) {
    switch (op) {
      case '$eq':
        conditions.push(`${fieldPath} = ${toSqlLiteral(value)}`);
        break;

      case '$ne':
        conditions.push(`${fieldPath} != ${toSqlLiteral(value)}`);
        break;

      case '$gt':
        conditions.push(`CAST(${fieldPath} AS DOUBLE) > ${toSqlLiteral(value)}`);
        break;

      case '$gte':
        conditions.push(`CAST(${fieldPath} AS DOUBLE) >= ${toSqlLiteral(value)}`);
        break;

      case '$lt':
        conditions.push(`CAST(${fieldPath} AS DOUBLE) < ${toSqlLiteral(value)}`);
        break;

      case '$lte':
        conditions.push(`CAST(${fieldPath} AS DOUBLE) <= ${toSqlLiteral(value)}`);
        break;

      case '$in':
        if (Array.isArray(value) && value.length > 0) {
          const literals = value.map(v => toSqlLiteral(v)).join(', ');
          conditions.push(`${fieldPath} IN (${literals})`);
        } else {
          // Empty array - no matches
          conditions.push('1=0');
        }
        break;

      case '$nin':
        if (Array.isArray(value) && value.length > 0) {
          const literals = value.map(v => toSqlLiteral(v)).join(', ');
          conditions.push(`${fieldPath} NOT IN (${literals})`);
        }
        // Empty array - all matches (no condition added)
        break;

      case '$exists':
        if (value) {
          conditions.push(`${fieldPath} IS NOT NULL`);
        } else {
          conditions.push(`${fieldPath} IS NULL`);
        }
        break;

      case '$contains':
        // Check if the field contains the value (for arrays or strings)
        if (typeof value === 'string') {
          conditions.push(`${fieldPath} LIKE '%${escapeString(value)}%'`);
        } else if (Array.isArray(value)) {
          // Check if array contains all specified elements
          // Use TRY_CAST to handle type mismatches gracefully (returns NULL if not an array)
          const jsonPath = `json_extract(metadata, '$.${escapeString(field)}')`;
          const arrayConditions = value.map(v => {
            return `list_contains(TRY_CAST(${jsonPath} AS VARCHAR[]), ${toSqlLiteral(v)})`;
          });
          conditions.push(`(${arrayConditions.join(' AND ')})`);
        } else {
          // Fallback to equality
          conditions.push(`${fieldPath} = ${toSqlLiteral(value)}`);
        }
        break;

      case '$not':
        if (typeof value === 'object' && value !== null) {
          const subResult = buildOperatorCondition(field, value as Record<string, unknown>);
          if (subResult) {
            conditions.push(`NOT (${subResult})`);
          }
        }
        break;

      default:
        throw new Error(`Unsupported operator: ${op}`);
    }
  }

  if (conditions.length === 0) {
    return null;
  }

  return conditions.join(' AND ');
}
