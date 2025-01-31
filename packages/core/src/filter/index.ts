type BasicOperator =
  | '$eq' // Matches values equal to specified value
  | '$ne'; // Matches values not equal

type NumericOperator =
  | '$gt' // Greater than
  | '$gte' // Greater than or equal
  | '$lt' // Less than
  | '$lte'; // Less than or equal

type LogicalOperator =
  | '$and' // Joins query clauses with logical AND
  | '$not' // Inverts the effect of a query expression
  | '$nor' // Joins query clauses with logical NOR
  | '$or'; // Joins query clauses with logical OR

type ArrayOperator =
  | '$all' // Matches arrays containing all elements
  | '$in' // Matches any value in array
  | '$nin' // Matches none of the values in array
  | '$elemMatch'; // Matches documents that contain an array field with at least one element that matches all the specified query criteria

type ElementOperator = '$exists'; // Matches documents that have the specified field

type RegexOperator = '$regex' | '$options'; // Matches documents that have the specified field

// Union of all supported operators
type QueryOperator =
  | BasicOperator
  | NumericOperator
  | LogicalOperator
  | ArrayOperator
  | ElementOperator
  | RegexOperator;

// Type for a field condition using an operator
type OperatorCondition = {
  [K in QueryOperator]?: any;
};

// Type for a field condition that can be either a direct value or use operators
type FieldCondition = OperatorCondition | any;

// Type for the overall filter structure
type Filter = {
  [field: string]: FieldCondition | Filter;
};

// Base abstract class for filter translators
abstract class BaseFilterTranslator {
  abstract translate(filter: Filter): unknown;

  /**
   * Operator type checks
   */
  protected isOperator(key: string): key is QueryOperator {
    return key.startsWith('$');
  }

  protected readonly supportedBasicOperators: BasicOperator[] = ['$eq', '$ne'];
  protected readonly supportedNumericOperators: NumericOperator[] = ['$gt', '$gte', '$lt', '$lte'];
  protected readonly supportedArrayOperators: ArrayOperator[] = ['$in', '$nin', '$all', '$elemMatch'];
  protected readonly supportedLogicalOperators: LogicalOperator[] = ['$and', '$or', '$not', '$nor'];
  protected readonly supportedElementOperators: ElementOperator[] = ['$exists'];
  protected readonly supportedRegexOperators: RegexOperator[] = ['$regex', '$options'];

  protected isLogicalOperator(key: string): key is LogicalOperator {
    return this.supportedLogicalOperators.includes(key as LogicalOperator);
  }

  protected isBasicOperator(key: string): key is BasicOperator {
    return this.supportedBasicOperators.includes(key as BasicOperator);
  }

  protected isNumericOperator(key: string): key is NumericOperator {
    return this.supportedNumericOperators.includes(key as NumericOperator);
  }

  protected isArrayOperator(key: string): key is ArrayOperator {
    return this.supportedArrayOperators.includes(key as ArrayOperator);
  }

  protected isElementOperator(key: string): key is ElementOperator {
    return this.supportedElementOperators.includes(key as ElementOperator);
  }

  protected isRegexOperator(key: string): key is RegexOperator {
    return this.supportedRegexOperators.includes(key as RegexOperator);
  }

  /**
   * Validate if an operator is supported by the specific vector DB.
   * Can be overridden by implementations to specify supported operators.
   */
  protected isValidOperator(key: string): boolean {
    return (
      this.isBasicOperator(key) ||
      this.isNumericOperator(key) ||
      this.isLogicalOperator(key) ||
      this.isArrayOperator(key) ||
      this.isElementOperator(key) ||
      this.isRegexOperator(key)
    );
  }

  /**
   * Value normalization for comparison operators
   */
  protected normalizeComparisonValue(value: any): any {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  }

  /**
   * Helper method to simulate $all operator using $and + $eq when needed.
   * Some vector stores don't support $all natively.
   */
  protected simulateAllOperator(field: string, values: any[]): Filter {
    return {
      $and: values.map(value => ({
        [field]: { $in: [this.normalizeComparisonValue(value)] },
      })),
    };
  }

  /**
   * Utility functions for type checking
   */
  protected isPrimitive(value: any): boolean {
    return (
      value === null ||
      value === undefined ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    );
  }

  protected isRegex(value: any): boolean {
    return value instanceof RegExp;
  }

  protected isEmpty(obj: any): boolean {
    return obj === null || obj === undefined || (typeof obj === 'object' && Object.keys(obj).length === 0);
  }

  protected static readonly ErrorMessages = {
    UNSUPPORTED_OPERATOR: (op: string) => `Unsupported operator: ${op}`,
  } as const;

  /**
   * Helper to handle array value normalization consistently
   */
  protected normalizeArrayValues(values: any[]): any[] {
    return values.map(value => this.normalizeComparisonValue(value));
  }

  protected validateFilter(filter: Filter): void {
    const validation = this.validateFilterSupport(filter);
    if (!validation.supported) {
      throw new Error(validation.messages.join(', '));
    }
  }

  /**
   * Validates if a filter structure is supported by the specific vector DB
   * and returns detailed validation information.
   */
  private validateFilterSupport(node: Filter | FieldCondition): {
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
          messages.push(BaseFilterTranslator.ErrorMessages.UNSUPPORTED_OPERATOR(key));
          continue;
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
}

// Export types and base class
export {
  type QueryOperator,
  type BasicOperator,
  type NumericOperator,
  type LogicalOperator,
  type ArrayOperator,
  type RegexOperator,
  type ElementOperator,
  type Filter,
  type FieldCondition,
  type OperatorCondition,
  BaseFilterTranslator,
};
