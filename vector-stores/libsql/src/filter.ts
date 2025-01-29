import { InValue } from '@libsql/client';

export type OperatorType =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'ilike'
  | 'in'
  | 'nin'
  | 'contains'
  | 'exists'
  | '$and'
  | '$or';

// Type guard to check if an operator is valid
export function isValidOperator(operator: string): operator is OperatorType {
  return operator in FILTER_OPERATORS;
}

type FilterOperator = {
  sql: string;
  needsValue: boolean;
  transformValue?: (value: any) => any;
};

type FilterOperatorMap = {
  [K in OperatorType]: (key: string) => FilterOperator;
};

// Helper functions to create operators
const createBasicOperator = (symbol: string) => {
  return (key: string): FilterOperator => ({
    sql: `json_extract(metadata, '$."${key.replace(/\./g, '"."')}"') ${symbol} ?`,
    needsValue: true,
    transformValue: (value: any) => {
      if (Array.isArray(value)) {
        return JSON.stringify(value);
      }
      return value;
    },
  });
};

const createNumericOperator = (symbol: string) => {
  return (key: string): FilterOperator => ({
    sql: `CAST(json_extract(metadata, '$."${key.replace(/\./g, '"."')}"') AS NUMERIC) ${symbol} ?`,
    needsValue: true,
  });
};

// Define all filter operators
export const FILTER_OPERATORS: FilterOperatorMap = {
  // Equal
  eq: createBasicOperator('='),
  // Not equal
  ne: createBasicOperator('!='),

  // Greater than
  gt: createNumericOperator('>'),
  // Greater than or equal
  gte: createNumericOperator('>='),
  // Less than
  lt: createNumericOperator('<'),
  // Less than or equal
  lte: createNumericOperator('<='),

  // Pattern matching (LIKE)
  like: createBasicOperator('LIKE'),
  // Case-insensitive pattern matching (ILIKE)
  ilike: (key: string): FilterOperator => ({
    sql: `UPPER(metadata->>'${key}') LIKE ?`,
    needsValue: true,
  }),
  // Contains array/object/value
  contains: (key: string): FilterOperator => ({
    sql: `json_extract(metadata, '$."${key.replace(/\./g, '"."')}"') = ?`,
    needsValue: true,
    transformValue: (value: any) => {
      // Array containment
      if (Array.isArray(value)) {
        return {
          sql: `(
            SELECT json_valid(json_extract(metadata, '$."${key.replace(/\./g, '"."')}"'))
            AND json_type(json_extract(metadata, '$."${key.replace(/\./g, '"."')}"')) = 'array'
            AND EXISTS (
              SELECT 1 
              FROM json_each(json_extract(metadata, '$."${key.replace(/\./g, '"."')}"')) as m
              WHERE m.value IN (SELECT value FROM json_each(?))
            )
          )`,
          values: [JSON.stringify(value)],
        };
      }

      // Nested object traversal
      if (value && typeof value === 'object') {
        const paths: string[] = [];
        const values: any[] = [];

        function traverse(obj: any, path: string[] = []) {
          for (const [k, v] of Object.entries(obj)) {
            const currentPath = [...path, k];
            if (v && typeof v === 'object' && !Array.isArray(v)) {
              traverse(v, currentPath);
            } else {
              paths.push(currentPath.join('.'));
              values.push(v);
            }
          }
        }

        traverse(value);
        return {
          sql: `(${paths
            .map(path => `json_extract(metadata, '$."${key.replace(/\./g, '"."')}"."${path}"') = ?`)
            .join(' AND ')})`,
          values,
        };
      }

      return value;
    },
  }),
  // IN array of values
  in: (key: string): FilterOperator => ({
    sql: `json_extract(metadata, '$."${key.replace(/\./g, '"."')}"') IN (?)`,
    needsValue: true,
    transformValue: (value: any) => {
      if (Array.isArray(value)) {
        return {
          sql: `json_extract(metadata, '$."${key.replace(/\./g, '"."')}"') IN (${Array(value.length).fill('?').join(',')})`,
          values: value,
        };
      }
      return value;
    },
  }),
  // NOT IN array of values
  nin: (key: string): FilterOperator => ({
    sql: `json_extract(metadata, '$."${key.replace(/\./g, '"."')}"') NOT IN (?)`,
    needsValue: true,
    transformValue: (value: any) => {
      if (Array.isArray(value)) {
        return {
          sql: `json_extract(metadata, '$."${key.replace(/\./g, '"."')}"') NOT IN (${Array(value.length)
            .fill('?')
            .join(',')})`,
          values: value,
        };
      }
      return value;
    },
  }),
  // Key exists
  exists: (key: string): FilterOperator => ({
    sql: `json_extract(metadata, '$."${key.replace(/\./g, '"."')}"') IS NOT NULL`,
    needsValue: false,
  }),
  // Logical AND
  $and: (key: string): FilterOperator => ({
    sql: `(${key})`,
    needsValue: false,
  }),
  // Logical OR
  $or: (key: string): FilterOperator => ({
    sql: `(${key})`,
    needsValue: false,
  }),
};

type FilterCondition = {
  operator: OperatorType;
  value?: any;
};

export type Filter = Record<string, FilterCondition | any>;

export interface FilterResult {
  sql: string;
  values: InValue[];
}
