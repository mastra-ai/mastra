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
  | 'containsAny'
  | 'containsAll'
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
    sql: `metadata#>>'{${key.replace(/\./g, ',')}}' ${symbol} $${paramIndex}`,
    needsValue: true,
    transformValue: isLikeOperator ? (value: string) => `%${value}%` : undefined,
  });
};

const createNumericOperator = (symbol: string) => {
  return (key: string, paramIndex: number): FilterOperator => ({
    sql: `(metadata#>>'{${key.replace(/\./g, ',')}}')::numeric ${symbol} $${paramIndex}`,
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
    sql: `metadata#>>'{${key.replace(/\./g, ',')}}' = ANY($${paramIndex}::text[])`,
    needsValue: true,
    transformValue: (value: string) => (Array.isArray(value) ? value : value.split(',')),
  }),
  nin: (key: string, paramIndex: number): FilterOperator => ({
    sql: `metadata#>>'{${key.replace(/\./g, ',')}}' != ALL($${paramIndex}::text[])`,
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
  containsAny: (key: string, paramIndex: number): FilterOperator => ({
    sql: `(metadata#>'{${key.replace(/\./g, ',')}}')::jsonb ?| $${paramIndex}::text[]`,
    needsValue: true,
    transformValue: (value: string | string[]) => (Array.isArray(value) ? value : [value]),
  }),
  // Contains all
  containsAll: (key: string, paramIndex: number): FilterOperator => ({
    sql: `CASE 
      WHEN array_length($${paramIndex}::text[], 1) IS NULL THEN false 
      ELSE (metadata#>'{${key.replace(/\./g, ',')}}')::jsonb ?& $${paramIndex}::text[] 
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

export class FilterBuilder {
  private values: any[] = [];

  constructor(minScore: number) {
    this.values = [minScore];
  }

  buildFilterQuery(filter: Filter | undefined): { sql: string; values: any[] } {
    if (!filter) {
      return { sql: '', values: this.values };
    }

    const conditions = Object.entries(filter)
      .map(([key, value]) => this.buildCondition(key, value))
      .join(' AND ');

    return { sql: conditions ? `WHERE ${conditions}` : '', values: this.values };
  }

  private handleLogicalOperator(key: '$and' | '$or', value: Filter[]): string {
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
        return this.buildCondition(firstKey, firstValue);
      }
      // Process all conditions in this filter
      return entries.map(([k, v]) => this.buildCondition(k, v)).join(` ${joinOperator} `);
    });

    const operatorFn = FILTER_OPERATORS[key] as LogicalOperatorFn;
    return operatorFn(conditions.join(` ${joinOperator} `)).sql;
  }

  private handleEqualityOperator(key: string, value: any): string {
    this.values.push(value);
    return `metadata#>>'{${key.replace(/\./g, ',')}}' = $${this.values.length}`;
  }

  private handleOperator(key: string, value: Record<string, any>): string {
    const [[operator, operatorValue] = []] = Object.entries(value);
    if (!operator || value === undefined) {
      throw new Error(`Invalid operator or value for key: ${key}`);
    }
    if (!isValidOperator(operator)) {
      throw new Error(`Unsupported operator: ${operator}`);
    }
    const operatorFn = FILTER_OPERATORS[operator];
    const operatorResult = operatorFn(key, this.values.length + 1);
    if (operatorResult.needsValue) {
      const transformedValue = operatorResult.transformValue
        ? operatorResult.transformValue(operatorValue)
        : operatorValue;
      this.values.push(transformedValue);
    }
    return operatorResult.sql;
  }

  private buildCondition(key: string, value: any): string {
    // Handle logical operators ($and/$or)
    if (key === '$and' || key === '$or') {
      return this.handleLogicalOperator(key, value);
    }

    // If condition is not a FilterCondition object, assume it's an equality check
    if (!value || typeof value !== 'object') {
      return this.handleEqualityOperator(key, value);
    }

    // Handle operator conditions
    return this.handleOperator(key, value);
  }
}
