import type {
  BlacklistedRootOperators,
  LogicalOperatorValueMap,
  OperatorSupport,
  OperatorValueMap,
  QueryOperator,
  VectorFilter,
} from '@mastra/core/vector/filter';
import { BaseFilterTranslator, ElasticDSLFilterTranslator } from '@mastra/core/vector/filter';

type ElasticSearchOperatorValueMap = Omit<OperatorValueMap, '$options' | '$nor' | '$elemMatch'>;

type ElasticSearchLogicalOperatorValueMap = Omit<LogicalOperatorValueMap, '$nor'>;

type ElasticSearchBlacklisted = BlacklistedRootOperators | '$nor';

export type ElasticSearchVectorFilter = VectorFilter<
  keyof ElasticSearchOperatorValueMap,
  ElasticSearchOperatorValueMap,
  ElasticSearchLogicalOperatorValueMap,
  ElasticSearchBlacklisted
>;

/**
 * Translator for ElasticSearch filter queries.
 * Maintains ElasticSearch-compatible syntax while ensuring proper validation
 * and normalization of values.
 */
export class ElasticSearchFilterTranslator extends ElasticDSLFilterTranslator<ElasticSearchVectorFilter> {
  protected override getSupportedOperators(): OperatorSupport {
    return {
      ...BaseFilterTranslator.DEFAULT_OPERATORS,
      logical: ['$and', '$or', '$not', '$nor'],
      array: ['$in', '$nin', '$all'],
      regex: ['$regex'],
      custom: [],
    };
  }

  protected translateLogicalOperator(operator: QueryOperator, value: any): any {
    const conditions = Array.isArray(value) ? value.map(item => this.translateNode(item)) : [this.translateNode(value)];
    switch (operator) {
      case '$and':
        // For empty $and, return a query that matches everything
        if (Array.isArray(value) && value.length === 0) {
          return { match_all: {} };
        }
        return {
          bool: {
            must: conditions,
          },
        };
      case '$or':
        // For empty $or, return a query that matches nothing
        if (Array.isArray(value) && value.length === 0) {
          return {
            bool: {
              must_not: [{ match_all: {} }],
            },
          };
        }
        return {
          bool: {
            should: conditions,
            minimum_should_match: 1,
          },
        };
      case '$not':
      case '$nor':
        return {
          bool: {
            must_not: conditions,
          },
        };
      default:
        return value;
    }
  }

  /**
   * Escapes wildcard metacharacters (* and ?) for use in wildcard queries.
   * Existing wildcard metacharacters in the pattern are escaped before
   * adding leading/trailing * to prevent semantic changes.
   * First escapes backslashes to avoid ambiguous encoding sequences.
   */
  private escapeWildcardMetacharacters(pattern: string): string {
    // First escape backslashes to avoid ambiguous encoding sequences
    // Then escape * and ? which are wildcard metacharacters
    return pattern.replace(/\\/g, '\\\\').replace(/\*/g, '\\*').replace(/\?/g, '\\?');
  }

  /**
   * Translates regex patterns to ElasticSearch query syntax
   */
  protected translateRegexOperator(field: string, value: any): any {
    // Convert value to string if it's not already
    const regexValue = typeof value === 'string' ? value : value.toString();

    // Process regex pattern to handle anchors properly
    let processedRegex = regexValue;
    const hasStartAnchor = regexValue.startsWith('^');
    const hasEndAnchor = regexValue.endsWith('$');

    // If we have anchors, use wildcard query for better handling
    if (hasStartAnchor || hasEndAnchor) {
      // Remove anchors
      if (hasStartAnchor) {
        processedRegex = processedRegex.substring(1);
      }
      if (hasEndAnchor) {
        processedRegex = processedRegex.substring(0, processedRegex.length - 1);
      }

      // Escape existing wildcard metacharacters before adding leading/trailing *
      const escapedPattern = this.escapeWildcardMetacharacters(processedRegex);

      // Create wildcard pattern
      let wildcardPattern = escapedPattern;
      if (!hasStartAnchor) {
        wildcardPattern = '*' + wildcardPattern;
      }
      if (!hasEndAnchor) {
        wildcardPattern = wildcardPattern + '*';
      }

      return { wildcard: { [field]: { value: wildcardPattern } } };
    }

    // Use regexp for other regex patterns
    // Pass the original regex pattern through unchanged to preserve regex semantics
    // ElasticSearch regexp queries accept valid regex patterns directly
    return { regexp: { [field]: { value: regexValue } } };
  }
}
