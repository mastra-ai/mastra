import { BaseFilterTranslator } from '@mastra/core/vector/filter';
import type { OperatorSupport, VectorFilter, OperatorValueMap } from '@mastra/core/vector/filter';

type UpstashOperatorValueMap = Omit<OperatorValueMap, '$options' | '$elemMatch'> & {
  $contains: string;
};

export type UpstashVectorFilter = VectorFilter<keyof UpstashOperatorValueMap, UpstashOperatorValueMap>;

export class UpstashFilterTranslator extends BaseFilterTranslator<UpstashVectorFilter, string | undefined> {
  protected override getSupportedOperators(): OperatorSupport {
    return {
      ...BaseFilterTranslator.DEFAULT_OPERATORS,
      array: ['$in', '$nin', '$all'],
      regex: ['$regex'],
      custom: ['$contains'],
    };
  }

  translate(filter?: UpstashVectorFilter): string | undefined {
    if (this.isEmpty(filter)) return undefined;
    this.validateFilter(filter);
    return this.translateNode(filter);
  }

  private translateNode(node: UpstashVectorFilter, path: string = ''): string {
    if (this.isRegex(node)) {
      throw new Error('Direct regex pattern format is not supported in Upstash');
    }
    if (node === null || node === undefined) {
      throw new Error('Filtering for null/undefined values is not supported by Upstash Vector');
    }

    // Handle primitives (direct equality)
    if (this.isPrimitive(node)) {
      if (node === null || node === undefined) {
        throw new Error('Filtering for null/undefined values is not supported by Upstash Vector');
      }
      return this.formatComparison(path, '=', node);
    }

    // Handle arrays (IN operator)
    if (Array.isArray(node)) {
      if (node.length === 0) {
        return '(HAS FIELD empty AND HAS NOT FIELD empty)';
      }
      return `${path} IN (${this.formatArray(node)})`;
    }

    const entries = Object.entries(node as Record<string, any>);
    const conditions: string[] = [];

    for (const [key, value] of entries) {
      const newPath = path ? `${path}.${key}` : key;

      if (this.isOperator(key)) {
        conditions.push(this.translateOperator(key, value, path));
      } else if (typeof value === 'object' && value !== null) {
        conditions.push(this.translateNode(value, newPath));
      } else if (value === null || value === undefined) {
        throw new Error('Filtering for null/undefined values is not supported by Upstash Vector');
      } else {
        conditions.push(this.formatComparison(newPath, '=', value));
      }
    }

    return conditions.length > 1 ? `(${conditions.join(' AND ')})` : (conditions[0] ?? '');
  }

  private readonly COMPARISON_OPS = {
    $eq: '=',
    $ne: '!=',
    $gt: '>',
    $gte: '>=',
    $lt: '<',
    $lte: '<=',
  } as const;

