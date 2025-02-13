import { type InValue } from '@libsql/client';

import {
  type BasicOperator,
  type NumericOperator,
  type ArrayOperator,
  type ElementOperator,
  type LogicalOperator,
  type RegexOperator,
  type Filter,
} from '../../filter';

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
    sql: `CASE 
      WHEN ? IS NULL THEN json_extract(metadata, '$."${handleKey(key)}"') IS ${symbol === '=' ? '' : 'NOT'} NULL
      ELSE json_extract(metadata, '$."${handleKey(key)}"') ${symbol} ?
    END`,
    needsValue: true,
    transformValue: (value: any) => {
      // Return the values directly, not in an object
      return [value, value];
    },
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
      const arrayValue = Array.isArray(value) ? value : [value];
      if (arrayValue.length === 0) {
        return {
          sql: '1 = 0',
          values: [],
        };
      }

      return {
        sql: `(
          CASE
            WHEN ${validateJsonArray(key)} THEN
                NOT EXISTS (
                    SELECT value 
                    FROM json_each(?) 
                    WHERE value NOT IN (
                    SELECT value 
                    FROM json_each(json_extract(metadata, '$."${handleKey(key)}"'))
                )
            )
            ELSE FALSE
          END
        )`,
        values: [JSON.stringify(arrayValue)],
      };
    },
  }),
  $elemMatch: (key: string) => ({
    sql: `json_extract(metadata, '$."${handleKey(key)}"') = ?`,
    needsValue: true,
    transformValue: (value: any) => {
      if (typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('$elemMatch requires an object with conditions');
      }

      // For nested object conditions
      const conditions = Object.entries(value).map(([field, fieldValue]) => {
        if (field.startsWith('$')) {
          // Direct operators on array elements ($in, $gt, etc)
          const { sql, values } = buildCondition('elem.value', { [field]: fieldValue }, '');
          // Replace the metadata path with elem.value
          const pattern = /json_extract\(metadata, '\$\."[^"]*"(\."[^"]*")*'\)/g;
          const elemSql = sql.replace(pattern, 'elem.value');
          return { sql: elemSql, values };
        } else if (typeof fieldValue === 'object' && !Array.isArray(fieldValue)) {
          // Nested field with operators (count: { $gt: 20 })
          const { sql, values } = buildCondition(field, fieldValue, '');
          // Replace the field path with elem.value path
          const pattern = /json_extract\(metadata, '\$\."[^"]*"(\."[^"]*")*'\)/g;
          const elemSql = sql.replace(pattern, `json_extract(elem.value, '$."${field}"')`);
          return { sql: elemSql, values };
        } else {
          // Simple field equality (warehouse: 'A')
          return {
            sql: `json_extract(elem.value, '$."${field}"') = ?`,
            values: [fieldValue],
          };
        }
      });

      return {
        sql: `(
          CASE
            WHEN ${validateJsonArray(key)} THEN
              EXISTS (
                SELECT 1 
                FROM json_each(json_extract(metadata, '$."${handleKey(key)}"')) as elem
                WHERE ${conditions.map(c => c.sql).join(' AND ')}
              )
            ELSE FALSE
          END
        )`,
        values: conditions.flatMap(c => c.values),
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
  $not: key => ({ sql: `NOT (${key})`, needsValue: false }),
  $nor: (key: string) => ({
    sql: `NOT (${key})`,
    needsValue: false,
  }),
  $size: (key: string, paramIndex: number) => ({
    sql: `(
    CASE
      WHEN json_type(json_extract(metadata, '$."${handleKey(key)}"')) = 'array' THEN 
        json_array_length(json_extract(metadata, '$."${handleKey(key)}"')) = $${paramIndex}
      ELSE FALSE
    END
  )`,
    needsValue: true,
  }),
  //   /**
  //    * Regex Operators
  //    * Supports case insensitive and multiline
  //    */
  //   $regex: (key: string): FilterOperator => ({
  //     sql: `json_extract(metadata, '$."${handleKey(key)}"') = ?`,
  //     needsValue: true,
  //     transformValue: (value: any) => {
  //       const pattern = typeof value === 'object' ? value.$regex : value;
  //       const options = typeof value === 'object' ? value.$options || '' : '';
  //       let sql = `json_extract(metadata, '$."${handleKey(key)}"')`;

  //       // Handle multiline
  //       //   if (options.includes('m')) {
  //       //     sql = `REPLACE(${sql}, CHAR(10), '\n')`;
  //       //   }

  //       //       let finalPattern = pattern;
  //       // if (options) {
  //       //   finalPattern = `(\\?${options})${pattern}`;
  //       // }

  //       //   // Handle case insensitivity
  //       //   if (options.includes('i')) {
  //       //     sql = `LOWER(${sql}) REGEXP LOWER(?)`;
  //       //   } else {
  //       //     sql = `${sql} REGEXP ?`;
  //       //   }

  //       if (options.includes('m')) {
  //         sql = `EXISTS (
  //         SELECT 1
  //         FROM json_each(
  //           json_array(
  //             ${sql},
  //             REPLACE(${sql}, CHAR(10), CHAR(13))
  //           )
  //         ) as lines
  //         WHERE lines.value REGEXP ?
  //       )`;
  //       } else {
  //         sql = `${sql} REGEXP ?`;
  //       }

  //       // Handle case insensitivity
  //       if (options.includes('i')) {
  //         sql = sql.replace('REGEXP ?', 'REGEXP LOWER(?)');
  //         sql = sql.replace('value REGEXP', 'LOWER(value) REGEXP');
  //       }

  //       // Handle extended - allows whitespace and comments in pattern
  //       if (options.includes('x')) {
  //         // Remove whitespace and comments from pattern
  //         const cleanPattern = pattern.replace(/\s+|#.*$/gm, '');
  //         return {
  //           sql,
  //           values: [cleanPattern],
  //         };
  //       }

  //       return {
  //         sql,
  //         values: [pattern],
  //       };
  //     },
  //   }),
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
      const condition = buildCondition(key, value, '');
      values.push(...condition.values);
      return condition.sql;
    })
    .join(' AND ');

  return {
    sql: conditions ? `WHERE ${conditions}` : '',
    values,
  };
}

function buildCondition(key: string, value: any, parentPath: string): FilterResult {
  // Handle logical operators ($and/$or)
  if (['$and', '$or', '$not', '$nor'].includes(key)) {
    return handleLogicalOperator(key as '$and' | '$or' | '$not' | '$nor', value, parentPath);
  }

  // If condition is not a FilterCondition object, assume it's an equality check
  if (!value || typeof value !== 'object') {
    return {
      sql: `json_extract(metadata, '$."${key.replace(/\./g, '"."')}"') = ?`,
      values: [value],
    };
  }

  //TODO: Add regex support
  //   if ('$regex' in value) {
  //     return handleRegexOperator(key, value);
  //   }

  // Handle operator conditions
  return handleOperator(key, value);
}

// function handleRegexOperator(key: string, value: any): FilterResult {
//   const operatorFn = FILTER_OPERATORS['$regex']!;
//   const operatorResult = operatorFn(key, value);
//   const transformed = operatorResult.transformValue ? operatorResult.transformValue(value) : value;

//   return {
//     sql: transformed.sql,
//     values: transformed.values,
//   };
// }

function handleLogicalOperator(
  key: '$and' | '$or' | '$not' | '$nor',
  value: Filter[] | Filter,
  parentPath: string,
): FilterResult {
  // Handle empty conditions
  if (!value || value.length === 0) {
    switch (key) {
      case '$and':
      case '$nor':
        return { sql: 'true', values: [] };
      case '$or':
        return { sql: 'false', values: [] };
      case '$not':
        throw new Error('$not operator cannot be empty');
      default:
        return { sql: 'true', values: [] };
    }
  }

  if (key === '$not') {
    // For top-level $not
    const entries = Object.entries(value);
    const conditions = entries.map(([fieldKey, fieldValue]) => buildCondition(fieldKey, fieldValue, key));
    return {
      sql: `NOT (${conditions.map(c => c.sql).join(' AND ')})`,
      values: conditions.flatMap(c => c.values),
    };
  }

  const values: InValue[] = [];
  const joinOperator = key === '$or' || key === '$nor' ? 'OR' : 'AND';
  const conditions = Array.isArray(value)
    ? value.map(f => {
        const entries = Object.entries(f);
        return entries.map(([k, v]) => buildCondition(k, v, key));
      })
    : [buildCondition(key, value, parentPath)];

  const joined = conditions
    .flat()
    .map(c => {
      values.push(...c.values);
      return c.sql;
    })
    .join(` ${joinOperator} `);

  return {
    sql: key === '$nor' ? `NOT (${joined})` : `(${joined})`,
    values,
  };
}

function handleOperator(key: string, value: any): FilterResult {
  if (typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value);
    const results = entries.map(([operator, operatorValue]) =>
      operator === '$not'
        ? {
            sql: `NOT (${Object.entries(operatorValue as Record<string, any>)
              .map(([op, val]) => processOperator(key, op, val).sql)
              .join(' AND ')})`,
            values: Object.entries(operatorValue as Record<string, any>).flatMap(
              ([op, val]) => processOperator(key, op, val).values,
            ),
          }
        : processOperator(key, operator, operatorValue),
    );

    return {
      sql: `(${results.map(r => r.sql).join(' AND ')})`,
      values: results.flatMap(r => r.values),
    };
  }

  // Handle single operator
  const [[operator, operatorValue] = []] = Object.entries(value);
  return processOperator(key, operator as string, operatorValue);
}

const processOperator = (key: string, operator: string, operatorValue: any): FilterResult => {
  if (!operator.startsWith('$') || !FILTER_OPERATORS[operator]) {
    throw new Error(`Invalid operator: ${operator}`);
  }
  const operatorFn = FILTER_OPERATORS[operator]!;
  const operatorResult = operatorFn(key, operatorValue);

  if (!operatorResult.needsValue) {
    return { sql: operatorResult.sql, values: [] };
  }

  const transformed = operatorResult.transformValue ? operatorResult.transformValue(operatorValue) : operatorValue;

  if (transformed && typeof transformed === 'object' && 'sql' in transformed) {
    return transformed;
  }

  return {
    sql: operatorResult.sql,
    values: Array.isArray(transformed) ? transformed : [transformed],
  };
};
