import type { InValue } from '@libsql/client';
import { parseFieldKey } from '@mastra/core/utils';
import type {
  BasicOperator,
  NumericOperator,
  ArrayOperator,
  ElementOperator,
  LogicalOperator,
} from '@mastra/core/vector/filter';
import type { LibSQLVectorFilter } from './filter';

type OperatorType =
  | BasicOperator
  | NumericOperator
  | ArrayOperator
  | ElementOperator
  | LogicalOperator
  | '$contains'
  | '$size';

type FilterOperator = {
  sql: string;
  needsValue: boolean;
  transformValue?: () => any;
};

type OperatorFn = (key: string, value?: any) => FilterOperator;

// Helper functions to create operators
const createBasicOperator = (symbol: string) => {
  return (key: string, value: any): FilterOperator => {
    const jsonPath = getJsonPath(key);
    return {
      sql: `CASE 
        WHEN ? IS NULL THEN json_extract(metadata, ${jsonPath}) IS ${symbol === '=' ? '' : 'NOT'} NULL
        ELSE json_extract(metadata, ${jsonPath}) ${symbol} ?
      END`,
      needsValue: true,
      transformValue: () => {
        // Return the values directly, not in an object
        return [value, value];
      },
    };
  };
};
const createNumericOperator = (symbol: string) => {
  return (key: string): FilterOperator => {
    const jsonPath = getJsonPath(key);
    return {
      sql: `CAST(json_extract(metadata, ${jsonPath}) AS NUMERIC) ${symbol} ?`,
      needsValue: true,
    };
  };
};

const validateJsonArray = (key: string) => {
  const jsonPath = getJsonPath(key);
  return `json_valid(json_extract(metadata, ${jsonPath}))
   AND json_type(json_extract(metadata, ${jsonPath})) = 'array'`;
};

const pattern = /json_extract\(metadata, '\$\.(?:"[^"]*"(?:\."[^"]*")*|[^']+)'\)/g;

