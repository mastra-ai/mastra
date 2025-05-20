import { BaseFilterTranslator } from '@mastra/core/vector/filter';
import type { FieldCondition, VectorFilter, OperatorSupport, QueryOperator } from '@mastra/core/vector/filter';

// Extend QueryOperator type to include Milvus-specific operators
type MilvusQueryOperator = QueryOperator;

export class MilvusFilterTranslator extends BaseFilterTranslator {
  protected override getSupportedOperators(): OperatorSupport {
    return {
      ...BaseFilterTranslator.DEFAULT_OPERATORS,
      logical: ['$and', '$or', '$not'],
      array: ['$in', '$nin', '$all'],
      element: ['$exists'],
      regex: [],
      custom: [],
    };
  }

  translate(filter?: VectorFilter): string | undefined {
    if (this.isEmpty(filter)) return undefined;
    this.validateFilter(filter);
    return this.translateNode(filter);
  }

  private translateNode(node: VectorFilter | FieldCondition, currentPath: string = ''): string {
    if (this.isRegex(node)) {
      throw new Error('Regex is not supported in Milvus');
    }

    if (this.isPrimitive(node)) {
      return this.translateComparison(currentPath, '$eq', node);
    }

    if (Array.isArray(node)) {
      return this.translateComparison(currentPath, '$in', node);
    }

    const entries = Object.entries(node as Record<string, any>);
    const firstEntry = entries[0];

    // Handle single operator case
    if (entries.length === 1 && firstEntry && this.isOperator(firstEntry[0])) {
      const [operator, value] = firstEntry;
      return this.translateOperator(operator, value, currentPath);
    }

    // Process each entry
    const conditions: string[] = [];

    for (const [key, value] of entries) {
      const newPath = this.formatFieldPath(currentPath, key);

      if (this.isOperator(key)) {
        const condition = this.translateOperator(key, value, currentPath);
        if (condition) {
          conditions.push(condition);
        }
        continue;
      }

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Handle nested conditions
        const nestedCondition = this.translateNode(value, newPath);
        if (nestedCondition) {
          conditions.push(nestedCondition);
        }
      } else {
        // Handle direct field comparison
        const condition = this.translateComparison(newPath, '$eq', value);
        if (condition) {
          conditions.push(condition);
        }
      }
    }

    return conditions.length > 0 ? conditions.join(' and ') : '';
  }

  private formatFieldPath(currentPath: string, key: string): string {
    return currentPath ? `${currentPath}.${key}` : key;
  }

  private translateOperator(operator: MilvusQueryOperator, value: any, currentPath: string = ''): string {
    switch (operator) {
      case '$and':
        if (!Array.isArray(value)) {
          throw new Error('$and operator requires an array of conditions');
        }
        const andConditions = value.map(item => this.translateNode(item, currentPath));
        return `(${andConditions.join(' and ')})`;

      case '$or':
        if (!Array.isArray(value)) {
          throw new Error('$or operator requires an array of conditions');
        }
        const orConditions = value.map(item => this.translateNode(item, currentPath));
        return `(${orConditions.join(' or ')})`;

      case '$not':
        if (typeof value !== 'object') {
          throw new Error('$not operator requires an object');
        }
        return `not (${this.translateNode(value, currentPath)})`;

      case '$exists':
        return value ? `${currentPath} != ""` : `${currentPath} == ""`;

      default:
        return this.translateComparison(currentPath, operator, value);
    }
  }

  private translateComparison(field: string, operator: QueryOperator, value: any): string {
    const normalizedValue = this.normalizeComparisonValue(value);

    switch (operator) {
      case '$eq':
        return typeof normalizedValue === 'string'
          ? `${field} == "${this.escapeString(normalizedValue)}"`
          : `${field} == ${normalizedValue}`;

      case '$ne':
        return typeof normalizedValue === 'string'
          ? `${field} != "${this.escapeString(normalizedValue)}"`
          : `${field} != ${normalizedValue}`;

      case '$gt':
        return `${field} > ${normalizedValue}`;

      case '$gte':
        return `${field} >= ${normalizedValue}`;

      case '$lt':
        return `${field} < ${normalizedValue}`;

      case '$lte':
        return `${field} <= ${normalizedValue}`;

      case '$in':
        if (!Array.isArray(normalizedValue)) {
          throw new Error('$in operator requires an array');
        }
        const inValues = normalizedValue.map(v => (typeof v === 'string' ? `"${this.escapeString(v)}"` : v));
        return `${field} in [${inValues.join(', ')}]`;

      case '$nin':
        if (!Array.isArray(normalizedValue)) {
          throw new Error('$nin operator requires an array');
        }
        const ninValues = normalizedValue.map(v => (typeof v === 'string' ? `"${this.escapeString(v)}"` : v));
        return `${field} not in [${ninValues.join(', ')}]`;

      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }

  private escapeString(str: string): string {
    return str.replace(/"/g, '\\"');
  }
}
