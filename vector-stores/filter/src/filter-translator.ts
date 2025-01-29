// Comparison Operators
type ComparisonOperator =
  | '$eq' // Matches values equal to specified value
  | '$gt' // Greater than
  | '$gte' // Greater than or equal
  | '$in' // Matches any value in array
  | '$lt' // Less than
  | '$lte' // Less than or equal
  | '$ne' // Matches values not equal
  | '$nin'; // Matches none of the values in array

// Logical Operators
type LogicalOperator =
  | '$and' // Joins query clauses with logical AND
  | '$not' // Inverts the effect of a query expression
  | '$nor' // Joins query clauses with logical NOR
  | '$or'; // Joins query clauses with logical OR

// Array Operators
type ArrayOperator =
  | '$all' // Matches arrays containing all elements
  | '$elemMatch'; // Matches documents that contain an array field with at least one element that matches all the specified query criteria

// Element Operators
type ElementOperator = '$exists'; // Matches documents that have the specified field

// Union of all supported operators
type QueryOperator = ComparisonOperator | LogicalOperator | ArrayOperator | ElementOperator;

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

  protected isOperator(key: string): key is QueryOperator {
    return key.startsWith('$');
  }

  protected isLogicalOperator(key: string): key is LogicalOperator {
    return ['$and', '$or', '$not', '$nor'].includes(key);
  }

  protected isComparisonOperator(key: string): key is ComparisonOperator {
    return ['$eq', '$gt', '$gte', '$in', '$lt', '$lte', '$ne', '$nin'].includes(key);
  }

  protected isArrayOperator(key: string): key is ArrayOperator {
    return ['$all', '$elemMatch'].includes(key);
  }

  protected isElementOperator(key: string): key is ElementOperator {
    return ['$exists'].includes(key);
  }

  // Helper method to validate values for specific operators
  protected validateOperatorValue(operator: QueryOperator, value: any): void {
    switch (operator) {
      case '$in':
      case '$nin':
      case '$all':
        if (!Array.isArray(value)) {
          throw new Error(`${operator} requires an array value`);
        }
        break;
      case '$exists':
        if (typeof value !== 'boolean') {
          throw new Error('$exists requires a boolean value');
        }
        break;
      case '$eq':
      case '$ne':
      case '$gt':
      case '$gte':
      case '$lt':
      case '$lte':
        if (value === undefined) {
          throw new Error(`${operator} requires a non-undefined value`);
        }
        break;
    }
  }

  // Helper method to normalize values for comparison operators
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
        [field]: { $eq: value },
      })),
    };
  }

  /**
   * Determines if a filter uses only supported operators for a given vector store.
   * Implementation should be provided by concrete classes.
   */
  abstract isSupportedFilter(filter: Filter): boolean;
}

// Export types and base class
export {
  type QueryOperator,
  type ComparisonOperator,
  type LogicalOperator,
  type ArrayOperator,
  type ElementOperator,
  type Filter,
  type FieldCondition,
  type OperatorCondition,
  BaseFilterTranslator,
};
