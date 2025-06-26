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

type EmptyObject = Record<string, never>;

type FilterValue = string | number | boolean | Date | null | undefined | EmptyObject;

// Logical operators are handled at the top level as objects, not as values here
// $and, $or, $nor, $not are handled in LogicalCondition
type OperatorValueMap<Op extends string = string, ValueMap extends Record<string, any> = any> = {
  $eq: FilterValue;
  $ne: FilterValue;
  $gt: number | string | Date;
  $gte: number | string | Date;
  $lt: number | string | Date;
  $lte: number | string | Date;
  $all: FilterValue[];
  $in: FilterValue[];
  $nin: FilterValue[];
  $elemMatch: Record<string, unknown>;
  $exists: boolean;
  $regex: string | RegExp;
  $options: string;
  $not: OperatorCondition<Op, ValueMap> | RegExp;
};

type LogicalOperatorValueMap = {
  $and: 'array';
  $or: 'array';
  $nor: 'array';
  $not: 'object';
};

type BlacklistedRootOperators =
  | '$eq'
  | '$ne'
  | '$gt'
  | '$gte'
  | '$lt'
  | '$lte'
  | '$in'
  | '$nin'
  | '$all'
  | '$exists'
  | '$regex'
  | '$options'
  | '$elemMatch';

type VectorFieldValue = FilterValue | FilterValue[];

// Vector filter parameterized by operator set
type VectorFilter<
  Op extends keyof ValueMap = keyof OperatorValueMap,
  ValueMap extends Record<string, any> = OperatorValueMap,
  LogicalValueMap extends Record<string, any> = LogicalOperatorValueMap,
  Blacklisted extends string = BlacklistedRootOperators,
  FieldValue = VectorFieldValue,
> = FilterCondition<Op, ValueMap, LogicalValueMap, Blacklisted, FieldValue> | null | undefined;

type FilterCondition<
  Op extends keyof ValueMap = keyof OperatorValueMap,
  ValueMap extends Record<string, any> = OperatorValueMap,
  LogicalValueMap extends Record<string, any> = LogicalOperatorValueMap,
  Blacklisted extends string = BlacklistedRootOperators,
  FieldValue = VectorFieldValue,
> = (FieldCondition<Op, ValueMap, FieldValue> | LogicalCondition<Op, ValueMap, LogicalValueMap>) &
  ForbiddenRootOperators<Blacklisted>;

// Field condition can be a value or an operator condition
type FieldCondition<
  Op extends keyof ValueMap = keyof OperatorValueMap,
  ValueMap extends Record<string, any> = OperatorValueMap,
  FieldValue = VectorFieldValue,
> = {
  [field: string]: OperatorCondition<Op, ValueMap> | FieldValue;
};

type ForbiddenRootOperators<Blacklisted extends string> = {
  [K in Blacklisted]?: never;
};

// Logical conditions
type LogicalCondition<
  Op extends keyof ValueMap = keyof OperatorValueMap,
  ValueMap extends Record<string, any> = OperatorValueMap,
  LogicalValueMap extends Record<string, any> = LogicalOperatorValueMap,
> = {
  [K in keyof LogicalValueMap]: LogicalValueMap[K] extends 'array'
    ? {
        [P in K]: Array<LogicalBranch<Op, ValueMap, LogicalValueMap>>;
      }
    : {
        [P in K]: LogicalBranch<Op, ValueMap, LogicalValueMap>;
      };
}[keyof LogicalValueMap];

type LogicalBranch<
  Op extends keyof ValueMap = keyof OperatorValueMap,
  ValueMap extends Record<string, any> = OperatorValueMap,
  LogicalValueMap extends Record<string, any> = LogicalOperatorValueMap,
> = FieldCondition<Op, ValueMap> | LogicalCondition<Op, ValueMap, LogicalValueMap>;

