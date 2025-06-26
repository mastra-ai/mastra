import { parseFieldKey } from '@mastra/core/utils';
import type {
  BasicOperator,
  NumericOperator,
  ArrayOperator,
  ElementOperator,
  LogicalOperator,
  RegexOperator,
  VectorFilter,
} from '@mastra/core/vector/filter';
import type { PGVectorFilter } from './filter';

type OperatorType =
  | BasicOperator
  | NumericOperator
  | ArrayOperator
  | ElementOperator
  | LogicalOperator
  | '$contains'
  | Exclude<RegexOperator, '$options'>
  | '$size';

type FilterOperator = {
  sql: string;
  needsValue: boolean;
  transformValue?: () => any;
};

type OperatorFn = (key: string, paramIndex: number, value?: any) => FilterOperator;

const createBasicOperator = (symbol: string) => {
  return (key: string, paramIndex: number) => {
    const jsonPathKey = parseJsonPathKey(key);
    return {
      sql: `CASE 
        WHEN $${paramIndex}::text IS NULL THEN metadata#>>'{${jsonPathKey}}' IS ${symbol === '=' ? '' : 'NOT'} NULL
        ELSE metadata#>>'{${jsonPathKey}}' ${symbol} $${paramIndex}::text
      END`,
      needsValue: true,
    };
  };
};

const createNumericOperator = (symbol: string) => {
  return (key: string, paramIndex: number) => {
    const jsonPathKey = parseJsonPathKey(key);
    return {
      sql: `(metadata#>>'{${jsonPathKey}}')::numeric ${symbol} $${paramIndex}`,
      needsValue: true,
    };
  };
};

function buildElemMatchConditions(value: any, paramIndex: number): { sql: string; values: any[] } {
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('$elemMatch requires an object with conditions');
  }

  const conditions: string[] = [];
  const values: any[] = [];

  Object.entries(value).forEach(([field, val]) => {
    const nextParamIndex = paramIndex + values.length;

    let paramOperator;
    let paramKey;
    let paramValue;

    if (field.startsWith('$')) {
      paramOperator = field;
      paramKey = '';
      paramValue = val;
    } else if (typeof val === 'object' && !Array.isArray(val)) {
      const [op, opValue] = Object.entries(val || {})[0] || [];
      paramOperator = op;
      paramKey = field;
      paramValue = opValue;
    } else {
      paramOperator = '$eq';
      paramKey = field;
      paramValue = val;
    }

    const operatorFn = FILTER_OPERATORS[paramOperator as OperatorType];
    if (!operatorFn) {
      throw new Error(`Invalid operator: ${paramOperator}`);
    }
    const result = operatorFn(paramKey, nextParamIndex, paramValue);

    const sql = result.sql.replaceAll('metadata#>>', 'elem#>>');
    conditions.push(sql);
    if (result.needsValue) {
      values.push(paramValue);
    }
  });

  return {
    sql: conditions.join(' AND '),
    values,
  };
}

