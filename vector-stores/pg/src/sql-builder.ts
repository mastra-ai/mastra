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
  | 'elemMatch'
  | 'all'
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

// Split into two specific function types
export type LogicalOperatorFn = (key: string) => FilterOperator;
type StandardOperatorFn = (key: string, paramIndex: number) => FilterOperator;

// Union type for the map
type FilterOperatorFn = StandardOperatorFn | LogicalOperatorFn;

type FilterOperatorMap = {
  [K in OperatorType]: FilterOperatorFn;
};

// Helper functions to create operators
const createBasicOperator = (symbol: string) => {
  const isLikeOperator = symbol.toLowerCase().includes('like');
  return (key: string, paramIndex: number): FilterOperator => ({
    sql: `metadata#>>'{${handleKey(key)}}' ${symbol} $${paramIndex}`,
    needsValue: true,
    transformValue: isLikeOperator ? (value: string) => `%${value}%` : undefined,
  });
};

const createNumericOperator = (symbol: string) => {
  return (key: string, paramIndex: number): FilterOperator => ({
    sql: `(metadata#>>'{${handleKey(key)}}')::numeric ${symbol} $${paramIndex}`,
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
  ilike: createBasicOperator('ILIKE'),

  // IN array of values
  in: (key: string, paramIndex: number): FilterOperator => ({
    sql: `metadata#>>'{${handleKey(key)}}' = ANY($${paramIndex}::text[])`,
    needsValue: true,
    transformValue: (value: string) => (Array.isArray(value) ? value : value.split(',')),
  }),
  nin: (key: string, paramIndex: number): FilterOperator => ({
    sql: `metadata#>>'{${handleKey(key)}}' != ALL($${paramIndex}::text[])`,
    needsValue: true,
    transformValue: (value: string) => (Array.isArray(value) ? value : value.split(',')),
  }),

  // JSONB contains
  contains: (key: string, paramIndex: number): FilterOperator => ({
    sql: `metadata @> $${paramIndex}::jsonb`,
    needsValue: true,
    transformValue: (value: any) => {
      const parts = key.split('.');
      return JSON.stringify(parts.reduceRight((value, key) => ({ [key]: value }), value));
    },
  }),
  // Contains any
  elemMatch: (key: string, paramIndex: number): FilterOperator => ({
    sql: `(metadata#>'{${handleKey(key)}}')::jsonb ?| $${paramIndex}::text[]`,
    needsValue: true,
    transformValue: (value: string | string[]) => (Array.isArray(value) ? value : [value]),
  }),
  // Contains all
  all: (key: string, paramIndex: number): FilterOperator => ({
    sql: `CASE 
      WHEN array_length($${paramIndex}::text[], 1) IS NULL THEN false 
      ELSE (metadata#>'{${handleKey(key)}}')::jsonb ?& $${paramIndex}::text[] 
    END`,
    needsValue: true,
    transformValue: (value: string | string[]) => (Array.isArray(value) ? value : [value]),
  }),
  // Key exists
  exists: (key: string): FilterOperator => ({
    sql: `metadata ? '${key}'`,
    needsValue: false,
  }),
  // Logical AND
  $and: (key: string) => ({ sql: `(${key})`, needsValue: false }),
  // Logical OR
  $or: (key: string) => ({ sql: `(${key})`, needsValue: false }),
};

type FilterCondition = {
  operator: OperatorType;
  value?: any;
};

export type Filter = Record<string, FilterCondition | any>;

export const handleKey = (key: string) => {
  return key.replace(/\./g, ',');
};

export function buildFilterQuery(filter: Filter | undefined, minScore: number): { sql: string; values: any[] } {
  const values = [minScore];

  function buildCondition(key: string, value: any): string {
    // Handle logical operators ($and/$or)
    if (key === '$and' || key === '$or') {
      return handleLogicalOperator(key, value);
    }

    // If condition is not a FilterCondition object, assume it's an equality check
    if (!value || typeof value !== 'object') {
      return handleEqualityOperator(key, value);
    }

    // Handle operator conditions
    return handleOperator(key, value);
  }

  function handleEqualityOperator(key: string, value: any): string {
    values.push(value);
    return `metadata#>>'{${handleKey(key)}}' = $${values.length}`;
  }

  function handleOperator(key: string, value: Record<string, any>): string {
    const [[operator, operatorValue] = []] = Object.entries(value);
    if (!operator || value === undefined) {
      throw new Error(`Invalid operator or value for key: ${key}`);
    }
    if (!isValidOperator(operator)) {
      throw new Error(`Unsupported operator: ${operator}`);
    }
    const operatorFn = FILTER_OPERATORS[operator];
    const operatorResult = operatorFn(key, values.length + 1);
    if (operatorResult.needsValue) {
      const transformedValue = operatorResult.transformValue
        ? operatorResult.transformValue(operatorValue)
        : operatorValue;
      values.push(transformedValue);
    }
    return operatorResult.sql;
  }

  function handleLogicalOperator(key: '$and' | '$or', value: Filter[]): string {
    // Handle empty conditions
    if (!value || value.length === 0) {
      return key === '$and' ? 'true' : 'false';
    }
    const joinOperator = key === '$or' ? 'OR' : 'AND';
    const conditions = value.map((f: Filter) => {
      const entries = Object.entries(f);
      if (entries.length === 0) {
        return '';
      }
      // Check if the first key is a logical operator for nested conditions
      const [firstKey, firstValue] = entries[0] || [];
      if (firstKey === '$and' || firstKey === '$or') {
        return buildCondition(firstKey, firstValue);
      }
      // Process all conditions in this filter
      return entries.map(([k, v]) => buildCondition(k, v)).join(` ${joinOperator} `);
    });

    const operatorFn = FILTER_OPERATORS[key] as LogicalOperatorFn;
    return operatorFn(conditions.join(` ${joinOperator} `)).sql;
  }

  if (!filter) {
    return { sql: '', values: values };
  }

  const conditions = Object.entries(filter)
    .map(([key, value]) => buildCondition(key, value))
    .join(' AND ');

  return { sql: conditions ? `WHERE ${conditions}` : '', values: values };
}