// Base operator condition, parameterized by operator set
type OperatorCondition<
  Op extends keyof ValueMap = keyof OperatorValueMap,
  ValueMap extends Record<string, any> = OperatorValueMap,
> = {
  [K in Exclude<Op, '$and' | '$or' | '$nor'>]?: ValueMap[K];
};

type OperatorSupport = {
  logical?: LogicalOperator[];
  array?: ArrayOperator[];
  basic?: BasicOperator[];
  numeric?: NumericOperator[];
  element?: ElementOperator[];
  regex?: RegexOperator[];
  custom?: string[];
};

// Base abstract class for filter translators
abstract class BaseFilterTranslator<Filter = VectorFilter, Result = Filter> {
  abstract translate(filter: Filter): Result;

  /**
   * Operator type checks
   */
  protected isOperator(key: string): key is QueryOperator {
    return key.startsWith('$');
  }

  protected static readonly BASIC_OPERATORS: BasicOperator[] = ['$eq', '$ne'];
  protected static readonly NUMERIC_OPERATORS: NumericOperator[] = ['$gt', '$gte', '$lt', '$lte'];
  protected static readonly ARRAY_OPERATORS: ArrayOperator[] = ['$in', '$nin', '$all', '$elemMatch'];
  protected static readonly LOGICAL_OPERATORS: LogicalOperator[] = ['$and', '$or', '$not', '$nor'];
  protected static readonly ELEMENT_OPERATORS: ElementOperator[] = ['$exists'];
  protected static readonly REGEX_OPERATORS: RegexOperator[] = ['$regex', '$options'];

  public static readonly DEFAULT_OPERATORS = {
    logical: BaseFilterTranslator.LOGICAL_OPERATORS,
    basic: BaseFilterTranslator.BASIC_OPERATORS,
    numeric: BaseFilterTranslator.NUMERIC_OPERATORS,
    array: BaseFilterTranslator.ARRAY_OPERATORS,
    element: BaseFilterTranslator.ELEMENT_OPERATORS,
    regex: BaseFilterTranslator.REGEX_OPERATORS,
  };

  protected isLogicalOperator(key: string): key is LogicalOperator {
    return BaseFilterTranslator.DEFAULT_OPERATORS.logical.includes(key as LogicalOperator);
  }

  protected isBasicOperator(key: string): key is BasicOperator {
    return BaseFilterTranslator.DEFAULT_OPERATORS.basic.includes(key as BasicOperator);
  }

  protected isNumericOperator(key: string): key is NumericOperator {
    return BaseFilterTranslator.DEFAULT_OPERATORS.numeric.includes(key as NumericOperator);
  }

  protected isArrayOperator(key: string): key is ArrayOperator {
    return BaseFilterTranslator.DEFAULT_OPERATORS.array.includes(key as ArrayOperator);
  }

  protected isElementOperator(key: string): key is ElementOperator {
    return BaseFilterTranslator.DEFAULT_OPERATORS.element.includes(key as ElementOperator);
  }

  protected isRegexOperator(key: string): key is RegexOperator {
    return BaseFilterTranslator.DEFAULT_OPERATORS.regex.includes(key as RegexOperator);
  }

  protected isFieldOperator(key: string): key is QueryOperator {
    return this.isOperator(key) && !this.isLogicalOperator(key);
  }

  protected isCustomOperator(key: string): boolean {
    const support = this.getSupportedOperators();
    return support.custom?.includes(key) ?? false;
  }

  protected getSupportedOperators(): OperatorSupport {
    return BaseFilterTranslator.DEFAULT_OPERATORS;
  }

  protected isValidOperator(key: string): boolean {
    const support = this.getSupportedOperators();
    const allSupported = Object.values(support).flat();
    return allSupported.includes(key as QueryOperator);
  }

  /**
   * Value normalization for comparison operators
   */
  protected normalizeComparisonValue(value: any): any {
    if (value instanceof Date) {
      return value.toISOString();
    }

    // Handle -0 case
    if (typeof value === 'number' && Object.is(value, -0)) {
      return 0;
    }
    return value;
  }