// Define all filter operators
const FILTER_OPERATORS: Record<OperatorType, OperatorFn> = {
  $eq: createBasicOperator('='),
  $ne: createBasicOperator('!='),
  $gt: createNumericOperator('>'),
  $gte: createNumericOperator('>='),
  $lt: createNumericOperator('<'),
  $lte: createNumericOperator('<='),

  // Array Operators
  $in: (key, paramIndex) => {
    const jsonPathKey = parseJsonPathKey(key);
    return {
      sql: `(
        CASE
          WHEN jsonb_typeof(metadata->'${jsonPathKey}') = 'array' THEN
            EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(metadata->'${jsonPathKey}') as elem
              WHERE elem = ANY($${paramIndex}::text[])
            )
          ELSE metadata#>>'{${jsonPathKey}}' = ANY($${paramIndex}::text[])
        END
      )`,
      needsValue: true,
    };
  },
  $nin: (key, paramIndex) => {
    const jsonPathKey = parseJsonPathKey(key);
    return {
      sql: `(
        CASE
          WHEN jsonb_typeof(metadata->'${jsonPathKey}') = 'array' THEN
            NOT EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(metadata->'${jsonPathKey}') as elem
              WHERE elem = ANY($${paramIndex}::text[])
            )
          ELSE metadata#>>'{${jsonPathKey}}' != ALL($${paramIndex}::text[])
        END
      )`,
      needsValue: true,
    };
  },
  $all: (key, paramIndex) => {
    const jsonPathKey = parseJsonPathKey(key);
    return {
      sql: `CASE WHEN array_length($${paramIndex}::text[], 1) IS NULL THEN false 
            ELSE (metadata#>'{${jsonPathKey}}')::jsonb ?& $${paramIndex}::text[] END`,
      needsValue: true,
    };
  },
  $elemMatch: (key: string, paramIndex: number, value: any): FilterOperator => {
    const { sql, values } = buildElemMatchConditions(value, paramIndex);
    const jsonPathKey = parseJsonPathKey(key);
    return {
      sql: `(
        CASE
          WHEN jsonb_typeof(metadata->'${jsonPathKey}') = 'array' THEN
            EXISTS (
              SELECT 1 
              FROM jsonb_array_elements(metadata->'${jsonPathKey}') as elem
              WHERE ${sql}
            )
          ELSE FALSE
        END
      )`,
      needsValue: true,
      transformValue: () => values,
    };
  },
  // Element Operators
  $exists: key => {
    const jsonPathKey = parseJsonPathKey(key);
    return {
      sql: `metadata ? '${jsonPathKey}'`,
      needsValue: false,
    };
  },

  // Logical Operators
  $and: key => ({ sql: `(${key})`, needsValue: false }),
  $or: key => ({ sql: `(${key})`, needsValue: false }),
  $not: key => ({ sql: `NOT (${key})`, needsValue: false }),
  $nor: key => ({ sql: `NOT (${key})`, needsValue: false }),

  // Regex Operators
  $regex: (key, paramIndex) => {
    const jsonPathKey = parseJsonPathKey(key);
    return {
      sql: `metadata#>>'{${jsonPathKey}}' ~ $${paramIndex}`,
      needsValue: true,
    };
  },

  $contains: (key, paramIndex, value: any) => {
    const jsonPathKey = parseJsonPathKey(key);
    let sql;
    if (Array.isArray(value)) {
      sql = `(metadata->'${jsonPathKey}') ?& $${paramIndex}`;
    } else if (typeof value === 'string') {
      sql = `metadata->>'${jsonPathKey}' ILIKE '%' || $${paramIndex} || '%' ESCAPE '\\'`;
    } else {
      sql = `metadata->>'${jsonPathKey}' = $${paramIndex}`;
    }
    return {
      sql,
      needsValue: true,
      transformValue: () =>
        Array.isArray(value) ? value.map(String) : typeof value === 'string' ? escapeLikePattern(value) : value,
    };
  },
  /**
   * $objectContains: Postgres-only operator for true JSONB object containment.
   * Usage: { field: { $objectContains: { ...subobject } } }
   */
  // $objectContains: (key, paramIndex) => ({
  //   sql: `metadata @> $${paramIndex}::jsonb`,
  //   needsValue: true,
  //   transformValue: value => {
  //     const parts = key.split('.');
  //     return JSON.stringify(parts.reduceRight((value, key) => ({ [key]: value }), value));
  //   },
  // }),
  $size: (key: string, paramIndex: number) => {
    const jsonPathKey = parseJsonPathKey(key);
    return {
      sql: `(
      CASE
        WHEN jsonb_typeof(metadata#>'{${jsonPathKey}}') = 'array' THEN 
          jsonb_array_length(metadata#>'{${jsonPathKey}}') = $${paramIndex}
        ELSE FALSE
      END
    )`,
      needsValue: true,
    };
  },
};

interface FilterResult {
  sql: string;
  values: any[];
}

