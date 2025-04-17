import { BaseFilterTranslator } from '@mastra/core/vector/filter';
import type { FieldCondition, VectorFilter, OperatorSupport, QueryOperator } from '@mastra/core/vector/filter';

// MongoFilterTranslator implementation    
export class MongoFilterTranslator extends BaseFilterTranslator {
  translate(filter: VectorFilter): any {
    if (filter === undefined || filter === null) {
      return filter;
    }
    this.validateFilter(filter); // Validate the filter structure
    return this.processFilter(filter);
  }

  private translateNode(node: VectorFilter | FieldCondition, currentPath: string = ''): any {
    if (this.isRegex(node)) {
      throw new Error('Regex is not supported in MongoDB. TODO: Implement regex support');
    }
    if (this.isPrimitive(node)) return this.normalizeComparisonValue(node);
    if (Array.isArray(node)) return { $in: this.normalizeArrayValues(node) };

    const entries = Object.entries(node as Record<string, any>);
    const firstEntry = entries[0];

    // Handle single operator case
    if (entries.length === 1 && firstEntry && this.isOperator(firstEntry[0])) {
      const [operator, value] = firstEntry;
      const translated = this.translateOperator(operator, value, currentPath);
      return this.isLogicalOperator(operator) ? { [operator]: translated } : translated;
    }

    // Process each entry
    const result: Record<string, any> = {};

    for (const [key, value] of entries) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;

      if (this.isOperator(key)) {
        result[key] = this.translateOperator(key, value, currentPath);
        continue;
      }

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Handle nested $all
        if (Object.keys(value).length === 1 && '$all' in value) {
          const translated = this.translateNode(value, key);
          if (translated.$and) {
            return translated;
          }
        }

        // Check if the nested object contains operators
        if (Object.keys(value).length === 0) {
          result[newPath] = this.translateNode(value);
        } else {
          const hasOperators = Object.keys(value).some(k => this.isOperator(k));
          if (hasOperators) {
            // For objects with operators, normalize each operator value
            const normalizedValue: Record<string, any> = {};
            for (const [op, opValue] of Object.entries(value)) {
              normalizedValue[op] = this.isOperator(op) ? this.translateOperator(op, opValue) : opValue;
            }
            result[newPath] = normalizedValue;
          } else {
            // For objects without operators, flatten them
            Object.assign(result, this.translateNode(value, newPath));
          }
        }
      } else {
        result[newPath] = this.translateNode(value);
      }
    }

    return result;
  }

  private translateOperator(operator: QueryOperator, value: any, currentPath: string = ''): any {
    // Handle $all specially
    if (operator === '$all') {
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error('A non-empty array is required for the $all operator');
      }
      return this.simulateAllOperator(currentPath, value);
    }

    // Handle logical operators
    if (this.isLogicalOperator(operator)) {
      return Array.isArray(value) ? value.map(item => this.translateNode(item)) : this.translateNode(value);
    }

    // Handle comparison and element operators (e.g., $gt, $lt, $in, etc.)
    // Simply return the normalized value. Additional validation can be added if needed.
    return this.normalizeComparisonValue(value);
  }

  private processFilter(filter: VectorFilter): any {
    const mongoFilter: any = {};

    for (const key in filter) {
      if (!Object.prototype.hasOwnProperty.call(filter, key)) continue;

      const value = filter[key];

      if (this.isLogicalOperator(key)) {
        // Handle logical operators like $and, $or, $nor
        if (!Array.isArray(value)) {
          throw new Error(
            `Value for logical operator ${key} must be an array`
          );
        }
        mongoFilter[key] = value.map((subFilter: any) =>
          this.processFilter(subFilter)
        );
      } else if (this.isOperator(key)) {
        // Operators like $eq, $gt should not be at the top level
        throw new Error(
          `Invalid operator at top level: ${key}. Operators should be within field conditions.`
        );
      } else {
        // Key is a field name
        mongoFilter[key] = this.processFieldCondition(value);
      }
    }

    return mongoFilter;
  }

  private processFieldCondition(condition: FieldCondition): any {
    if (condition === undefined) {
      throw new Error('Field condition cannot be undefined');
    } else if (condition === null) {
      // Null is a valid field condition in MongoDB
      return condition;
    } else if (
      this.isPrimitive(condition) ||
      this.isRegex(condition)
    ) {
      // Primitive value or regex, treat as equality
      return condition;
    } else if (this.isDate(condition)) {
      // Handle Date objects
      return condition;
    } else if (Array.isArray(condition)) {
      // For arrays, treat as $in operator
      return { $in: condition };
    } else if (typeof condition === 'object') {
      // Check if object is empty
      if (Object.keys(condition).length === 0) {
        // Return the empty object as is
        return condition;
      }
      // Operator conditions
      const fieldQuery: any = {};

      for (const op in condition) {
        if (!Object.prototype.hasOwnProperty.call(condition, op)) continue;

        const opValue = (condition as any)[op];

        if (this.isOperator(op)) {
          if (this.isLogicalOperator(op)) {
            if (op === '$not') {
              // Handle $not operator within field condition
              if (typeof opValue !== 'object' || opValue === null) {
                throw new Error('$not operator requires a non-null object');
              }
              fieldQuery[op] = this.processFieldCondition(
                opValue as FieldCondition
              );
            } else {
              // Other logical operators are invalid within field conditions
              throw new Error(
                `Logical operator ${op} cannot be used within field conditions`
              );
            }
          } else if (
            this.isBasicOperator(op) ||
            this.isNumericOperator(op) ||
            this.isArrayOperator(op) ||
            this.isElementOperator(op) ||
            this.isRegexOperator(op)
          ) {
            // Return the operator and its value (basic validation can be added if needed)
            fieldQuery[op] = opValue;
          } else {
            throw new Error(`Unsupported operator: ${op}`);
          }
        } else {
          // Nested field condition (e.g., embedded documents)
          fieldQuery[op] = this.processFieldCondition(opValue as FieldCondition);
        }
      }
      return fieldQuery;
    } else {
      throw new Error(
        `Unsupported field condition type: ${typeof condition}`
      );
    }
  }
  private isDate(value: any): boolean {
    return Object.prototype.toString.call(value) === '[object Date]';
  }

  // Override methods from BaseFilterTranslator as needed
  protected getSupportedOperators(): OperatorSupport {
    // Return MongoDB supported operators
    return {
      logical: BaseFilterTranslator.DEFAULT_OPERATORS.logical,
      basic: BaseFilterTranslator.DEFAULT_OPERATORS.basic,
      numeric: BaseFilterTranslator.DEFAULT_OPERATORS.numeric,
      array: BaseFilterTranslator.DEFAULT_OPERATORS.array,
      element: BaseFilterTranslator.DEFAULT_OPERATORS.element,
      regex: BaseFilterTranslator.DEFAULT_OPERATORS.regex,
      custom: [],
    };
  }
}