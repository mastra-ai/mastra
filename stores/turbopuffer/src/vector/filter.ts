import type { FieldCondition, OperatorSupport, VectorFilter } from '@mastra/core/vector/filter';
import { BaseFilterTranslator } from '@mastra/core/vector/filter';
import type { FilterCondition, FilterConnective, FilterOperator, Filters } from '@turbopuffer/turbopuffer';

/**
 * Translator for converting Mastra filters to Turbopuffer format
 *
 * Mastra filters: { field: { $gt: 10 } }
 * Turbopuffer filters: ["And", [["field", "Gt", 10]]]
 */
export class TurbopufferFilterTranslator extends BaseFilterTranslator {
  protected override getSupportedOperators(): OperatorSupport {
    return {
      ...BaseFilterTranslator.DEFAULT_OPERATORS,
      logical: ['$and', '$or'],
      array: ['$in', '$nin', '$all'],
      element: ['$exists'],
      regex: [], // No regex support in Turbopuffer
      custom: [], // No custom operators
    };
  }

  /**
   * Map Mastra operators to Turbopuffer operators
   */
  private operatorMap: Record<string, FilterOperator> = {
    $eq: 'Eq',
    $ne: 'NotEq',
    $gt: 'Gt',
    $gte: 'Gte',
    $lt: 'Lt',
    $lte: 'Lte',
    $in: 'In',
    $nin: 'NotIn',
  };

  /**
   * Convert the Mastra filter to Turbopuffer format
   */
  translate(filter?: VectorFilter): Filters | undefined {
    if (this.isEmpty(filter)) {
      return undefined;
    }

    // Validate the filter structure before translating
    this.validateFilter(filter as VectorFilter);

    // Translate the filter
    const result = this.translateNode(filter as VectorFilter);

    // If we have a single condition (not a logical operator at the top level),
    // wrap it in an implicit AND to match Turbopuffer's expected format
    if (!Array.isArray(result) || result.length !== 2 || (result[0] !== 'And' && result[0] !== 'Or')) {
      return ['And', [result as FilterCondition]];
    }

    return result as Filters;
  }

  /**
   * Recursively translate a filter node
   */
  private translateNode(node: VectorFilter | FieldCondition): Filters | FilterCondition {
    // Handle empty or null nodes
    if (node === null || node === undefined || Object.keys(node).length === 0) {
      return ['And', []];
    }

    // Handle primitive values (direct equality comparison)
    if (this.isPrimitive(node)) {
      throw new Error('Direct primitive values not valid in this context for Turbopuffer');
    }

    // Handle direct array value (convert to $in)
    if (Array.isArray(node)) {
      throw new Error('Direct array values not valid in this context for Turbopuffer');
    }

    const entries = Object.entries(node);

    // Process the first operator or field
    if (entries.length === 0) {
      return ['And', []];
    }

    const [key, value] = entries[0] as [string, any];

    // Handle logical operators
    if (key && this.isLogicalOperator(key)) {
      return this.translateLogical(key, value);
    }

    // Multiple fields at top level - implicit AND
    if (entries.length > 1) {
      const conditions = entries.map(([field, fieldValue]) => this.translateFieldCondition(field, fieldValue));
      return ['And', conditions];
    }

    // Single field with condition(s)
    return this.translateFieldCondition(key, value);
  }

  /**
   * Translate a field condition
   */
  private translateFieldCondition(field: string, value: any): FilterCondition {
    // Handle Date object directly (convert to ISO string)
    if (value instanceof Date) {
      return [field, 'Eq', this.normalizeValue(value)];
    }

    // Handle primitive value (direct equality)
    if (this.isPrimitive(value)) {
      return [field, 'Eq', this.normalizeValue(value)];
    }

    // Handle array value (convert to $in)
    if (Array.isArray(value)) {
      return [field, 'In', this.normalizeArrayValues(value)];
    }

    // Handle object with operators
    if (typeof value === 'object' && value !== null) {
      const operators = Object.keys(value);

      // If multiple operators for the same field, create an AND condition
      if (operators.length > 1) {
        // Check if all keys are operators
        const allOperators = operators.every(op => this.isOperator(op));
        if (allOperators) {
          // For multiple comparison operators on one field
          const conditions = operators.map(op => this.translateOperator(field, op, value[op]));
          return ['And', conditions] as unknown as FilterCondition;
        } else {
          // For nested objects with multiple fields
          const conditions = operators.map(op => {
            const nestedField = `${field}.${op}`;
            return this.translateFieldCondition(nestedField, value[op]);
          });
          return ['And', conditions] as unknown as FilterCondition;
        }
      }

      // Single operator
      const op = operators[0];
      if (op && this.isOperator(op)) {
        return this.translateOperator(field, op, value[op]);
      }

      // Nested field path (use dot notation)
      if (op && !this.isOperator(op)) {
        const nestedField = `${field}.${op}`;
        return this.translateFieldCondition(nestedField, value[op]);
      }
    }

    throw new Error(`Unsupported filter format for field: ${field}`);
  }

  /**
   * Translate a logical operator
   */
  private translateLogical(operator: string, conditions: any[]): Filters {
    // Map Mastra logical operators to Turbopuffer
    const logicalOp: FilterConnective = operator === '$and' ? 'And' : 'Or';

    // Validate conditions
    if (!Array.isArray(conditions)) {
      throw new Error(`Logical operator ${operator} requires an array of conditions`);
    }

    // Translate each condition
    const translatedConditions = conditions.map(condition => {
      if (typeof condition !== 'object' || condition === null) {
        throw new Error(`Invalid condition for logical operator ${operator}`);
      }
      return this.translateNode(condition);
    });

    return [logicalOp, translatedConditions];
  }

  /**
   * Translate a specific operator
   */
  private translateOperator(field: string, operator: string, value: any): FilterCondition {
    // Handle comparison operators
    if (operator && this.operatorMap[operator]) {
      return [field, this.operatorMap[operator], this.normalizeValue(value)];
    }

    // Handle special cases
    switch (operator) {
      case '$exists':
        // $exists: true -> use NotEq with null (field exists if it's not null)
        // $exists: false -> use Eq with null (field doesn't exist if it is null)
        return value ? [field, 'NotEq', null] : [field, 'Eq', null];

      case '$all':
        // $all is not directly supported, simulate with AND + IN conditions
        if (!Array.isArray(value) || value.length === 0) {
          throw new Error('$all operator requires a non-empty array');
        }

        const allConditions = value.map(item => [field, 'In', [this.normalizeValue(item)]] as FilterCondition);

        // Return the array of conditions directly without nesting
        return ['And', allConditions] as unknown as FilterCondition;

      default:
        throw new Error(`Unsupported operator: ${operator || 'undefined'}`);
    }
  }

  /**
   * Normalize a value for comparison operations
   */
  protected normalizeValue(value: any): any {
    // Handle special value types
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  }

  /**
   * Normalize array values
   */
  protected normalizeArrayValues(values: any[]): any[] {
    return values.map(value => this.normalizeValue(value));
  }
}