  private translateOperator(operator: string, value: any, path: string): string {
    // Handle comparison operators
    if (this.isBasicOperator(operator) || this.isNumericOperator(operator)) {
      return this.formatComparison(path, this.COMPARISON_OPS[operator], value);
    }

    // Handle special operators
    switch (operator) {
      case '$in':
        if (!Array.isArray(value) || value.length === 0) {
          return '(HAS FIELD empty AND HAS NOT FIELD empty)'; // Always false
        }
        return `${path} IN (${this.formatArray(value)})`;
      case '$nin':
        return `${path} NOT IN (${this.formatArray(value)})`;
      case '$contains':
        return `${path} CONTAINS ${this.formatValue(value)}`;
      case '$regex':
        return `${path} GLOB ${this.formatValue(value)}`;
      case '$exists':
        return value ? `HAS FIELD ${path}` : `HAS NOT FIELD ${path}`;

      case '$and':
        if (!Array.isArray(value) || value.length === 0) {
          return '(HAS FIELD empty OR HAS NOT FIELD empty)';
        }
        return this.joinConditions(value, 'AND');

      case '$or':
        if (!Array.isArray(value) || value.length === 0) {
          return '(HAS FIELD empty AND HAS NOT FIELD empty)';
        }
        return this.joinConditions(value, 'OR');

      case '$not':
        return this.formatNot(path, value);

      case '$nor':
        return this.formatNot('', { $or: value });
      case '$all':
        return this.translateOperator(
          '$and',
          value.map((item: unknown) => ({ [path]: { $contains: item } })),
          '',
        );

      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }

  private formatNot(path: string, value: any): string {
    if (typeof value !== 'object') {
      return `${path} != ${this.formatValue(value)}`;
    }

    // NOT(a AND b) is (NOT a OR NOT b), so every entry is negated and the results are OR-ed
    const negated = Object.entries(value).map(([key, val]) =>
      key.startsWith('$') ? this.negateOperator(path, key, val) : this.negateField(path ? `${path}.${key}` : key, val),
    );

    return negated.length > 1 ? `(${negated.join(' OR ')})` : (negated[0] ?? '');
  }

  private negateField(fieldName: string, fieldValue: any): string {
    if (Array.isArray(fieldValue)) {
      // The positive form of an empty array never matches, so its negation always does
      return fieldValue.length === 0
        ? '(HAS FIELD empty OR HAS NOT FIELD empty)'
        : `${fieldName} NOT IN (${this.formatArray(fieldValue)})`;
    }
    if (typeof fieldValue === 'object' && fieldValue !== null && Object.keys(fieldValue).length > 0) {
      const negated = Object.entries(fieldValue).map(([key, val]) =>
        key.startsWith('$') ? this.negateOperator(fieldName, key, val) : this.negateField(`${fieldName}.${key}`, val),
      );
      return negated.length > 1 ? `(${negated.join(' OR ')})` : negated[0]!;
    }
    return `${fieldName} != ${this.formatValue(fieldValue)}`;
  }

  private negateOperator(path: string, op: string, val: any): string {
    // Handle comparison operators
    if (op === '$lt') return `${path} >= ${this.formatValue(val)}`;
    if (op === '$lte') return `${path} > ${this.formatValue(val)}`;
    if (op === '$gt') return `${path} <= ${this.formatValue(val)}`;
    if (op === '$gte') return `${path} < ${this.formatValue(val)}`;
    if (op === '$ne') return `${path} = ${this.formatValue(val)}`;
    if (op === '$eq') return `${path} != ${this.formatValue(val)}`;

    // Special cases
    if (op === '$contains') return `${path} NOT CONTAINS ${this.formatValue(val)}`;
    if (op === '$regex') return `${path} NOT GLOB ${this.formatValue(val)}`;
    if (op === '$in') return `${path} NOT IN (${this.formatArray(val as any[])})`;
    if (op === '$nin') return `${path} IN (${this.formatArray(val as any[])})`;
    if (op === '$exists') return val ? `HAS NOT FIELD ${path}` : `HAS FIELD ${path}`;
    if (op === '$all') {
      // Positive $all is an AND of CONTAINS (always true when empty), so its negation is an OR of NOT CONTAINS
      if (!Array.isArray(val) || val.length === 0) return '(HAS FIELD empty AND HAS NOT FIELD empty)';
      const negated = val.map(item => `${path} NOT CONTAINS ${this.formatValue(item)}`);
      return negated.length > 1 ? `(${negated.join(' OR ')})` : negated[0]!;
    }

    // Transform NOT(AND) into OR(NOT) and NOT(OR) into AND(NOT), negating each condition as a whole
    if (op === '$and' || op === '$or') {
      const newOp = op === '$and' ? '$or' : '$and';
      const conditions = (val as any[]).map((condition: any) => ({ $not: condition }));
      return this.translateOperator(newOp, conditions, '');
    }

    // NOT(NOR) is equivalent to OR
    if (op === '$nor') {
      return this.translateOperator('$or', val, '');
    }

    throw new Error(`Unsupported operator in NOT: ${op}`);
  }

  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      throw new Error('Filtering for null/undefined values is not supported by Upstash Vector');
    }

    if (typeof value === 'string') {
      // Check for quotes in the string content
      const hasSingleQuote = /'/g.test(value);
      const hasDoubleQuote = /"/g.test(value);

      // If string has both types of quotes, escape single quotes and use single quotes
      // If string has single quotes, use double quotes
      // Otherwise, use single quotes (default)
      if (hasSingleQuote && hasDoubleQuote) {
        return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
      }
      if (hasSingleQuote) {
        return `"${value}"`;
      }
      return `'${value}'`;
    }

    if (typeof value === 'number') {
      // Handle scientific notation by converting to decimal
      if (Math.abs(value) < 1e-6 || Math.abs(value) > 1e6) {
        return value.toFixed(20).replace(/\.?0+$/, '');
      }
      // Regular numbers (including zero and negative)
      return value.toString();
    }

    return String(value);
  }

  private formatArray(values: any[]): string {
    return values
      .map(value => {
        if (value === null || value === undefined) {
          throw new Error('Filtering for null/undefined values is not supported by Upstash Vector');
        }
        return this.formatValue(value);
      })
      .join(', ');
  }

  private formatComparison(path: string, op: string, value: any): string {
    return `${path} ${op} ${this.formatValue(value)}`;
  }

  private joinConditions(conditions: any[], operator: string): string {
    const translated = Array.isArray(conditions)
      ? conditions.map(c => this.translateNode(c))
      : [this.translateNode(conditions)];

    // Don't wrap in parentheses if there's only one condition
    return `(${translated.join(` ${operator} `)})`;
  }
}
