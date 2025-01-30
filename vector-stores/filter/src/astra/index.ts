import { BaseFilterTranslator, Filter, FieldCondition, QueryOperator } from '../filter-translator';

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
    this.validateFilter(filter);

    if (filter === null || filter === undefined) {
      return {};
    }

    return this.translateNode(filter);
  }

  private translateNode(node: Filter | FieldCondition): any {
    // Handle primitive values and arrays
    if (this.isPrimitive(node) || Array.isArray(node)) {
      return node;
    }

    // Handle empty object
    if (this.isEmpty(node)) {
      return {};
    }

    const nodeObj = node as Record<string, any>;
    const entries = Object.entries(nodeObj);
    const translatedEntries = entries.map(([key, value]) => {
      // Handle operators
      if (this.isOperator(key)) {
        this.validateOperatorValue(key as QueryOperator, value);
        return [key, this.translateOperatorValue(key as QueryOperator, value)];
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
