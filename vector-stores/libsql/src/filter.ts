export type OperatorType = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'contains' | 'exists';

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
    sql: `metadata->>'${key}' ${symbol} ?`,
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
    sql: `(metadata->>'${key}') ${symbol} ?`,
    needsValue: true,
  });
};

// Define all filter operators
export const FILTER_OPERATORS: FilterOperatorMap = {
  // Equal
  eq: createBasicOperator('='),
  // Not equal
  neq: createBasicOperator('!='),

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
  // IN array of values
  in: (key: string): FilterOperator => ({
    sql: `metadata->>'${key}' IN (?)`,
    needsValue: true,
    transformValue: (value: any) => {
      if (Array.isArray(value)) {
        return value.join(',');
      }
      return value;
    },
  }),
  // JSONB contains
  contains: (key: string): FilterOperator => ({
    sql: `json_extract(metadata, '$."${key}"') = ?`,
    needsValue: true,
    transformValue: (value: any) => {
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return value;
    },
  }),
  // Key exists
  exists: (key: string): FilterOperator => ({
    sql: `json_extract(metadata, '$."${key}"') IS NOT NULL`,
    needsValue: false,
  }),
};

type FilterCondition = {
  operator: OperatorType;
  value?: any;
};

export type Filter = Record<string, FilterCondition | any>;
