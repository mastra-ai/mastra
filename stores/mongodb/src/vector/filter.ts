import { BaseFilterTranslator } from '@mastra/core/vector/filter';
import type {
  VectorFilter,
  OperatorSupport,
  QueryOperator,
  OperatorValueMap,
  LogicalOperatorValueMap,
  BlacklistedRootOperators,
  VectorFieldValue,
} from '@mastra/core/vector/filter';

type MongoDBOperatorValueMap = Omit<OperatorValueMap, '$options'> & {
  $size: number;
};
type MongoDBBlacklisted = BlacklistedRootOperators | '$size';

export type MongoDBVectorFilter = VectorFilter<
  keyof MongoDBOperatorValueMap,
  MongoDBOperatorValueMap,
  LogicalOperatorValueMap,
  MongoDBBlacklisted,
  VectorFieldValue | RegExp
>;

/**
 * Translator for MongoDB filter queries.
 * Maintains MongoDB-compatible syntax while ensuring proper validation
 * and normalization of values.
 */
export class MongoDBFilterTranslator extends BaseFilterTranslator<MongoDBVectorFilter> {
  protected override getSupportedOperators(): OperatorSupport {
    return {
      ...BaseFilterTranslator.DEFAULT_OPERATORS,
      regex: ['$regex'],
      custom: ['$size'],
    };
  }

  translate(filter?: MongoDBVectorFilter): any {
    if (this.isEmpty(filter)) return filter;
    this.validateFilter(filter);

    return this.translateNode(filter);
  }

  private translateNode(node: MongoDBVectorFilter): any {
    // Handle primitive values and arrays
    if (this.isRegex(node)) {
      return node; // Return regex values as-is
    }
    if (this.isPrimitive(node)) return node;
    if (Array.isArray(node)) return node;

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
    // Handle logical operators
    if (this.isLogicalOperator(operator)) {
      if (operator === '$not') {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          throw new Error('$not operator requires an object');
        }
        if (this.isEmpty(value)) {
          throw new Error('$not operator cannot be empty');
        }
        return this.translateNode(value);
      } else {
        if (!Array.isArray(value)) {
          throw new Error(`Value for logical operator ${operator} must be an array`);
        }
        return value.map(item => this.translateNode(item));
      }
    }

    // Handle basic and numeric operators
    if (this.isBasicOperator(operator) || this.isNumericOperator(operator)) {
      // Convert Date to ISO string
      if (value instanceof Date) {
        return value.toISOString();
      }
      return this.normalizeComparisonValue(value);
    }

    // Handle $elemMatch operator - place this before array operators check
    if (operator === '$elemMatch') {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error(`Value for $elemMatch operator must be an object`);
      }
      return this.translateNode(value);
    }

    // Handle array operators
    if (this.isArrayOperator(operator)) {
      if (!Array.isArray(value)) {
        throw new Error(`Value for array operator ${operator} must be an array`);
      }
      return this.normalizeArrayValues(value);
    }

    // Handle element operators
    if (this.isElementOperator(operator)) {
      if (operator === '$exists' && typeof value !== 'boolean') {
        throw new Error(`Value for $exists operator must be a boolean`);
      }
      return value;
    }

    // Handle regex operators
    if (this.isRegexOperator(operator)) {
      if (!(value instanceof RegExp) && typeof value !== 'string') {
        throw new Error(`Value for ${operator} operator must be a RegExp or string`);
      }
      return value;
    }

    // Handle $size operator
    if (operator === '$size') {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        throw new Error(`Value for $size operator must be a non-negative integer`);
      }
      return value;
    }

    // If we get here, the operator is not supported
    throw new Error(`Unsupported operator: ${operator}`);
  }

  isEmpty(filter: any): boolean {
    return filter === undefined || filter === null || (typeof filter === 'object' && Object.keys(filter).length === 0);
  }
}
