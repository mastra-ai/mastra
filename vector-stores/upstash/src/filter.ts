import { BaseFilterTranslator, Filter, FieldCondition, OperatorSupport, ArrayOperator } from '@mastra/core/filter';

// type UpstashArrayOperator = '$in' | '$nin' | '$all' | '$contains' | '$regex';

export class UpstashFilterTranslator extends BaseFilterTranslator {
  protected override getSupportedOperators(): OperatorSupport {
    return {
      ...BaseFilterTranslator.DEFAULT_OPERATORS,
      array: ['$in', '$nin', '$all'],
      regex: ['$regex'],
      custom: ['$contains'],
    };
  }

  translate(filter?: Filter): string | undefined {
    if (this.isEmpty(filter)) return undefined;
    this.validateFilter(filter as Filter);
    return this.translateNode(filter);
  }

  private translateNode(node: Filter | FieldCondition, path: string = ''): string {
    // Handle primitives (direct equality)
    if (this.isPrimitive(node)) {
      return this.formatComparison(path, '=', node);
    }

    // Handle arrays (IN operator)
    if (Array.isArray(node)) {
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
        return Array.isArray(value) && value.length === 0 ? 'TRUE' : this.joinConditions(value, 'AND');

      case '$or':
        return Array.isArray(value) && value.length === 0 ? 'FALSE' : this.joinConditions(value, 'OR');

      case '$not':
        if (typeof value !== 'object') {
          return `NOT (${this.formatComparison(path, '=', value)})`;
        }
        const [op, val] = Object.entries(value)[0] ?? [];
        if (op === '$contains') return `${path} NOT CONTAINS ${this.formatValue(val)}`;
        if (op === '$regex') return `${path} NOT GLOB ${this.formatValue(val)}`;
        return `NOT (${this.translateNode(value, path)})`;

      case '$nor':
        return `NOT (${this.joinConditions(value, 'OR')})`;

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

  private formatValue(value: any): string {
    if (value === undefined) return 'NULL';
    if (typeof value === 'string') {
      return value.includes("'") ? `"${value}"` : `'${value}'`;
    }
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (value === null) return 'NULL';
    return String(value);
  }

  private formatArray(values: any[]): string {
    return values.map(v => this.formatValue(v)).join(', ');
  }

  private formatComparison(path: string, op: string, value: any): string {
    return `${path} ${op} ${this.formatValue(value)}`;
  }

  private joinConditions(conditions: any[], operator: string): string {
    const translated = Array.isArray(conditions)
      ? conditions.map(c => this.translateNode(c))
      : [this.translateNode(conditions)];

    // Don't wrap in parentheses if there's only one condition
    return translated.length === 1 ? (translated[0] ?? '') : `(${translated.join(` ${operator} `)})`;
  }
}
