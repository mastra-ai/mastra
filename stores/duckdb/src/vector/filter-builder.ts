import type { DuckDBVectorFilter } from './types';

/** Result of building a SQL filter: a WHERE clause fragment and bound parameters. */
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
    } else if (isScalarValue(value)) {
      // Direct equality - compare against the stored JSON type so that, e.g.,
      // `false` does not match a stored 0 and `0` does not match a stored '0'.
      conditions.push(buildScalarEquality(key, value));
    } else {
      // Arrays and other non-scalar values keep the raw literal comparison.
      conditions.push(`${fieldPath} = ${toSqlLiteral(value)}`);
    }
  }

  if (conditions.length === 0) {
    return { clause: '1=1', params: [] };
  }

  return { clause: conditions.join(' AND '), params: [] };
}

/**
 * Build a JSON path literal (e.g. `$.user.role`) for a metadata field.
 * Nested paths use dot notation; each segment is escaped for safe SQL use.
 */
function buildJsonPathLiteral(field: string): string {
  const parts = field.split('.');
  return '$.' + parts.map(p => escapeString(p)).join('.');
}

/**
 * Build an expression that reads a field's value as text.
 * DuckDB's json_extract_string returns SQL NULL for JSON null and for missing
 * paths, and the raw text for every other JSON type.
 */
function buildJsonPath(field: string): string {
  return `json_extract_string(metadata, '${buildJsonPathLiteral(field)}')`;
}

/**
 * Build an expression that reads a field's stored JSON type, e.g. `VARCHAR`,
 * `BOOLEAN`, `UBIGINT`, `BIGINT`, `DOUBLE`, `ARRAY`, or `NULL`.
 */
function buildJsonTypePath(field: string): string {
  return `json_type(metadata, '${buildJsonPathLiteral(field)}')`;
}

/** DuckDB JSON types that hold stored numbers (integers and reals). */
const NUMERIC_JSON_TYPES = "('UBIGINT', 'BIGINT', 'DOUBLE')";

/** Narrow a filter operand to the JSON scalar types that are compared by type. */
function isScalarValue(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

/**
 * Build a type-aware equality predicate for a scalar metadata value.
 * The stored JSON type from json_type() is matched first, so booleans never
 * compare equal to 0/1 and numeric strings never satisfy numeric comparisons.
 */
function buildScalarEquality(field: string, value: string | number | boolean): string {
  const fieldPath = buildJsonPath(field);
  const typePath = buildJsonTypePath(field);

  if (typeof value === 'boolean') {
    return `(${typePath} = 'BOOLEAN' AND ${fieldPath} = '${value ? 'true' : 'false'}')`;
  }
  if (typeof value === 'number') {
    return `(${typePath} IN ${NUMERIC_JSON_TYPES} AND TRY_CAST(${fieldPath} AS DOUBLE) = ${toSqlLiteral(value)})`;
  }
  return `(${typePath} = 'VARCHAR' AND ${fieldPath} = '${escapeString(value)}')`;
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
        if (value === null) {
          conditions.push(`${fieldPath} IS NULL`);
        } else if (isScalarValue(value)) {
          conditions.push(buildScalarEquality(field, value));
        } else {
          conditions.push(`${fieldPath} = ${toSqlLiteral(value)}`);
        }
        break;

      case '$ne':
        if (value === null) {
          conditions.push(`${fieldPath} IS NOT NULL`);
        } else if (isScalarValue(value)) {
          // Only present, non-null values are unequal to a scalar; a missing or
          // explicit-null field must not satisfy $ne (three-valued logic).
          conditions.push(`(${fieldPath} IS NOT NULL AND NOT ${buildScalarEquality(field, value)})`);
        } else {
          conditions.push(`${fieldPath} != ${toSqlLiteral(value)}`);
        }
        break;

      case '$gt':
        conditions.push(
          `(${buildJsonTypePath(field)} IN ${NUMERIC_JSON_TYPES} AND TRY_CAST(${fieldPath} AS DOUBLE) > ${toSqlLiteral(value)})`,
        );
        break;

      case '$gte':
        conditions.push(
          `(${buildJsonTypePath(field)} IN ${NUMERIC_JSON_TYPES} AND TRY_CAST(${fieldPath} AS DOUBLE) >= ${toSqlLiteral(value)})`,
        );
        break;

      case '$lt':
        conditions.push(
          `(${buildJsonTypePath(field)} IN ${NUMERIC_JSON_TYPES} AND TRY_CAST(${fieldPath} AS DOUBLE) < ${toSqlLiteral(value)})`,
        );
        break;

      case '$lte':
        conditions.push(
          `(${buildJsonTypePath(field)} IN ${NUMERIC_JSON_TYPES} AND TRY_CAST(${fieldPath} AS DOUBLE) <= ${toSqlLiteral(value)})`,
        );
        break;

      case '$in':
        if (Array.isArray(value) && value.length > 0) {
          // Handle both array and scalar fields.
          // Array fields: match when any element is in the list.
          // Scalar fields: match with the same type-aware equality used elsewhere,
          // so `[0]` does not select a stored boolean and `['0']` does not select a number.
          // Non-scalar operands (objects, null) fall back to a text comparison of the
          // stored JSON, matching the pre-existing behaviour for those operands.
          const jsonPath = `json_extract(metadata, '$.${escapeString(field)}')`;
          const stringLiterals = value.map(v => toSqlLiteral(String(v))).join(', ');
          const equality = value
            .map(v => (isScalarValue(v) ? buildScalarEquality(field, v) : `${fieldPath} = ${toSqlLiteral(v)}`))
            .join(' OR ');

          // TRY_CAST returns NULL if not an array, so the equality clause covers non-arrays.
          conditions.push(`(list_has_any(TRY_CAST(${jsonPath} AS VARCHAR[]), [${stringLiterals}]) OR (${equality}))`);
        } else {
          // Empty array - no matches
          conditions.push('1=0');
        }
        break;

      case '$nin':
        if (Array.isArray(value) && value.length > 0) {
          // A nonempty $nin must always constrain the result set: never let it
          // compile to no predicate, which would match (and mutate) every row.
          // Scalar operands use the type-aware equality; non-scalar operands
          // (objects, null) fall back to the pre-existing text comparison.
          const equality = value
            .map(v => (isScalarValue(v) ? buildScalarEquality(field, v) : `${fieldPath} = ${toSqlLiteral(v)}`))
            .join(' OR ');
          // Same three-valued logic as $ne: missing and explicit-null values
          // stay excluded rather than satisfying the negation.
          conditions.push(`(${fieldPath} IS NOT NULL AND NOT (${equality}))`);
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
        } else if (isScalarValue(value)) {
          // Fallback to the same type-aware equality used for scalar predicates
          conditions.push(buildScalarEquality(field, value));
        } else {
          // Fallback to equality for non-scalar values
          conditions.push(`${fieldPath} = ${toSqlLiteral(value)}`);
        }
        break;

      case '$all':
        // Check if array field contains all specified elements
        if (Array.isArray(value) && value.length > 0) {
          const jsonPath = `json_extract(metadata, '$.${escapeString(field)}')`;
          const arrayConditions = value.map(v => {
            return `list_contains(TRY_CAST(${jsonPath} AS VARCHAR[]), ${toSqlLiteral(v)})`;
          });
          conditions.push(`(${arrayConditions.join(' AND ')})`);
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
