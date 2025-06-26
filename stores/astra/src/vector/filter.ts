import { BaseFilterTranslator } from '@mastra/core/vector/filter';
import type {
  VectorFilter,
  OperatorSupport,
  QueryOperator,
  OperatorValueMap,
  LogicalOperatorValueMap,
  BlacklistedRootOperators,
} from '@mastra/core/vector/filter';

type AstraOperatorValueMap = Omit<OperatorValueMap, '$elemMatch' | '$regex' | '$options'> & {
  $size: number; // Astra-specific
};

type AstraLogicalOperatorValueMap = Omit<LogicalOperatorValueMap, '$nor'>;

type AstraBlacklisted = BlacklistedRootOperators | '$nor' | '$size';

export type AstraVectorFilter = VectorFilter<
  keyof AstraOperatorValueMap,
  AstraOperatorValueMap,
  AstraLogicalOperatorValueMap,
  AstraBlacklisted
>;

/**
 * Translator for Astra DB filter queries.
 * Maintains MongoDB-compatible syntax while ensuring proper validation
 * and normalization of values.
 */
export class AstraFilterTranslator extends BaseFilterTranslator<AstraVectorFilter> {
  protected override getSupportedOperators(): OperatorSupport {
    return {
      ...BaseFilterTranslator.DEFAULT_OPERATORS,
      array: ['$all', '$in', '$nin'],
      logical: ['$and', '$or', '$not'],
      regex: [],
      custom: ['$size'],
    };
  }

  translate(filter?: AstraVectorFilter): AstraVectorFilter {
    if (this.isEmpty(filter)) return filter;
    this.validateFilter(filter);

    return this.translateNode(filter);
  }

  private translateNode(node: AstraVectorFilter): any {
    // Handle primitive values and arrays
    if (this.isRegex(node)) {
      throw new Error('Regex is not supported in Astra DB');
    }
    if (this.isPrimitive(node) || Array.isArray(node)) {
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
    if (this.isBasicOperator(operator) || this.isNumericOperator(operator)) {
      return this.normalizeComparisonValue(value);
    }

    if (this.isArrayOperator(operator) && Array.isArray(value)) {
      return this.normalizeArrayValues(value);
    }

    return this.translateNode(value);
  }
}
