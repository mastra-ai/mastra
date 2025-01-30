import { BaseFilterTranslator, FieldCondition, Filter, LogicalOperator } from '@mastra/core';

export class PGFilterTranslator extends BaseFilterTranslator {
  translate(filter: Filter): Filter {
    if (this.isEmpty(filter)) {
      return filter;
    }
    this.validateFilter(filter);
    return this.translateNode(filter);
  }

  private translateNode(node: Filter | FieldCondition, currentPath: string = ''): any {
    if (this.isPrimitive(node)) {
      return { $eq: this.normalizeComparisonValue(node) };
    }
    if (Array.isArray(node)) {
      return { $in: this.normalizeArrayValues(node) };
    }

    const entries = Object.entries(node as Record<string, any>);
    const result: Record<string, any> = {};

    for (const [key, value] of entries) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;

      if (this.isOperator(key)) {
        if (this.isLogicalOperator(key)) {
          result[key] = this.translateLogicalOperator(value);
        } else {
          const { operator, value: translatedValue } = this.translateOperator(key, value);
          result[operator] = translatedValue;
        }
        continue;
      }

      if (typeof value === 'object' && value !== null) {
        result[newPath] = this.translateNode(value);
      } else {
        result[newPath] = this.translateNode(value);
      }
    }

    return result;
  }

  private translateLogicalOperator(value: Filter[]): Filter[] {
    if (!value || value.length === 0) {
      return [];
    }
    return value.map(filter => this.translateNode(filter));
  }

  private translateOperator(operator: string, value: any): any {
    if (operator === '$regex') {
      const pattern = typeof value === 'object' ? value.pattern : value;
      const options = typeof value === 'object' ? value.options : '';
      return {
        operator: options?.includes('i') ? '$ilike' : '$like',
        value: `%${pattern}%`,
      };
    }
    return { operator, value };
  }
}
