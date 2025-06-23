import type {
  BlacklistedRootOperators,
  LogicalOperatorValueMap,
  OperatorSupport,
  OperatorValueMap,
  QueryOperator,
  VectorFilter,
} from '@mastra/core/vector/filter';
import { BaseFilterTranslator } from '@mastra/core/vector/filter';

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
export class OpenSearchFilterTranslator extends BaseFilterTranslator<OpenSearchVectorFilter> {
  protected override getSupportedOperators(): OperatorSupport {
    return {
      ...BaseFilterTranslator.DEFAULT_OPERATORS,
      logical: ['$and', '$or', '$not'],
      array: ['$in', '$nin', '$all'],
      regex: ['$regex'],
      custom: [],
    };
  }

  translate(filter?: OpenSearchVectorFilter): OpenSearchVectorFilter {
    if (this.isEmpty(filter)) return undefined;
    this.validateFilter(filter);
    return this.translateNode(filter);
  }

  private translateNode(node: OpenSearchVectorFilter): any {
    // Handle primitive values and arrays
    if (this.isPrimitive(node) || Array.isArray(node)) {
      return node;
    }

    const entries = Object.entries(node as Record<string, any>);

    // Extract logical operators and field conditions
    const logicalOperators: [string, any][] = [];
    const fieldConditions: [string, any][] = [];

    entries.forEach(([key, value]) => {
      if (this.isLogicalOperator(key)) {
        logicalOperators.push([key, value]);
      } else {
        fieldConditions.push([key, value]);
      }
    });

    // If we have a single logical operator
    if (logicalOperators.length === 1 && fieldConditions.length === 0) {
      const [operator, value] = logicalOperators[0] as [QueryOperator, any];
      if (!Array.isArray(value) && typeof value !== 'object') {
        throw new Error(`Invalid logical operator structure: ${operator} must have an array or object value`);
      }
      return this.translateLogicalOperator(operator, value);
    }

    // Process field conditions
    const fieldConditionQueries = fieldConditions.map(([key, value]) => {
      // Handle nested objects
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Check if the object contains operators
        const hasOperators = Object.keys(value).some(k => this.isOperator(k));

        // Use a more direct approach based on whether operators are present
        const nestedField = `metadata.${key}`;
        return hasOperators
          ? this.translateFieldConditions(nestedField, value)
          : this.translateNestedObject(nestedField, value);
      }

      // Handle arrays
      if (Array.isArray(value)) {
        const fieldWithKeyword = this.addKeywordIfNeeded(`metadata.${key}`, value);
        return { terms: { [fieldWithKeyword]: value } };
      }

      // Handle simple field equality
      const fieldWithKeyword = this.addKeywordIfNeeded(`metadata.${key}`, value);
      return { term: { [fieldWithKeyword]: value } };
    });

    // Handle case with both logical operators and field conditions or multiple logical operators
    if (logicalOperators.length > 0) {
      const logicalConditions = logicalOperators.map(([operator, value]) =>
        this.translateOperator(operator as QueryOperator, value),
      );

      return {
        bool: {
          must: [...logicalConditions, ...fieldConditionQueries],
        },
      };
    }

    // If we only have field conditions
    if (fieldConditionQueries.length > 1) {
      return {
        bool: {
          must: fieldConditionQueries,
        },
      };
    }

    // If we have only one field condition
    if (fieldConditionQueries.length === 1) {
      return fieldConditionQueries[0];
    }

