import type { QueryOperator, VectorFilter } from './base';
import { BaseFilterTranslator } from './base';

/**
 * Abstract base class for Elastic DSL filter translators (ElasticSearch & OpenSearch).
 *
 * Subclasses must provide engine-specific behaviour via two template methods:
 *   - `translateLogicalOperator`  (e.g. `$nor` support, `minimum_should_match`)
 *   - `translateRegexOperator`    (wildcard escaping, newline handling, query shape)
 */
export abstract class ElasticDSLFilterTranslator<Filter = VectorFilter> extends BaseFilterTranslator<Filter> {
  translate(filter?: Filter): any {
    if (this.isEmpty(filter)) return undefined;
    // Cast needed because the generic Filter may not statically include undefined
    const f = filter as Filter;
    this.validateFilter(f);
    return this.translateNode(f);
  }

  protected abstract translateLogicalOperator(operator: QueryOperator, value: any): any;
  protected abstract translateRegexOperator(field: string, value: any): any;

  protected translateNode(node: Filter): any {
    if (this.isPrimitive(node) || Array.isArray(node)) {
      return node;
    }

    const entries = Object.entries(node as Record<string, any>);

    const logicalOperators: [string, any][] = [];
    const fieldConditions: [string, any][] = [];

    entries.forEach(([key, value]) => {
      if (this.isLogicalOperator(key)) {
        logicalOperators.push([key, value]);
      } else {
        fieldConditions.push([key, value]);
      }
    });

    if (logicalOperators.length === 1 && fieldConditions.length === 0) {
      const [operator, value] = logicalOperators[0] as [QueryOperator, any];
      if (!Array.isArray(value) && (value === null || typeof value !== 'object')) {
        throw new Error(`Invalid logical operator structure: ${operator} must have an array or object value`);
      }
      return this.translateLogicalOperator(operator, value);
    }

    const fieldConditionQueries = fieldConditions.map(([key, value]) => {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const hasOperators = Object.keys(value).some(k => this.isOperator(k));
        const nestedField = `metadata.${key}`;
        return hasOperators
          ? this.translateFieldConditions(nestedField, value)
          : this.translateNestedObject(nestedField, value);
      }

      if (Array.isArray(value)) {
        const fieldWithKeyword = this.addKeywordIfNeeded(`metadata.${key}`, value);
        return { terms: { [fieldWithKeyword]: value } };
      }

      const fieldWithKeyword = this.addKeywordIfNeeded(`metadata.${key}`, value);
      return { term: { [fieldWithKeyword]: value } };
    });

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

    if (fieldConditionQueries.length > 1) {
      return {
        bool: {
          must: fieldConditionQueries,
        },
      };
    }

    if (fieldConditionQueries.length === 1) {
      return fieldConditionQueries[0];
    }

    return { match_all: {} };
  }

  protected translateNestedObject(field: string, value: Record<string, any>): any {
    const conditions = Object.entries(value).map(([subField, subValue]) => {
      const fullField = `${field}.${subField}`;

      if (this.isOperator(subField)) {
        return this.translateOperator(subField as QueryOperator, subValue, field);
      }

      if (typeof subValue === 'object' && subValue !== null && !Array.isArray(subValue)) {
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
    if (this.isBasicOperator(operator)) {
      const normalizedValue = this.normalizeComparisonValue(value);
      const fieldWithKeyword = this.addKeywordIfNeeded(field, value);
      switch (operator) {
        case '$eq':
          // null equality → field does not exist
          if (value === null) {
            return {
              bool: {
                must_not: [{ exists: { field } }],
              },
            };
          }
          return { term: { [fieldWithKeyword]: normalizedValue } };
        case '$ne':
          // null inequality → field exists
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

    if (this.isNumericOperator(operator)) {
      const normalizedValue = this.normalizeComparisonValue(value);
      const rangeOp = operator.replace('$', '');
      return { range: { [field]: { [rangeOp]: normalizedValue } } };
    }

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
          if (normalizedValues.length === 0) {
            return { match_all: {} };
          }
          return {
            bool: {
              must_not: [{ terms: { [fieldWithKeyword]: normalizedValues } }],
            },
          };
        case '$all':
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

    if (this.isElementOperator(operator)) {
      switch (operator) {
        case '$exists':
          return value ? { exists: { field } } : { bool: { must_not: [{ exists: { field } }] } };
        default:
          return { exists: { field } };
      }
    }

    if (this.isRegexOperator(operator)) {
      return this.translateRegexOperator(field, value);
    }

    const fieldWithKeyword = this.addKeywordIfNeeded(field, value);
    return { term: { [fieldWithKeyword]: value } };
  }

  protected escapeWildcardMetacharacters(pattern: string): string {
    // Escape backslashes first to avoid ambiguous sequences, then * and ?
    return pattern.replace(/\\/g, '\\\\').replace(/\*/g, '\\*').replace(/\?/g, '\\?');
  }

  protected addKeywordIfNeeded(field: string, value: any): string {
    if (typeof value === 'string') {
      return `${field}.keyword`;
    }
    if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
      return `${field}.keyword`;
    }
    return field;
  }

  protected handleNotOperatorSpecialCases(value: any, field: string): any | null {
    // $not null → exists
    if (value === null) {
      return { exists: { field } };
    }

    if (typeof value === 'object' && value !== null) {
      // $not {$eq: null} → exists
      if ('$eq' in value && value.$eq === null) {
        return { exists: { field } };
      }
      // $not {$ne: null} → must_not exists
      if ('$ne' in value && value.$ne === null) {
        return {
          bool: {
            must_not: [{ exists: { field } }],
          },
        };
      }
    }

    return null;
  }

  protected translateOperator(operator: QueryOperator, value: any, field?: string): any {
    if (!this.isOperator(operator)) {
      throw new Error(`Unsupported operator: ${operator}`);
    }

    if (operator === '$not' && field) {
      const specialCaseResult = this.handleNotOperatorSpecialCases(value, field);
      if (specialCaseResult) {
        return specialCaseResult;
      }
    }

    if (this.isLogicalOperator(operator)) {
      // $not with field context and nested operators → negate the translated condition
      if (operator === '$not' && field && typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const entries = Object.entries(value);

        if (entries.length > 0 && entries.every(([op]) => this.isOperator(op))) {
          const translatedCondition = this.translateFieldConditions(field, value);
          return {
            bool: {
              must_not: [translatedCondition],
            },
          };
        }
      }
      return this.translateLogicalOperator(operator, value);
    }

    if (field) {
      return this.translateFieldOperator(field, operator, value);
    }

    // Non-logical operators without field context are translated in translateFieldConditions
    return value;
  }

  protected translateFieldConditions(field: string, conditions: Record<string, any>): any {
    if (this.canOptimizeToRangeQuery(conditions)) {
      return this.createRangeQuery(field, conditions);
    }

    const queryConditions: any[] = [];
    Object.entries(conditions).forEach(([operator, value]) => {
      if (this.isOperator(operator)) {
        queryConditions.push(this.translateOperator(operator as QueryOperator, value, field));
      } else {
        const fieldWithKeyword = this.addKeywordIfNeeded(`${field}.${operator}`, value);
        queryConditions.push({ term: { [fieldWithKeyword]: value } });
      }
    });

    if (queryConditions.length === 1) {
      return queryConditions[0];
    }

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