const parseJsonPathKey = (key: string) => {
  const parsedKey = key !== '' ? parseFieldKey(key) : '';
  return parsedKey.replace(/\./g, ',');
};

function escapeLikePattern(str: string): string {
  return str.replace(/([%_\\])/g, '\\$1');
}

export function buildFilterQuery(filter: PGVectorFilter, minScore: number, topK: number): FilterResult {
  const values = [minScore, topK];

  function buildCondition(key: string, value: any, parentPath: string): string {
    // Handle logical operators ($and/$or)
    if (['$and', '$or', '$not', '$nor'].includes(key)) {
      return handleLogicalOperator(key as '$and' | '$or' | '$not' | '$nor', value, parentPath);
    }

    // If condition is not a FilterCondition object, assume it's an equality check
    if (!value || typeof value !== 'object') {
      values.push(value);
      return `metadata#>>'{${parseJsonPathKey(key)}}' = $${values.length}`;
    }

    // Handle operator conditions
    const [[operator, operatorValue] = []] = Object.entries(value);

    // Special handling for nested $not
    if (operator === '$not') {
      const entries = Object.entries(operatorValue as Record<string, unknown>);
      const conditions = entries
        .map(([nestedOp, nestedValue]) => {
          if (!FILTER_OPERATORS[nestedOp as OperatorType]) {
            throw new Error(`Invalid operator in $not condition: ${nestedOp}`);
          }
          const operatorFn = FILTER_OPERATORS[nestedOp as OperatorType]!;
          const operatorResult = operatorFn(key, values.length + 1, nestedValue);
          if (operatorResult.needsValue) {
            values.push(nestedValue as number);
          }
          return operatorResult.sql;
        })
        .join(' AND ');

      return `NOT (${conditions})`;
    }
    const operatorFn = FILTER_OPERATORS[operator as OperatorType]!;
    const operatorResult = operatorFn(key, values.length + 1, operatorValue);
    if (operatorResult.needsValue) {
      const transformedValue = operatorResult.transformValue ? operatorResult.transformValue() : operatorValue;
      if (Array.isArray(transformedValue) && operator === '$elemMatch') {
        values.push(...transformedValue);
      } else {
        values.push(transformedValue);
      }
    }
    return operatorResult.sql;
  }

  function handleLogicalOperator(
    key: '$and' | '$or' | '$not' | '$nor',
    value: VectorFilter[],
    parentPath: string,
  ): string {
    if (key === '$not') {
      // For top-level $not
      const entries = Object.entries(value);
      const conditions = entries
        .map(([fieldKey, fieldValue]) => buildCondition(fieldKey, fieldValue, key))
        .join(' AND ');
      return `NOT (${conditions})`;
    }

    // Handle empty conditions
    if (!value || value.length === 0) {
      switch (key) {
        case '$and':
        case '$nor':
          return 'true'; // Empty $and/$nor match everything
        case '$or':
          return 'false'; // Empty $or matches nothing
        default:
          return 'true';
      }
    }

    const joinOperator = key === '$or' || key === '$nor' ? 'OR' : 'AND';
    const conditions = value.map((f: VectorFilter) => {
      const entries = Object.entries(f || {});
      if (entries.length === 0) return '';

      const [firstKey, firstValue] = entries[0] || [];
      if (['$and', '$or', '$not', '$nor'].includes(firstKey as string)) {
        return buildCondition(firstKey as string, firstValue, parentPath);
      }
      return entries.map(([k, v]) => buildCondition(k, v, parentPath)).join(` ${joinOperator} `);
    });

    const joined = conditions.join(` ${joinOperator} `);
    const operatorFn = FILTER_OPERATORS[key]!;
    return operatorFn(joined, 0, value).sql;
  }

  if (!filter) {
    return { sql: '', values };
  }

  const conditions = Object.entries(filter)
    .map(([key, value]) => buildCondition(key, value, ''))
    .filter(Boolean)
    .join(' AND ');

  return { sql: conditions ? `WHERE ${conditions}` : '', values };
}
