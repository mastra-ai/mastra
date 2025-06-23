import { BaseFilterTranslator } from '@mastra/core/vector/filter';
import type {
  VectorFilter,
  OperatorValueMap,
  LogicalOperatorValueMap,
  BlacklistedRootOperators,
} from '@mastra/core/vector/filter';

type LanceOperatorValueMap = OperatorValueMap & {
  $like: string;
  $notLike: string;
  $contains: string;
};

type LanceBlacklisted = BlacklistedRootOperators | '$like' | '$notLike' | '$contains';

export type LanceVectorFilter = VectorFilter<
  keyof LanceOperatorValueMap,
  LanceOperatorValueMap,
  LogicalOperatorValueMap,
  LanceBlacklisted
>;

export class LanceFilterTranslator extends BaseFilterTranslator<LanceVectorFilter, string> {
  translate(filter: LanceVectorFilter): string {
    if (!filter || Object.keys(filter).length === 0) {
      return '';
    }

    // Check for fields with periods that aren't nested at top level
    if (typeof filter === 'object' && filter !== null) {
      const keys = Object.keys(filter);
      for (const key of keys) {
        if (key.includes('.') && !this.isNormalNestedField(key)) {
          throw new Error(`Field names containing periods (.) are not supported: ${key}`);
        }
      }
    }

    return this.processFilter(filter);
  }

  private processFilter(filter: unknown, parentPath = ''): string {
    // Handle null case
    if (filter === null) {
      return `${parentPath} IS NULL`;
    }

    // Handle Date objects at top level
    if (filter instanceof Date) {
      return `${parentPath} = ${this.formatValue(filter)}`;
    }

    // Handle top-level operators
    if (typeof filter === 'object' && filter !== null) {
      const obj = filter as Record<string, unknown>;
      const keys = Object.keys(obj);

      // Handle logical operators at top level
      if (keys.length === 1 && this.isOperator(keys[0]!)) {
        const operator = keys[0]!;
        const operatorValue = obj[operator];

        if (this.isLogicalOperator(operator)) {
          if (operator === '$and' || operator === '$or') {
            return this.processLogicalOperator(operator, operatorValue as unknown[]);
          }
          throw new Error(BaseFilterTranslator.ErrorMessages.UNSUPPORTED_OPERATOR(operator));
        }

        throw new Error(BaseFilterTranslator.ErrorMessages.INVALID_TOP_LEVEL_OPERATOR(operator));
      }

      // Check for fields with periods that aren't nested
      for (const key of keys) {
        if (key.includes('.') && !this.isNormalNestedField(key)) {
          throw new Error(`Field names containing periods (.) are not supported: ${key}`);
        }
      }

      // Handle multiple fields (implicit AND)
      if (keys.length > 1) {
        const conditions = keys.map(key => {
          const value = obj[key];
          // Check if key is a nested path or a field
          if (this.isNestedObject(value) && !this.isDateObject(value)) {
            return this.processNestedObject(key, value);
          } else {
            return this.processField(key, value);
          }
        });
        return conditions.join(' AND ');
      }

      // Handle single field
      if (keys.length === 1) {
        const key = keys[0]!;
        const value = obj[key]!;

        if (this.isNestedObject(value) && !this.isDateObject(value)) {
          return this.processNestedObject(key!, value);
        } else {
          return this.processField(key!, value);
        }
      }
    }

    return '';
  }

  private processLogicalOperator(operator: string, conditions: unknown[]): string {
    if (!Array.isArray(conditions)) {
      throw new Error(`Logical operator ${operator} must have an array value`);
    }

    if (conditions.length === 0) {
      return operator === '$and' ? 'true' : 'false';
    }

    const sqlOperator = operator === '$and' ? 'AND' : 'OR';

    const processedConditions = conditions.map(condition => {
      if (typeof condition !== 'object' || condition === null) {
        throw new Error(BaseFilterTranslator.ErrorMessages.INVALID_LOGICAL_OPERATOR_CONTENT(operator));
      }

      // Check if condition is a nested logical operator
      const condObj = condition as Record<string, unknown>;
      const keys = Object.keys(condObj);

      if (keys.length === 1 && this.isOperator(keys[0]!)) {
        if (this.isLogicalOperator(keys[0])) {
          return `(${this.processLogicalOperator(keys[0], condObj[keys[0]] as unknown[])})`;
        } else {
          throw new Error(BaseFilterTranslator.ErrorMessages.UNSUPPORTED_OPERATOR(keys[0]));
        }
      }

      // Handle multiple fields within a logical condition (implicit AND)
      if (keys.length > 1) {
        return `(${this.processFilter(condition)})`;
      }

      return this.processFilter(condition);
    });

    return processedConditions.join(` ${sqlOperator} `);
  }

