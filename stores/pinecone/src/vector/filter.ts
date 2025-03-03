import { BaseFilterTranslator } from '@mastra/core/vector/filter';
import type { FieldCondition, VectorFilter, OperatorSupport, QueryOperator } from '@mastra/core/vector/filter';

export class PineconeFilterTranslator extends BaseFilterTranslator {
  protected override getSupportedOperators(): OperatorSupport {
    return {
      ...BaseFilterTranslator.DEFAULT_OPERATORS,
      logical: ['$and', '$or'],
      array: ['$in', '$all', '$nin'],
      element: ['$exists'],
      regex: [],
      custom: [],
    };
  }

  translate(filter?: VectorFilter): VectorFilter {
    if (this.isEmpty(filter)) return filter;
    this.validateFilter(filter);
    return this.translateNode(filter);
  }

  private translateNode(node: VectorFilter | FieldCondition, currentPath: string = ''): any {
    if (this.isRegex(node)) {
      throw new Error('Regex is not supported in Pinecone');
    }
    if (this.isPrimitive(node)) return this.normalizeComparisonValue(node);
    if (Array.isArray(node)) return { $in: this.normalizeArrayValues(node) };

    const entries = Object.entries(node as Record<string, any>);
    const firstEntry = entries[0];

    // Handle single operator case
    if (entries.length === 1 && firstEntry && this.isOperator(firstEntry[0])) {
      const [operator, value] = firstEntry;
      const translated = this.translateOperator(operator, value, currentPath);
      return this.isLogicalOperator(operator) ? { [operator]: translated } : translated;
    }

    // Process each entry
    const result: Record<string, any> = {};

    for (const [key, value] of entries) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;

      if (this.isOperator(key)) {
        result[key] = this.translateOperator(key, value, currentPath);
        continue;
      }

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Handle nested $all
        if (Object.keys(value).length === 1 && '$all' in value) {
          const translated = this.translateNode(value, key);
          if (translated.$and) {
            return translated;
          }
        }

        // Check if the nested object contains operators
        if (Object.keys(value).length === 0) {
          result[newPath] = this.translateNode(value);
        } else {
          const hasOperators = Object.keys(value).some(k => this.isOperator(k));
          if (hasOperators) {
            // For objects with operators, normalize each operator value
            const normalizedValue: Record<string, any> = {};
            for (const [op, opValue] of Object.entries(value)) {
              normalizedValue[op] = this.isOperator(op) ? this.translateOperator(op, opValue) : opValue;
            }
            result[newPath] = normalizedValue;
          } else {
            // For objects without operators, flatten them
            Object.assign(result, this.translateNode(value, newPath));
          }
        }
      } else {
        result[newPath] = this.translateNode(value);
      }
    }

    return result;
  }

  private translateOperator(operator: QueryOperator, value: any, currentPath: string = ''): any {
    // Handle $all specially
    if (operator === '$all') {
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error('A non-empty array is required for the $all operator');
      }

      return this.simulateAllOperator(currentPath, value);
    }

    // Handle logical operators
    if (this.isLogicalOperator(operator)) {
      return Array.isArray(value) ? value.map(item => this.translateNode(item)) : this.translateNode(value);
    }

    // Handle comparison and element operators
    return this.normalizeComparisonValue(value);
  }
}