    // If we have no conditions (e.g., only empty $and arrays)
    return { match_all: {} };
  }

  /**
   * Handles translation of nested objects with dot notation fields
   */
  private translateNestedObject(field: string, value: Record<string, any>): any {
    const conditions = Object.entries(value).map(([subField, subValue]) => {
      const fullField = `${field}.${subField}`;

      // Check if this is an operator in a nested field
      if (this.isOperator(subField)) {
        return this.translateOperator(subField as QueryOperator, subValue, field);
      }

      if (typeof subValue === 'object' && subValue !== null && !Array.isArray(subValue)) {
        // Check if the nested object contains operators
        const hasOperators = Object.keys(subValue).some(k => this.isOperator(k));
        if (hasOperators) {
          return this.translateFieldConditions(fullField, subValue);
        }
        return this.translateNestedObject(fullField, subValue);
      }
      const fieldWithKeyword = this.addKeywordIfNeeded(fullField, subValue);
      return { term: { [fieldWithKeyword]: subValue } };
    });

    return {
      bool: {
        must: conditions,
      },
    };
  }

  private translateLogicalOperator(operator: QueryOperator, value: any): any {
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

  private translateFieldOperator(field: string, operator: QueryOperator, value: any): any {
    // Handle basic comparison operators
    if (this.isBasicOperator(operator)) {
      const normalizedValue = this.normalizeComparisonValue(value);
      const fieldWithKeyword = this.addKeywordIfNeeded(field, value);
      switch (operator) {
        case '$eq':
          return { term: { [fieldWithKeyword]: normalizedValue } };
        case '$ne':
          return {
            bool: {
              must_not: [{ term: { [fieldWithKeyword]: normalizedValue } }],
            },
          };
        default:
          return { term: { [fieldWithKeyword]: normalizedValue } };
      }
    }

    // Handle numeric operators
    if (this.isNumericOperator(operator)) {
      const normalizedValue = this.normalizeComparisonValue(value);
      const rangeOp = operator.replace('$', '');
      return { range: { [field]: { [rangeOp]: normalizedValue } } };
    }

    // Handle array operators
    if (this.isArrayOperator(operator)) {
      if (!Array.isArray(value)) {
        throw new Error(`Invalid array operator value: ${operator} requires an array value`);
      }
      const normalizedValues = this.normalizeArrayValues(value);
      const fieldWithKeyword = this.addKeywordIfNeeded(field, value);
      switch (operator) {
        case '$in':
          return { terms: { [fieldWithKeyword]: normalizedValues } };
        case '$nin':
          // For empty arrays, return a query that matches everything
          if (normalizedValues.length === 0) {
            return { match_all: {} };
          }
          return {
            bool: {
              must_not: [{ terms: { [fieldWithKeyword]: normalizedValues } }],
            },
          };
        case '$all':
          // For empty arrays, return a query that will match nothing
          if (normalizedValues.length === 0) {
            return {
              bool: {
                must_not: [{ match_all: {} }],
              },
            };
          }
          return {
            bool: {
              must: normalizedValues.map(v => ({ term: { [fieldWithKeyword]: v } })),
            },
          };
        default:
          return { terms: { [fieldWithKeyword]: normalizedValues } };
      }
    }

    // Handle element operators
    if (this.isElementOperator(operator)) {
      switch (operator) {
        case '$exists':
          return value ? { exists: { field } } : { bool: { must_not: [{ exists: { field } }] } };
        default:
          return { exists: { field } };
      }
    }

    // Handle regex operators
    if (this.isRegexOperator(operator)) {
      return this.translateRegexOperator(field, value);
    }

    const fieldWithKeyword = this.addKeywordIfNeeded(field, value);
    return { term: { [fieldWithKeyword]: value } };
  }

  /**
   * Translates regex patterns to OpenSearch query syntax
   */
  private translateRegexOperator(field: string, value: any): any {
    // Convert value to string if it's not already
    const regexValue = typeof value === 'string' ? value : value.toString();

    // Check for problematic patterns (like newlines, etc.)
    if (regexValue.includes('\n') || regexValue.includes('\r')) {
      // For patterns with newlines, use a simpler approach
      // OpenSearch doesn't support dotall flag like JavaScript
      return { match: { [field]: value } };
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

      // Create wildcard pattern
      let wildcardPattern = processedRegex;
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

  private addKeywordIfNeeded(field: string, value: any): string {
    // Add .keyword suffix for string fields
    if (typeof value === 'string') {
      return `${field}.keyword`;
    }
    // Add .keyword suffix for string array fields
    if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
      return `${field}.keyword`;
    }
    return field;
  }

  /**
   * Helper method to handle special cases for the $not operator
   */
  private handleNotOperatorSpecialCases(value: any, field: string): any | null {
    // For "not null", we need to use exists query
    if (value === null) {
      return { exists: { field } };
    }

    if (typeof value === 'object' && value !== null) {
      // For "not {$eq: null}", we need to use exists query
      if ('$eq' in value && value.$eq === null) {
        return { exists: { field } };
      }

      // For "not {$ne: null}", we need to use must_not exists query
      if ('$ne' in value && value.$ne === null) {
        return {
          bool: {
            must_not: [{ exists: { field } }],
          },
        };
      }
    }

    return null; // No special case applies
  }

  private translateOperator(operator: QueryOperator, value: any, field?: string): any {
    // Check if this is a valid operator
    if (!this.isOperator(operator)) {
      throw new Error(`Unsupported operator: ${operator}`);
    }

    // Special case for $not with null or $eq: null
    if (operator === '$not' && field) {
      const specialCaseResult = this.handleNotOperatorSpecialCases(value, field);
      if (specialCaseResult) {
        return specialCaseResult;
      }
    }

    // Handle logical operators
    if (this.isLogicalOperator(operator)) {
      // For $not operator with field context and nested operators, handle specially
      if (operator === '$not' && field && typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const entries = Object.entries(value);

        // Handle multiple operators in $not
        if (entries.length > 0) {
          // If all entries are operators, handle them as a single condition
          if (entries.every(([op]) => this.isOperator(op))) {
            const translatedCondition = this.translateFieldConditions(field, value);
            return {
              bool: {
                must_not: [translatedCondition],
              },
            };
          }

          // Handle single nested operator
          if (entries.length === 1 && entries[0] && this.isOperator(entries[0][0])) {
            const [nestedOp, nestedVal] = entries[0] as [QueryOperator, any];
            const translatedNested = this.translateFieldOperator(field, nestedOp, nestedVal);
            return {
              bool: {
                must_not: [translatedNested],
              },
            };
          }
        }
      }
      return this.translateLogicalOperator(operator, value);
    }

    // If a field is provided, use translateFieldOperator for more specific translation
    if (field) {
      return this.translateFieldOperator(field, operator, value);
    }

    // For non-logical operators without a field context, just return the value
    // The actual translation happens in translateFieldConditions where we have the field context
    return value;
  }

  /**
   * Translates field conditions to OpenSearch query syntax
   * Handles special cases like range queries and multiple operators
   */
  private translateFieldConditions(field: string, conditions: Record<string, any>): any {
    // Special case: Optimize multiple numeric operators into a single range query
    if (this.canOptimizeToRangeQuery(conditions)) {
      return this.createRangeQuery(field, conditions);
    }

    // Handle all other operators consistently
    const queryConditions: any[] = [];
    Object.entries(conditions).forEach(([operator, value]) => {
      if (this.isOperator(operator)) {
        queryConditions.push(this.translateOperator(operator as QueryOperator, value, field));
      } else {
        // Handle non-operator keys (should not happen in normal usage)
        const fieldWithKeyword = this.addKeywordIfNeeded(`${field}.${operator}`, value);
        queryConditions.push({ term: { [fieldWithKeyword]: value } });
      }
    });

    // Return single condition without wrapping
    if (queryConditions.length === 1) {
      return queryConditions[0];
    }

    // Combine multiple conditions with AND logic
    return {
      bool: {
        must: queryConditions,
      },
    };
  }

  /**
   * Checks if conditions can be optimized to a range query
   */
  private canOptimizeToRangeQuery(conditions: Record<string, any>): boolean {
    return Object.keys(conditions).every(op => this.isNumericOperator(op)) && Object.keys(conditions).length > 0;
  }

  /**
   * Creates a range query from numeric operators
   */
  private createRangeQuery(field: string, conditions: Record<string, any>): any {
    const rangeParams = Object.fromEntries(
      Object.entries(conditions).map(([op, val]) => [op.replace('$', ''), this.normalizeComparisonValue(val)]),
    );

    return { range: { [field]: rangeParams } };
  }
}
