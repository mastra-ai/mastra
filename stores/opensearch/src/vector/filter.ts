import type { FieldCondition, OperatorSupport, QueryOperator, VectorFilter } from '@mastra/core/vector/filter';
import { BaseFilterTranslator } from '@mastra/core/vector/filter';

/**
 * Translator for OpenSearch filter queries.
 * Maintains OpenSearch-compatible syntax while ensuring proper validation
 * and normalization of values.
 */
export class OpenSearchFilterTranslator extends BaseFilterTranslator {
  protected override getSupportedOperators(): OperatorSupport {
    return {
      ...BaseFilterTranslator.DEFAULT_OPERATORS,
      logical: ['$and', '$or', '$not'],
      array: ['$in', '$nin', '$all'],
      element: ['$exists'],
      regex: ['$regex'],
      custom: [],
    };
  }

  translate(filter?: VectorFilter): any {
    if (this.isEmpty(filter)) return filter;
    this.validateFilter(filter);
    return this.translateNode(filter);
  }

  private translateNode(node: VectorFilter | FieldCondition): any {
    // Handle primitive values and arrays
    if (this.isPrimitive(node) || Array.isArray(node)) {
      return node;
    }

    const entries = Object.entries(node as Record<string, any>);

    // Handle logical operators at the top level
    if (entries.length === 1 && entries[0] && this.isLogicalOperator(entries[0][0])) {
      const [operator, value] = entries[0] as [QueryOperator, any];
      if (!Array.isArray(value) && typeof value !== 'object') {
        throw new Error(`Invalid logical operator structure: ${operator} must have an array or object value`);
      }
      return this.translateLogicalOperator(operator, value);
    }

    // Handle field conditions
    const conditions = entries.map(([key, value]) => {
      if (this.isOperator(key)) {
        return this.translateOperator(key, value);
      }

      // Handle nested objects
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const subEntries = Object.entries(value);
        if (subEntries.length === 1 && subEntries[0] && this.isOperator(subEntries[0][0])) {
          const [operator, operatorValue] = subEntries[0] as [QueryOperator, any];
          return this.translateFieldOperator(`metadata.${key}`, operator, operatorValue);
        }
        // Handle nested object without operators
        return this.translateNestedObject(`metadata.${key}`, value);
      }

      // Handle multiple conditions on the same field
      if (typeof value === 'object' && value !== null && Object.keys(value).some(k => this.isOperator(k))) {
        return this.translateFieldConditions(`metadata.${key}`, value);
      }

      // Handle simple field equality
      const fieldWithKeyword = this.addKeywordIfNeeded(`metadata.${key}`, value);
      return { term: { [fieldWithKeyword]: value } };
    });

    // If we have multiple conditions, wrap them in a bool must
    if (conditions.length > 1) {
      return {
        bool: {
          must: conditions,
        },
      };
    }

    return conditions[0];
  }

  private translateNestedObject(field: string, value: Record<string, any>): any {
    const conditions = Object.entries(value).map(([subField, subValue]) => {
      const fullField = `${field}.${subField}`;
      if (typeof subValue === 'object' && subValue !== null && !Array.isArray(subValue)) {
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
        return {
          bool: {
            must: conditions,
          },
        };
      case '$or':
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
    // Handle comparison operators
    if (this.isBasicOperator(operator) || this.isNumericOperator(operator)) {
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
        case '$gt':
        case '$gte':
        case '$lt':
        case '$lte': {
          const rangeOp = operator.replace('$', '');
          return { range: { [field]: { [rangeOp]: normalizedValue } } };
        }
        default:
          return { term: { [fieldWithKeyword]: normalizedValue } };
      }
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
          return {
            bool: {
              must_not: [{ terms: { [fieldWithKeyword]: normalizedValues } }],
            },
          };
        case '$all':
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
      return { regexp: { [field]: value } };
    }

    const fieldWithKeyword = this.addKeywordIfNeeded(field, value);
    return { term: { [fieldWithKeyword]: value } };
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

  private translateOperator(operator: QueryOperator, value: any): any {
    if (this.isLogicalOperator(operator)) {
      return this.translateLogicalOperator(operator, value);
    }
    return value;
  }

  private translateFieldConditions(field: string, conditions: Record<string, any>): any {
    const rangeConditions: any[] = [];
    const otherConditions: any[] = [];

    Object.entries(conditions).forEach(([operator, value]) => {
      if (this.isNumericOperator(operator)) {
        const rangeOp = operator.replace('$', '');
        rangeConditions.push({ range: { [field]: { [rangeOp]: this.normalizeComparisonValue(value) } } });
      } else if (this.isBasicOperator(operator)) {
        const fieldWithKeyword = this.addKeywordIfNeeded(field, value);
        if (operator === '$eq') {
          otherConditions.push({ term: { [fieldWithKeyword]: this.normalizeComparisonValue(value) } });
        } else if (operator === '$ne') {
          otherConditions.push({
            bool: {
              must_not: [{ term: { [fieldWithKeyword]: this.normalizeComparisonValue(value) } }],
            },
          });
        }
      } else {
        otherConditions.push(this.translateFieldOperator(field, operator as QueryOperator, value));
      }
    });

    const allConditions = [...rangeConditions, ...otherConditions];
    if (allConditions.length === 1) {
      return allConditions[0];
    }

    return {
      bool: {
        must: allConditions,
      },
    };
  }
}
