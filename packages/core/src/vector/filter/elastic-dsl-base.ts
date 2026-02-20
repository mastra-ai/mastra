import type { QueryOperator, VectorFilter } from './base';
import { BaseFilterTranslator } from './base';

/**
 * Abstract base class for Elastic DSL filter translators (ElasticSearch & OpenSearch).
 *
 * Implements the shared filter-translation logic that is identical across both
 * engines: node traversal, field operators, nested objects, keyword suffixes,
 * range-query optimisation, and the `$not` special cases.
 *
 * Subclasses must provide engine-specific behaviour via two template methods:
 *   - `translateLogicalOperator`  (e.g. `$nor` support, `minimum_should_match`)
 *   - `translateRegexOperator`    (wildcard escaping, newline handling, query shape)
 */
export abstract class ElasticDSLFilterTranslator<Filter = VectorFilter> extends BaseFilterTranslator<Filter> {
  // ── public entry point ────────────────────────────────────────────

  translate(filter?: Filter): any {
    if (this.isEmpty(filter)) return undefined;
    // After isEmpty check, filter is guaranteed non-empty.
    // Cast needed because the generic Filter may not statically include undefined.
    const f = filter as Filter;
    this.validateFilter(f);
    return this.translateNode(f);
  }

  // ── template methods (subclass-provided) ──────────────────────────

  protected abstract translateLogicalOperator(operator: QueryOperator, value: any): any;
  protected abstract translateRegexOperator(field: string, value: any): any;

  // ── shared concrete methods ───────────────────────────────────────

  protected translateNode(node: Filter): any {
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

  protected translateNestedObject(field: string, value: Record<string, any>): any {
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

  protected translateFieldOperator(field: string, operator: QueryOperator, value: any): any {
    // Handle basic comparison operators
    if (this.isBasicOperator(operator)) {
      const normalizedValue = this.normalizeComparisonValue(value);
      const fieldWithKeyword = this.addKeywordIfNeeded(field, value);
      switch (operator) {
        case '$eq':
          // Handle null equality: field does not exist or is null
          if (value === null) {
            return {
              bool: {
                must_not: [{ exists: { field } }],
              },
            };
          }
          return { term: { [fieldWithKeyword]: normalizedValue } };
        case '$ne':
          // Handle null inequality: field exists (i.e., is not null)
          if (value === null) {
            return { exists: { field } };
          }
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

  protected escapeWildcardMetacharacters(pattern: string): string {
    // First escape backslashes to avoid ambiguous encoding sequences
    // Then escape * and ? which are wildcard metacharacters
    return pattern.replace(/\\/g, '\\\\').replace(/\*/g, '\\*').replace(/\?/g, '\\?');
  }

  protected addKeywordIfNeeded(field: string, value: any): string {
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

  protected handleNotOperatorSpecialCases(value: any, field: string): any | null {
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

  protected translateOperator(operator: QueryOperator, value: any, field?: string): any {
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

  protected translateFieldConditions(field: string, conditions: Record<string, any>): any {
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

  protected canOptimizeToRangeQuery(conditions: Record<string, any>): boolean {
    return Object.keys(conditions).every(op => this.isNumericOperator(op)) && Object.keys(conditions).length > 0;
  }

  protected createRangeQuery(field: string, conditions: Record<string, any>): any {
    const rangeParams = Object.fromEntries(
      Object.entries(conditions).map(([op, val]) => [op.replace('$', ''), this.normalizeComparisonValue(val)]),
    );

    return { range: { [field]: rangeParams } };
  }
}
