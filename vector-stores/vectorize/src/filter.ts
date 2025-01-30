import { BaseFilterTranslator, Filter, FieldCondition, ArrayOperator } from '@mastra/core';

export class VectorizeFilterTranslator extends BaseFilterTranslator {
  protected override supportedArrayOperators: ArrayOperator[] = ['$in', '$nin'];
  protected override supportedLogicalOperators = [];
  protected override supportedElementOperators = [];
  protected override supportedRegexOperators = [];

  translate(filter: Filter): Filter {
    if (this.isEmpty(filter)) return filter;
    this.validateFilter(filter);
    return this.translateNode(filter);
  }

  private translateNode(node: Filter | FieldCondition, currentPath: string = ''): any {
    if (this.isPrimitive(node)) return { $eq: this.normalizeComparisonValue(node) };
    if (Array.isArray(node)) return { $in: this.normalizeArrayValues(node) };

    const entries = Object.entries(node as Record<string, any>);
    const firstEntry = entries[0];

    // Handle single operator case
    if (entries.length === 1 && firstEntry && this.isOperator(firstEntry[0])) {
      const [operator, value] = firstEntry;
      return { [operator]: this.normalizeComparisonValue(value) };
    }

    // Process each entry
    const result: Record<string, any> = {};
    for (const [key, value] of entries) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;

      if (this.isOperator(key)) {
        result[key] = this.normalizeComparisonValue(value);
        continue;
      }

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        if (Object.keys(value).length === 0) {
          result[newPath] = {};
          continue;
        }

        // Check if the nested object contains operators
        const hasOperators = Object.keys(value).some(k => this.isOperator(k));
        if (hasOperators) {
          result[newPath] = this.translateNode(value);
        } else {
          // For objects without operators, flatten them
          Object.assign(result, this.translateNode(value, newPath));
        }
      } else {
        result[newPath] = this.translateNode(value);
      }
    }

    return result;
  }
}