function buildElemMatchConditions(value: any) {
  const conditions = Object.entries(value).map(([field, fieldValue]) => {
    if (field.startsWith('$')) {
      // Direct operators on array elements ($in, $gt, etc)
      const { sql, values } = buildCondition('elem.value', { [field]: fieldValue }, '');
      // Replace the metadata path with elem.value
      const elemSql = sql.replace(pattern, 'elem.value');
      return { sql: elemSql, values };
    } else if (typeof fieldValue === 'object' && !Array.isArray(fieldValue)) {
      // Nested field with operators (count: { $gt: 20 })
      const { sql, values } = buildCondition(field, fieldValue, '');
      // Replace the field path with elem.value path
      const jsonPath = parseJsonPathKey(field);
      const elemSql = sql.replace(pattern, `json_extract(elem.value, '$.${jsonPath}')`);
      return { sql: elemSql, values };
    } else {
      const jsonPath = parseJsonPathKey(field);
      // Simple field equality (warehouse: 'A')
      return {
        sql: `json_extract(elem.value, '$.${jsonPath}') = ?`,
        values: [fieldValue],
      };
    }
  });

  return conditions;
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
  $in: (key: string, value: any) => {
    const jsonPath = getJsonPath(key);
    const arr = Array.isArray(value) ? value : [value];
    if (arr.length === 0) {
      return { sql: '1 = 0', needsValue: true, transformValue: () => [] };
    }
    const paramPlaceholders = arr.map(() => '?').join(',');
    return {
      sql: `(
      CASE
        WHEN ${validateJsonArray(key)} THEN
          EXISTS (
            SELECT 1 FROM json_each(json_extract(metadata, ${jsonPath})) as elem
            WHERE elem.value IN (SELECT value FROM json_each(?))
          )
        ELSE json_extract(metadata, ${jsonPath}) IN (${paramPlaceholders})
      END
    )`,
      needsValue: true,
      transformValue: () => [JSON.stringify(arr), ...arr],
    };
  },

  $nin: (key: string, value: any) => {
    const jsonPath = getJsonPath(key);
    const arr = Array.isArray(value) ? value : [value];
    if (arr.length === 0) {
      return { sql: '1 = 1', needsValue: true, transformValue: () => [] };
    }
    const paramPlaceholders = arr.map(() => '?').join(',');
    return {
      sql: `(
      CASE
        WHEN ${validateJsonArray(key)} THEN
          NOT EXISTS (
            SELECT 1 FROM json_each(json_extract(metadata, ${jsonPath})) as elem
            WHERE elem.value IN (SELECT value FROM json_each(?))
          )
        ELSE json_extract(metadata, ${jsonPath}) NOT IN (${paramPlaceholders})
      END
    )`,
      needsValue: true,
      transformValue: () => [JSON.stringify(arr), ...arr],
    };
  },
  $all: (key: string, value: any) => {
    const jsonPath = getJsonPath(key);
    let sql: string;
    const arrayValue = Array.isArray(value) ? value : [value];

    if (arrayValue.length === 0) {
      // If the array is empty, always return false (no matches)
      sql = '1 = 0';
    } else {
      sql = `(
      CASE
        WHEN ${validateJsonArray(key)} THEN
          NOT EXISTS (
            SELECT value
            FROM json_each(?)
            WHERE value NOT IN (
              SELECT value
              FROM json_each(json_extract(metadata, ${jsonPath}))
            )
          )
        ELSE FALSE
      END
    )`;
    }

    return {
      sql,
      needsValue: true,
      transformValue: () => {
        if (arrayValue.length === 0) {
          return [];
        }
        return [JSON.stringify(arrayValue)];
      },
    };
  },
  $elemMatch: (key: string, value: any) => {
    const jsonPath = getJsonPath(key);
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('$elemMatch requires an object with conditions');
    }

    // For nested object conditions
    const conditions = buildElemMatchConditions(value);

    return {
      sql: `(
        CASE
          WHEN ${validateJsonArray(key)} THEN
            EXISTS (
              SELECT 1
              FROM json_each(json_extract(metadata, ${jsonPath})) as elem
              WHERE ${conditions.map(c => c.sql).join(' AND ')}
            )
          ELSE FALSE
        END
      )`,
      needsValue: true,
      transformValue: () => conditions.flatMap(c => c.values),
    };
  },

  // Element Operators
  $exists: (key: string) => {
    const jsonPath = getJsonPath(key);
    return {
      sql: `json_extract(metadata, ${jsonPath}) IS NOT NULL`,
      needsValue: false,
    };
  },

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
  $size: (key: string, paramIndex: number) => {
    const jsonPath = getJsonPath(key);
    return {
      sql: `(
    CASE
      WHEN json_type(json_extract(metadata, ${jsonPath})) = 'array' THEN 
        json_array_length(json_extract(metadata, ${jsonPath})) = $${paramIndex}
      ELSE FALSE
    END
  )`,
      needsValue: true,
    };
  },
  //   /**
  //    * Regex Operators
  //    * Supports case insensitive and multiline
  //    */
  //   $regex: (key: string): FilterOperator => ({
  //     sql: `json_extract(metadata, '$."${toJsonPathKey(key)}"') = ?`,
  //     needsValue: true,
  //     transformValue: (value: any) => {
  //       const pattern = typeof value === 'object' ? value.$regex : value;
  //       const options = typeof value === 'object' ? value.$options || '' : '';
  //       let sql = `json_extract(metadata, '$."${toJsonPathKey(key)}"')`;

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
  $contains: (key: string, value: any) => {
    const jsonPathKey = parseJsonPathKey(key);
    let sql;
    if (Array.isArray(value)) {
      sql = `(
        SELECT ${validateJsonArray(jsonPathKey)}
        AND EXISTS (
          SELECT 1
          FROM json_each(json_extract(metadata, '$."${jsonPathKey}"')) as m
          WHERE m.value IN (SELECT value FROM json_each(?))
        )
      )`;
    } else if (typeof value === 'string') {
      sql = `lower(json_extract(metadata, '$."${jsonPathKey}"')) LIKE '%' || lower(?) || '%' ESCAPE '\\'`;
    } else {
      sql = `json_extract(metadata, '$."${jsonPathKey}"') = ?`;
    }
    return {
      sql,
      needsValue: true,
      transformValue: () => {
        if (Array.isArray(value)) {
          return [JSON.stringify(value)];
        }
        if (typeof value === 'object' && value !== null) {
          return [JSON.stringify(value)];
        }
        if (typeof value === 'string') {
          return [escapeLikePattern(value)];
        }
        return [value];
      },
    };
  },
  /**
   * $objectContains: True JSON containment for advanced use (deep sub-object match).
   * Usage: { field: { $objectContains: { ...subobject } } }
   */
  // $objectContains: (key: string) => ({
  //   sql: '', // Will be overridden by transformValue
  //   needsValue: true,
  //   transformValue: (value: any) => ({
  //     sql: `json_type(json_extract(metadata, '$."${toJsonPathKey(key)}"')) = 'object'
  //         AND json_patch(json_extract(metadata, '$."${toJsonPathKey(key)}"'), ?) = json_extract(metadata, '$."${toJsonPathKey(key)}"')`,
  //     values: [JSON.stringify(value)],
  //   }),
  // }),
};

