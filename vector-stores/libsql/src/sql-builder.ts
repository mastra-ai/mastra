import { InValue } from '@libsql/client';
import {
  BasicOperator,
  NumericOperator,
  ArrayOperator,
  ElementOperator,
  LogicalOperator,
  RegexOperator,
  Filter,
} from '@mastra/core';

export type OperatorType =
  | BasicOperator
  | NumericOperator
  | ArrayOperator
  | ElementOperator
  | LogicalOperator
  | '$contains'
  | Exclude<RegexOperator, '$options'>;

type FilterOperator = {
  sql: string;
  needsValue: boolean;
  transformValue?: (value: any) => any;
};

type OperatorFn = (key: string, value?: any) => FilterOperator;

// Helper functions to create operators
const createBasicOperator = (symbol: string) => {
  return (key: string): FilterOperator => ({
    sql: `json_extract(metadata, '$."${handleKey(key)}"') ${symbol} ?`,
    needsValue: true,
  });
};

const createNumericOperator = (symbol: string) => {
  return (key: string): FilterOperator => ({
    sql: `CAST(json_extract(metadata, '$."${handleKey(key)}"') AS NUMERIC) ${symbol} ?`,
    needsValue: true,
  });
};

const validateJsonArray = (key: string) =>
  `json_valid(json_extract(metadata, '$."${handleKey(key)}"'))
   AND json_type(json_extract(metadata, '$."${handleKey(key)}"')) = 'array'`;