  private processNestedObject(path: string, value: unknown): string {
    if (typeof value !== 'object' || value === null) {
      throw new Error(`Expected object for nested path ${path}`);
    }

    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);

    // Handle empty object
    if (keys.length === 0) {
      return `${path} = {}`;
    }

    // Handle operators on a field
    if (keys.every(k => this.isOperator(k))) {
      return this.processOperators(path, obj);
    }

    // Process each nested field and join with AND
    const conditions = keys.map(key => {
      const nestedPath = key.includes('.')
        ? `${path}.${key}` // Key already contains dots (pre-dotted path)
        : `${path}.${key}`; // Normal nested field

      if (this.isNestedObject(obj[key]) && !this.isDateObject(obj[key])) {
        return this.processNestedObject(nestedPath, obj[key]);
      } else {
        return this.processField(nestedPath, obj[key]);
      }
    });

    return conditions.join(' AND ');
  }

  private processField(field: string, value: unknown): string {
    // Check for illegal field names
    if (field.includes('.') && !this.isNormalNestedField(field)) {
      throw new Error(`Field names containing periods (.) are not supported: ${field}`);
    }

    // Escape field name if needed
    const escapedField = this.escapeFieldName(field);

    // Handle null value
    if (value === null) {
      return `${escapedField} IS NULL`;
    }

    // Handle Date objects properly
    if (value instanceof Date) {
      return `${escapedField} = ${this.formatValue(value)}`;
    }

    // Handle arrays (convert to IN)
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return 'false'; // Empty array is usually false in SQL
      }
      const normalizedValues = this.normalizeArrayValues(value);
      return `${escapedField} IN (${this.formatArrayValues(normalizedValues)})`;
    }

    // Handle operator objects
    if (this.isOperatorObject(value)) {
      return this.processOperators(field, value as Record<string, unknown>);
    }

    // Handle basic values (normalize dates and other special values)
    return `${escapedField} = ${this.formatValue(this.normalizeComparisonValue(value))}`;
  }

  private processOperators(field: string, operators: Record<string, unknown>): string {
    const escapedField = this.escapeFieldName(field);
    const operatorKeys = Object.keys(operators);

    // Check for logical operators at field level
    if (operatorKeys.some(op => this.isLogicalOperator(op))) {
      const logicalOp = operatorKeys.find(op => this.isLogicalOperator(op)) || '';
      throw new Error(`Unsupported operator: ${logicalOp} cannot be used at field level`);
    }

    // Process each operator and join with AND
    return operatorKeys
      .map(op => {
        const value = operators[op];

        // Check if this is a supported operator
        if (!this.isFieldOperator(op) && !this.isCustomOperator(op)) {
          throw new Error(BaseFilterTranslator.ErrorMessages.UNSUPPORTED_OPERATOR(op));
        }

        switch (op) {
          case '$eq':
            if (value === null) {
              return `${escapedField} IS NULL`;
            }
            return `${escapedField} = ${this.formatValue(this.normalizeComparisonValue(value))}`;
          case '$ne':
            if (value === null) {
              return `${escapedField} IS NOT NULL`;
            }
            return `${escapedField} != ${this.formatValue(this.normalizeComparisonValue(value))}`;
          case '$gt':
            return `${escapedField} > ${this.formatValue(this.normalizeComparisonValue(value))}`;
          case '$gte':
            return `${escapedField} >= ${this.formatValue(this.normalizeComparisonValue(value))}`;
          case '$lt':
            return `${escapedField} < ${this.formatValue(this.normalizeComparisonValue(value))}`;
          case '$lte':
            return `${escapedField} <= ${this.formatValue(this.normalizeComparisonValue(value))}`;
          case '$in':
            if (!Array.isArray(value)) {
              throw new Error(`$in operator requires array value for field: ${field}`);
            }
            if (value.length === 0) {
              return 'false'; // Empty IN is false
            }
            const normalizedValues = this.normalizeArrayValues(value);
            return `${escapedField} IN (${this.formatArrayValues(normalizedValues)})`;
          case '$like':
            return `${escapedField} LIKE ${this.formatValue(value)}`;
          case '$notLike':
            return `${escapedField} NOT LIKE ${this.formatValue(value)}`;
          case '$regex':
            return `regexp_match(${escapedField}, ${this.formatValue(value)})`;
          default:
            throw new Error(BaseFilterTranslator.ErrorMessages.UNSUPPORTED_OPERATOR(op));
        }
      })
      .join(' AND ');
  }

  private formatValue(value: unknown): string {
    if (value === null) {
      return 'NULL';
    }

    if (typeof value === 'string') {
      // Escape single quotes in SQL strings by doubling them
      return `'${value.replace(/'/g, "''")}'`;
    }

    if (typeof value === 'number') {
      return value.toString();
    }

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    if (value instanceof Date) {
      return `timestamp '${value.toISOString()}'`;
    }

    if (typeof value === 'object') {
      if (value instanceof Date) {
        return `timestamp '${value.toISOString()}'`;
      }
      return JSON.stringify(value);
    }

    return String(value);
  }

  private formatArrayValues(array: unknown[]): string {
    return array.map(item => this.formatValue(item)).join(', ');
  }

  normalizeArrayValues(array: unknown[]): unknown[] {
    return array.map(item => {
      if (item instanceof Date) {
        return item; // Keep Date objects as is to properly format them later
      }
      return this.normalizeComparisonValue(item);
    });
  }

  normalizeComparisonValue(value: unknown): unknown {
    // Date objects should be preserved as is, not converted to strings
    if (value instanceof Date) {
      return value;
    }

    return super.normalizeComparisonValue(value);
  }

  private isOperatorObject(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);

    return keys.length > 0 && keys.some(key => this.isOperator(key));
  }

  private isNestedObject(value: unknown): boolean {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isNormalNestedField(field: string): boolean {
    // Check if field is a proper nested field name
    const parts = field.split('.');
    // A valid nested field shouldn't have empty parts or start/end with a dot
    return !field.startsWith('.') && !field.endsWith('.') && parts.every(part => part.trim().length > 0);
  }

  private escapeFieldName(field: string): string {
    // If field contains special characters or is a SQL keyword, escape with backticks
    if (field.includes(' ') || field.includes('-') || /^[A-Z]+$/.test(field) || this.isSqlKeyword(field)) {
      // For nested fields, escape each part
      if (field.includes('.')) {
        return field
          .split('.')
          .map(part => `\`${part}\``)
          .join('.');
      }
      return `\`${field}\``;
    }

    return field;
  }

  private isSqlKeyword(str: string): boolean {
    // Common SQL keywords that might need escaping
    const sqlKeywords = [
      'SELECT',
      'FROM',
      'WHERE',
      'AND',
      'OR',
      'NOT',
      'INSERT',
      'UPDATE',
      'DELETE',
      'CREATE',
      'ALTER',
      'DROP',
      'TABLE',
      'VIEW',
      'INDEX',
      'JOIN',
      'INNER',
      'OUTER',
      'LEFT',
      'RIGHT',
      'FULL',
      'UNION',
      'ALL',
      'DISTINCT',
      'AS',
      'ON',
      'BETWEEN',
      'LIKE',
      'IN',
      'IS',
      'NULL',
      'TRUE',
      'FALSE',
      'ASC',
      'DESC',
      'GROUP',
      'ORDER',
      'BY',
      'HAVING',
      'LIMIT',
      'OFFSET',
      'CASE',
      'WHEN',
      'THEN',
      'ELSE',
      'END',
      'CAST',
      'CUBE',
    ];

    return sqlKeywords.includes(str.toUpperCase());
  }

  private isDateObject(value: unknown): boolean {
    return value instanceof Date;
  }

  /**
   * Override getSupportedOperators to add custom operators for LanceDB
   */
  protected override getSupportedOperators() {
    return {
      ...BaseFilterTranslator.DEFAULT_OPERATORS,
      custom: ['$like', '$notLike', '$regex'],
    };
  }
}