  /**
   * Helper method to simulate $all operator using $and + $eq when needed.
   * Some vector stores don't support $all natively.
   */
  protected simulateAllOperator(field: string, values: any[]): VectorFilter<keyof OperatorValueMap, OperatorValueMap> {
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
    INVALID_LOGICAL_OPERATOR_LOCATION: (op: string, path: string) =>
      `Logical operator ${op} cannot be used at field level: ${path}`,
    NOT_REQUIRES_OBJECT: `$not operator requires an object`,
    NOT_CANNOT_BE_EMPTY: `$not operator cannot be empty`,
    INVALID_LOGICAL_OPERATOR_CONTENT: (path: string) =>
      `Logical operators must contain field conditions, not direct operators: ${path}`,
    INVALID_TOP_LEVEL_OPERATOR: (op: string) => `Invalid top-level operator: ${op}`,
    ELEM_MATCH_REQUIRES_OBJECT: `$elemMatch requires an object with conditions`,
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
  private validateFilterSupport(
    node: Filter,
    path: string = '',
  ): {
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
      const arrayResults = node.map(item => this.validateFilterSupport(item, path));
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
      const newPath = path ? `${path}.${key}` : key;
      // Check if the key is an operator
      if (this.isOperator(key)) {
        if (!this.isValidOperator(key)) {
          isSupported = false;
          messages.push(BaseFilterTranslator.ErrorMessages.UNSUPPORTED_OPERATOR(key));
          continue;
        }

        // Add check for non-logical operators at top level
        if (!path && !this.isLogicalOperator(key)) {
          isSupported = false;
          messages.push(BaseFilterTranslator.ErrorMessages.INVALID_TOP_LEVEL_OPERATOR(key));
          continue;
        }

        // In the translate method or wherever operators are handled
        if (key === '$elemMatch' && (typeof value !== 'object' || Array.isArray(value))) {
          isSupported = false;
          messages.push(BaseFilterTranslator.ErrorMessages.ELEM_MATCH_REQUIRES_OBJECT);
          continue;
        }

        // Special validation for logical operators
        if (this.isLogicalOperator(key)) {
          if (key === '$not') {
            if (Array.isArray(value) || typeof value !== 'object') {
              isSupported = false;
              messages.push(BaseFilterTranslator.ErrorMessages.NOT_REQUIRES_OBJECT);
              continue;
            }
            if (this.isEmpty(value)) {
              isSupported = false;
              messages.push(BaseFilterTranslator.ErrorMessages.NOT_CANNOT_BE_EMPTY);
              continue;
            }
            // $not can be used at field level or top level
            continue;
          }
          // Other logical operators can only be at top level or nested in logical operators
          if (path && !this.isLogicalOperator(path.split('.').pop()!)) {
            isSupported = false;
            messages.push(BaseFilterTranslator.ErrorMessages.INVALID_LOGICAL_OPERATOR_LOCATION(key, newPath));
            continue;
          }

          if (Array.isArray(value)) {
            const hasDirectOperators = value.some(
              item =>
                typeof item === 'object' &&
                Object.keys(item).length === 1 &&
                this.isFieldOperator(Object.keys(item)[0]!),
            );

            if (hasDirectOperators) {
              isSupported = false;
              messages.push(BaseFilterTranslator.ErrorMessages.INVALID_LOGICAL_OPERATOR_CONTENT(newPath));
              continue;
            }
          }
        }
      }

      // Recursively validate nested value
      const nestedValidation = this.validateFilterSupport(value, newPath);
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
  type VectorFilter,
  type FilterValue,
  type VectorFieldValue,
  type FieldCondition,
  type OperatorCondition,
  type OperatorSupport,
  type OperatorValueMap,
  type LogicalOperatorValueMap,
  type BlacklistedRootOperators,
  BaseFilterTranslator,
};
