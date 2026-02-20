import type {
  BlacklistedRootOperators,
  LogicalOperatorValueMap,
  OperatorSupport,
  OperatorValueMap,
  QueryOperator,
  VectorFilter,
} from '@mastra/core/vector/filter';
import { BaseFilterTranslator, ElasticDSLFilterTranslator } from '@mastra/core/vector/filter';

type OpenSearchOperatorValueMap = Omit<OperatorValueMap, '$options' | '$nor' | '$elemMatch'>;

type OpenSearchLogicalOperatorValueMap = Omit<LogicalOperatorValueMap, '$nor'>;

type OpenSearchBlacklisted = BlacklistedRootOperators | '$nor';

export type OpenSearchVectorFilter = VectorFilter<
  keyof OpenSearchOperatorValueMap,
  OpenSearchOperatorValueMap,
  OpenSearchLogicalOperatorValueMap,
  OpenSearchBlacklisted
>;
/**
 * Translator for OpenSearch filter queries.
 * Maintains OpenSearch-compatible syntax while ensuring proper validation
 * and normalization of values.
 */
export class OpenSearchFilterTranslator extends ElasticDSLFilterTranslator<OpenSearchVectorFilter> {
  protected override getSupportedOperators(): OperatorSupport {
    return {
      ...BaseFilterTranslator.DEFAULT_OPERATORS,
      logical: ['$and', '$or', '$not'],
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
          },
        };
      case '$not':
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
   * Translates regex patterns to OpenSearch query syntax
   */
  protected translateRegexOperator(field: string, value: any): any {
    // Convert value to string if it's not already
    const regexValue = typeof value === 'string' ? value : value.toString();

    // Check for problematic patterns (like newlines, etc.)
    if (regexValue.includes('\n') || regexValue.includes('\r')) {
      // For patterns with newlines, use a simpler approach
      // OpenSearch doesn't support dotall flag like JavaScript
      return { match: { [field]: regexValue } };
    }

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

      return { wildcard: { [field]: wildcardPattern } };
    }

    // Use regexp for other regex patterns
    // Escape any backslashes to prevent OpenSearch from misinterpreting them
    const escapedRegex = regexValue.replace(/\\/g, '\\\\');
    return { regexp: { [field]: escapedRegex } };
  }
}