interface FilterResult {
  sql: string;
  values: InValue[];
}

function isFilterResult(obj: any): obj is FilterResult {
  return obj && typeof obj === 'object' && typeof obj.sql === 'string' && Array.isArray(obj.values);
}

const parseJsonPathKey = (key: string) => {
  const parsedKey = parseFieldKey(key);
  // Only add quotes around path segments if they contain dots
  if (parsedKey.includes('.')) {
    return parsedKey
      .split('.')
      .map(segment => `"${segment}"`)
      .join('.');
  }
  return parsedKey;
};

// Helper to generate the correct JSON path format for LibSQL
const getJsonPath = (key: string) => {
  const jsonPathKey = parseJsonPathKey(key);
  // Always use quotes for consistency
  return `'$.${jsonPathKey}'`;
};

function escapeLikePattern(str: string): string {
  return str.replace(/([%_\\])/g, '\\$1');
}

export function buildFilterQuery(filter: LibSQLVectorFilter): FilterResult {
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
    const jsonPath = getJsonPath(key);
    return {
      sql: `json_extract(metadata, ${jsonPath}) = ?`,
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
  value: LibSQLVectorFilter[] | LibSQLVectorFilter,
  parentPath: string,
): FilterResult {
  // Handle empty conditions
  if (!value || (Array.isArray(value) && value.length === 0)) {
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
        const entries = !!f ? Object.entries(f) : [];
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
              .map(([op, val]) => processOperator(key, op as OperatorType, val).sql)
              .join(' AND ')})`,
            values: Object.entries(operatorValue as Record<string, any>).flatMap(
              ([op, val]) => processOperator(key, op as OperatorType, val).values,
            ),
          }
        : processOperator(key, operator as OperatorType, operatorValue),
    );

    return {
      sql: `(${results.map(r => r.sql).join(' AND ')})`,
      values: results.flatMap(r => r.values),
    };
  }

  // Handle single operator
  const [[operator, operatorValue] = []] = Object.entries(value);
  return processOperator(key, operator as OperatorType, operatorValue);
}

const processOperator = (key: string, operator: OperatorType, operatorValue: any): FilterResult => {
  if (!operator.startsWith('$') || !FILTER_OPERATORS[operator]) {
    throw new Error(`Invalid operator: ${operator}`);
  }
  const operatorFn = FILTER_OPERATORS[operator]!;
  const operatorResult = operatorFn(key, operatorValue);

  if (!operatorResult.needsValue) {
    return { sql: operatorResult.sql, values: [] };
  }

  const transformed = operatorResult.transformValue ? operatorResult.transformValue() : operatorValue;

  if (isFilterResult(transformed)) {
    return transformed;
  }

  return {
    sql: operatorResult.sql,
    values: Array.isArray(transformed) ? transformed : [transformed],
  };
};
