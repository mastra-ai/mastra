import { BaseFilterTranslator, FieldCondition, Filter, QueryOperator } from '@mastra/core';

/**
 * Translator for Pinecone/Vectorize filter queries.
 * Handles conversion to Pinecone's stricter MongoDB-like syntax.
 */
export class PineconeFilterTranslator extends BaseFilterTranslator {
  translate(filter: Filter): Filter {
    this.validateFilter(filter);

    if (filter === null || filter === undefined) {
      return {};
    }

    console.log(filter);
    // If multiple top-level fields, wrap in $and
    const translated = this.translateNode(filter);
    console.log('translated', translated);
    const entries = Object.entries(translated);
    console.log('entries', entries);
    if (entries.length > 1 && !this.isOperator(entries[0]?.[0] as string)) {
      return {
        $and: entries.map(([key, value]) => ({ [key]: value })),
      };
    }

    return translated;
  }

  private translateNode(node: Filter | FieldCondition, currentPath: string = ''): any {
    console.log(node);
    // Handle empty objects
    if (this.isEmpty(node)) {
      return {};
    }

    // Handle primitive values by converting to explicit $eq
    if (this.isPrimitive(node)) {
      return { $eq: this.normalizeComparisonValue(node) };
    }

    // Handle arrays by converting to $in
    if (Array.isArray(node)) {
      return { $in: this.normalizeArrayValues(node) };
    }

    const nodeObj = node as Record<string, any>;
    const entries = Object.entries(nodeObj);

    // Handle a single operator at the root level
    const firstEntry = entries[0];
    if (entries.length === 1 && firstEntry && this.isOperator(firstEntry[0])) {
      const [operator, value] = firstEntry;
      return this.translateOperatorValue(operator as QueryOperator, value, currentPath);
    }

    // Special handling for top-level entries
    const translatedEntries = entries.map(([key, value]) => {
      const newPath = currentPath ? `${currentPath}.${key}` : key;

      if (this.isOperator(key)) {
        return [key, this.translateOperatorValue(key as QueryOperator, value, currentPath)];
      }

      // Non-operator keys with primitive values need explicit $eq
      if (this.isPrimitive(value)) {
        return [key, { $eq: this.normalizeComparisonValue(value) }];
      }

      // Non-operator keys with object values need to be flattened
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const hasOperators = Object.keys(value).some(k => this.isOperator(k));
        if (!hasOperators) {
          return Object.entries(this.flattenObject(newPath, value));
        }
      }

      return [key, this.translateNode(value)];
    });

    // Flatten any nested entries that were created
    const flattenedEntries = translatedEntries.flatMap(entry =>
      Array.isArray(entry) ? [entry] : Object.entries(entry),
    );

    return Object.fromEntries(flattenedEntries);
  }

  private translateOperatorValue(operator: QueryOperator, value: any, currentPath: string): any {
    switch (operator) {
      case '$and':
      case '$or':
      case '$nor':
        if (!Array.isArray(value)) {
          throw new Error(BaseFilterTranslator.ErrorMessages.ARRAY_REQUIRED(operator));
        }
        return value.map(item => this.translateNode(item));

      case '$not':
        return this.translateNode(value);

      case '$all':
        // Simulate $all using $and + $in for Pinecone
        if (!Array.isArray(value)) {
          throw new Error(BaseFilterTranslator.ErrorMessages.ARRAY_REQUIRED(operator));
        }
        return this.translateNode(this.simulateAllOperator(currentPath, value));

      case '$elemMatch':
        // Pinecone doesn't support $elemMatch, but we can try to handle simple cases
        throw new Error('$elemMatch operator is not supported in Pinecone');

      default:
        if (this.isComparisonOperator(operator)) {
          return this.normalizeComparisonValue(value);
        }
    }

    return value;
  }

  /**
   * Flattens nested objects using dot notation
   * e.g., { user: { age: 25 } } becomes { "user.age": 25 }
   */
  private flattenObject(prefix: string, obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !this.isOperator(Object.keys(value)[0] as string)
      ) {
        Object.assign(result, this.flattenObject(newKey, value));
      } else {
        result[newKey] = this.translateNode(value);
      }
    }

    return result;
  }

  protected isValidOperator(key: string): boolean {
    // Pinecone doesn't support $elemMatch
    if (key === '$elemMatch') {
      return false;
    }
    return super.isValidOperator(key);
  }
}
