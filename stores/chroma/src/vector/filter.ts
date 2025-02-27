import type { VectorFilter } from '@mastra/core/vector';
import { BaseFilterTranslator } from '@mastra/core/filter';
import type { FieldCondition, Filter, OperatorSupport, QueryOperator } from '@mastra/core/filter';

/**
 * Translator for Chroma filter queries.
 * Maintains MongoDB-compatible syntax while ensuring proper validation
 * and normalization of values.
 */
export class ChromaFilterTranslator extends BaseFilterTranslator {
  protected override getSupportedOperators(): OperatorSupport {
    return {
      ...BaseFilterTranslator.DEFAULT_OPERATORS,
      logical: ['$and', '$or'],
      array: ['$in', '$nin'],
      element: [],
      regex: [],
      custom: [],
    };
  }

  translate(filter?: VectorFilter): VectorFilter {
    if (this.isEmpty(filter)) return filter;
    this.validateFilter(filter as Filter);

    return this.translateNode(filter);
  }

  private translateNode(node: Filter | FieldCondition, currentPath: string = ''): any {
    // Handle primitive values and arrays
    if (this.isRegex(node)) {
      throw new Error('Regex is not supported in Chroma');
    }
    if (this.isPrimitive(node)) return this.normalizeComparisonValue(node);
    if (Array.isArray(node)) return { $in: this.normalizeArrayValues(node) };

    const entries = Object.entries(node as Record<string, any>);
    const firstEntry = entries[0];
    // Handle single operator case
    if (entries.length === 1 && firstEntry && this.isOperator(firstEntry[0])) {
      const [operator, value] = firstEntry;
      const translated = this.translateOperator(operator, value);
      return this.isLogicalOperator(operator) ? { [operator]: translated } : translated;
    }

    // Process each entry
    const result: Record<string, any> = {};
    const multiOperatorConditions: any[] = [];

    for (const [key, value] of entries) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;

      if (this.isOperator(key)) {
        result[key] = this.translateOperator(key, value);
        continue;
      }

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Check for multiple operators on same field
        const valueEntries = Object.entries(value);
        if (valueEntries.every(([op]) => this.isOperator(op)) && valueEntries.length > 1) {
          valueEntries.forEach(([op, opValue]) => {
            multiOperatorConditions.push({
              [newPath]: { [op]: this.normalizeComparisonValue(opValue) },
            });
          });
          continue;
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

    // If we have multiple operators, return them combined with $and
    if (multiOperatorConditions.length > 0) {
      return { $and: multiOperatorConditions };
    }

    // Wrap in $and if there are multiple top-level fields
    if (Object.keys(result).length > 1 && !currentPath) {
      return {
        $and: Object.entries(result).map(([key, value]) => ({ [key]: value })),
      };
    }

    return result;
  }

  private translateOperator(operator: QueryOperator, value: any): any {
    // Handle logical operators
    if (this.isLogicalOperator(operator)) {
      return Array.isArray(value) ? value.map(item => this.translateNode(item)) : this.translateNode(value);
    }

    // Handle comparison and element operators
    return this.normalizeComparisonValue(value);
  }
}
