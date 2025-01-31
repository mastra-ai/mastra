import { BaseFilterTranslator, FieldCondition, Filter, QueryOperator } from '@mastra/core';

/**
 * Translator for Astra DB filter queries.
 * Maintains MongoDB-compatible syntax while ensuring proper validation
 * and normalization of values.
 */
export class AstraFilterTranslator extends BaseFilterTranslator {
  /**
   * Translates a MongoDB-style filter to Astra-compatible format.
   * Since Astra supports MongoDB syntax, this mainly handles validation
   * and normalization.
   */
  translate(filter: Filter): Filter {
    if (this.isEmpty(filter)) return filter;
    this.validateFilter(filter);

    return this.translateNode(filter);
  }

  private translateNode(node: Filter | FieldCondition): any {
    // Handle primitive values and arrays
    if (this.isPrimitive(node) || Array.isArray(node) || this.isRegex(node)) {
      return node;
    }

    const entries = Object.entries(node as Record<string, any>);
    const translatedEntries = entries.map(([key, value]) => {
      // Handle operators
      if (this.isOperator(key)) {
        return [key, this.translateOperatorValue(key, value)];
      }

      // Handle nested paths and objects
      return [key, this.translateNode(value)];
    });

    return Object.fromEntries(translatedEntries);
  }

  private translateOperatorValue(operator: QueryOperator, value: any): any {
    if (this.isComparisonOperator(operator)) {
      return this.normalizeComparisonValue(value);
    }

    if (this.isArrayOperator(operator) && Array.isArray(value)) {
      return this.normalizeArrayValues(value);
    }

    return this.translateNode(value);
  }
}