// Define all filter operators
export const FILTER_OPERATORS: Record<string, OperatorFn> = {
  $eq: createBasicOperator('='),
  $ne: createBasicOperator('!='),
  $gt: createNumericOperator('>'),
  $gte: createNumericOperator('>='),
  $lt: createNumericOperator('<'),
  $lte: createNumericOperator('<='),

  // Array Operators
  $in: (key: string, value: any) => ({
    sql: `json_extract(metadata, '$."${handleKey(key)}"') IN (${value.map(() => '?').join(',')})`,
    needsValue: true,
  }),
  $nin: (key: string, value: any) => ({
    sql: `json_extract(metadata, '$."${handleKey(key)}"') NOT IN (${value.map(() => '?').join(',')})`,
    needsValue: true,
  }),
  $all: (key: string) => ({
    sql: `json_extract(metadata, '$."${handleKey(key)}"') = ?`,
    needsValue: true,
    transformValue: (value: any) => {
      return {
        sql: `(
          SELECT ${validateJsonArray(key)}
          AND NOT EXISTS (
            SELECT value 
            FROM json_each(?) 
            WHERE value NOT IN (
              SELECT value 
              FROM json_each(json_extract(metadata, '$."${handleKey(key)}"'))
            )
          )
        )`,
        values: [JSON.stringify(Array.isArray(value) ? value : [value])],
      };
    },
  }),
  $elemMatch: (key: string) => ({
    sql: `json_extract(metadata, '$."${handleKey(key)}"') = ?`,
    needsValue: true,
    transformValue: (value: any) => {
      return {
        sql: `(
          SELECT ${validateJsonArray(key)}
          AND EXISTS (
            SELECT 1 
            FROM json_each(json_extract(metadata, '$."${handleKey(key)}"')) as m
            WHERE m.value IN (SELECT value FROM json_each(?))
          )
        )`,
        values: [JSON.stringify(Array.isArray(value) ? value : [value])],
      };
    },
  }),

  // Element Operators
  $exists: (key: string) => ({
    sql: `json_extract(metadata, '$."${handleKey(key)}"') IS NOT NULL`,
    needsValue: false,
  }),

  // Logical Operators
  $and: (key: string) => ({
    sql: `(${key})`,
    needsValue: false,
  }),
  $or: (key: string) => ({
    sql: `(${key})`,
    needsValue: false,
  }),
  $not: (key: string) => ({
    sql: `NOT (${key})`,
    needsValue: false,
  }),
  $nor: (key: string) => ({
    sql: `NOT (${key})`,
    needsValue: false,
  }),

  // Regex Operators
  $regex: (key: string) => ({
    sql: `json_extract(metadata, '$."${handleKey(key)}"') REGEXP ?`,
    needsValue: true,
  }),

  $contains: (key: string) => ({
    sql: `json_extract(metadata, '$."${handleKey(key)}"') = ?`,
    needsValue: true,
    transformValue: (value: any) => {
      // Array containment
      if (Array.isArray(value)) {
        return {
          sql: `(
            SELECT ${validateJsonArray(key)}
            AND EXISTS (
              SELECT 1 
              FROM json_each(json_extract(metadata, '$."${handleKey(key)}"')) as m
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
          sql: `(${paths.map(path => `json_extract(metadata, '$."${handleKey(key)}"."${path}"') = ?`).join(' AND ')})`,
          values,
        };
      }

      return value;
    },
  }),
};

export interface FilterResult {
  sql: string;
  values: InValue[];
}

export const handleKey = (key: string) => {
  return key.replace(/\./g, '"."');
};

export function buildFilterQuery(filter: Filter): FilterResult {
  if (!filter) {
    return { sql: '', values: [] };
  }

  const values: InValue[] = [];
  const conditions = Object.entries(filter)
    .map(([key, value]) => {
      const condition = buildCondition(key, value);
      values.push(...condition.values);
      return condition.sql;
    })
    .join(' AND ');

  return {
    sql: conditions ? `WHERE ${conditions}` : '',
    values,
  };
}

function buildCondition(key: string, value: any): FilterResult {
  // Handle logical operators ($and/$or)
  if (['$and', '$or', '$not', '$nor'].includes(key)) {
    return handleLogicalOperator(key as '$and' | '$or' | '$not' | '$nor', value);
  }

  // If condition is not a FilterCondition object, assume it's an equality check
  if (!value || typeof value !== 'object') {
    return {
      sql: `json_extract(metadata, '$."${key.replace(/\./g, '"."')}"') = ?`,
      values: [value],
    };
  }

  // Handle operator conditions
  return handleOperator(key, value);
}

function handleLogicalOperator(key: '$and' | '$or' | '$not' | '$nor', value: Filter[]): FilterResult {
  if (!value || value.length === 0) {
    return { sql: key === '$and' ? 'true' : 'false', values: [] };
  }

  const values: InValue[] = [];
  const joinOperator = key === '$or' || key === '$nor' ? 'OR' : 'AND';
  const conditions = value.map((f: Filter) => {
    const entries = Object.entries(f);
    if (entries.length === 0) return '';

    const [firstKey, firstValue] = entries[0] || [];
    if (['$and', '$or', '$not', '$nor'].includes(firstKey as string)) {
      const result = buildCondition(firstKey as string, firstValue);
      values.push(...result.values);
      return result.sql;
    }

    const subConditions = Object.entries(f).map(([k, v]) => {
      const result = buildCondition(k, v);
      values.push(...result.values);
      return result.sql;
    });

    return subConditions.join(` ${joinOperator} `);
  });

  const operatorFn = FILTER_OPERATORS[key as string]!;
  return {
    sql: operatorFn(conditions.join(` ${joinOperator} `), values).sql,
    values,
  };
}

function handleOperator(key: string, value: any): FilterResult {
  const [[operator, operatorValue] = []] = Object.entries(value);
  const operatorFn = FILTER_OPERATORS[operator as string]!;
  const operatorResult = operatorFn(key, operatorValue);

  if (!operatorResult.needsValue) {
    return { sql: operatorResult.sql, values: [] };
  }

  const transformed = operatorResult.transformValue ? operatorResult.transformValue(operatorValue) : operatorValue;

  // Handle case where transformValue returns { sql, values }
  if (transformed && typeof transformed === 'object' && 'sql' in transformed) {
    return {
      sql: transformed.sql,
      values: transformed.values,
    };
  }

  return {
    sql: operatorResult.sql,
    values: [transformed],
  };
}
