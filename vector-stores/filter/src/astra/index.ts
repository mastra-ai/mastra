import { BaseFilterTranslator, Filter, FieldCondition, QueryOperator } from '../filter-translator';

/**
 * Translator for Astra DB filter queries.
 * Maintains MongoDB-compatible syntax while ensuring proper validation
 * and normalization of values.
 */
export class AstraFilterTranslator extends BaseFilterTranslator {
  /**
   * Translates a MongoDB-style filter to Astra-compatible format.
   * Since Astra supports MongoDB syntax, this mainly handles validation
   * and normalization.
   */
  translate(filter: Filter): Filter {
    if (filter === null || filter === undefined) {
      return {};
    }

    return this.translateNode(filter);
  }

  /**
   * Validates if all operators in the filter are supported by Astra.
   */
  isSupportedFilter(filter: Filter): boolean {
    return this.validateFilterSupport(filter).supported;
  }

  /**
   * Validates if a filter is supported and returns detailed information.
   * @returns Object containing support status and any validation messages
   */
  protected validateFilterSupport(node: Filter | FieldCondition): {
    supported: boolean;
    messages: string[];
  } {
    const messages: string[] = [];

    // Handle primitives and empty values
    if (this.isPrimitive(node) || this.isEmpty(node)) {
      return { supported: true, messages: [] };
    }

    // Handle arrays
    if (Array.isArray(node)) {
      const arrayResults = node.map(item => this.validateFilterSupport(item));
      const arrayMessages = arrayResults.flatMap(r => r.messages);
      return {
        supported: arrayResults.every(r => r.supported),
        messages: arrayMessages,
      };
    }

    // Process object entries
    const nodeObj = node as Record<string, any>;
    let isSupported = true;

    for (const [key, value] of Object.entries(nodeObj)) {
      // Check if the key is an operator
      if (this.isOperator(key)) {
        if (!this.isValidOperator(key)) {
          isSupported = false;
          messages.push(`Unsupported operator: ${key}`);
          continue;
        }

        // Validate operator value
        try {
          this.validateOperatorValue(key as QueryOperator, value);
        } catch (error: any) {
          isSupported = false;
          messages.push(error.message);
        }
      }

      // Recursively validate nested value
      const nestedValidation = this.validateFilterSupport(value);
      if (!nestedValidation.supported) {
        isSupported = false;
        messages.push(...nestedValidation.messages);
      }
    }

    return { supported: isSupported, messages };
  }

  /**
   * Checks if an operator is valid for Astra
   */
  private isValidOperator(key: string): boolean {
    return (
      this.isLogicalOperator(key) ||
      this.isComparisonOperator(key) ||
      this.isArrayOperator(key) ||
      this.isElementOperator(key)
    );
  }

  private translateNode(node: Filter | FieldCondition): any {
    // Handle primitive values (direct equality)
    if (this.isPrimitive(node)) {
      return node;
    }

    // Handle empty object
    if (this.isEmpty(node)) {
      return {};
    }

    // Handle array values (direct equality array match)
    if (Array.isArray(node)) {
      return node;
    }

    const nodeObj = node as Record<string, any>;
    const entries = Object.entries(nodeObj);
    const translatedEntries = entries.map(([key, value]) => {
      // Handle operators
      if (this.isOperator(key)) {
        this.validateOperatorValue(key as QueryOperator, value);
        return [key, this.translateOperatorValue(key as QueryOperator, value)];
      }

      // Handle nested paths and objects
      return [key, this.translateNode(value)];
    });

    return Object.fromEntries(translatedEntries);
  }

  private validateNode(node: Filter | FieldCondition): void {
    if (this.isPrimitive(node) || this.isEmpty(node)) {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(item => this.validateNode(item));
      return;
    }

    const nodeObj = node as Record<string, any>;
    Object.entries(nodeObj).forEach(([key, value]) => {
      if (this.isOperator(key)) {
        this.validateOperatorValue(key as QueryOperator, value);
        if (Array.isArray(value)) {
          value.forEach(item => this.validateNode(item));
        } else if (typeof value === 'object' && value !== null) {
          this.validateNode(value);
        }
      } else {
        this.validateNode(value);
      }
    });
  }

  private translateOperatorValue(operator: QueryOperator, value: any): any {
    // Handle special cases for operator values
    switch (operator) {
      case '$all':
        return Array.isArray(value) ? value.map(v => this.normalizeComparisonValue(v)) : value;

      case '$elemMatch':
        return this.translateNode(value);

      case '$exists':
        return Boolean(value);

      case '$in':
      case '$nin':
        return Array.isArray(value)
          ? value.map(v => this.normalizeComparisonValue(v))
          : [this.normalizeComparisonValue(value)];

      default:
        if (this.isComparisonOperator(operator)) {
          return this.normalizeComparisonValue(value);
        }
        return this.translateNode(value);
    }
  }

  private isPrimitive(value: any): boolean {
    return (
      value === null ||
      value === undefined ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    );
  }

  private isEmpty(obj: any): boolean {
    return obj === null || obj === undefined || (typeof obj === 'object' && Object.keys(obj).length === 0);
  }
}
