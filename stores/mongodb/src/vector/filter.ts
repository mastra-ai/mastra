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
      return this.isLogicalOperator(operator)
        ? { [operator]: translated }
        : translated;
    }

    // Process each entry recursively
    const result: Record<string, any> = {};
    for (const [key, value] of entries) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      if (this.isOperator(key)) {
        result[key] = this.translateOperator(key, value, currentPath);
        continue;
      }

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Handle nested $all special case
        if (Object.keys(value).length === 1 && '$all' in value) {
          const translated = this.translateNode(value, key);
          if (translated.$and) return translated;
        }
        // Check if the nested object contains operators
        if (Object.keys(value).length === 0) {
          result[newPath] = this.translateNode(value);
        } else {
          const hasOperators = Object.keys(value).some(k => this.isOperator(k));
          if (hasOperators) {
            const normalizedValue: Record<string, any> = {};
            for (const [op, opValue] of Object.entries(value)) {
              normalizedValue[op] = this.isOperator(op)
                ? this.translateOperator(op, opValue)
                : opValue;
            }
            result[newPath] = normalizedValue;
          } else {
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
      return value;
    }
    // Handle logical operators (all must be provided as arrays)
    if (this.isLogicalOperator(operator)) {
      if (!Array.isArray(value)) {
        throw new Error(`Value for logical operator ${operator} must be an array`);
      }
      return value.map(item => this.translateNode(item));
    }
    // For comparison and element operators, simply return normalized value.
    return this.normalizeComparisonValue(value);
  }

  private processFilter(filter: VectorFilter): any {
    const mongoFilter: any = {};
    for (const key in filter) {
      if (!Object.prototype.hasOwnProperty.call(filter, key)) continue;
      const value = filter[key];
      if (this.isLogicalOperator(key)) {
        let arrValue;
        // Allow $not at top level to be given as an object (wrap it in an array)
        if (!Array.isArray(value)) {
          if (key === '$not' && typeof value === 'object' && value !== null) {
            arrValue = [value];
          } else {
            throw new Error(`Value for logical operator ${key} must be an array`);
          }
        } else {
          arrValue = value;
        }
        mongoFilter[key] = arrValue.map((subFilter: any) => this.processFilter(subFilter));
      } else if (this.isOperator(key)) {
        throw new Error(
          `Invalid operator at top level: ${key}. Operators should be within field conditions.`
        );
      } else {
        mongoFilter[key] = this.processFieldCondition(value);
      }
    }
    return mongoFilter;
  }

  private processFieldCondition(condition: FieldCondition): any {
    if (condition === undefined) {
      throw new Error('Field condition cannot be undefined');
    } else if (condition === null) {
      return condition;
    } else if (this.isPrimitive(condition) || this.isRegex(condition)) {
      return condition;
    } else if (this.isDate(condition)) {
      return condition;
    } else if (Array.isArray(condition)) {
      return { $in: condition };
    } else if (typeof condition === 'object') {
      if (Object.keys(condition).length === 0) {
        return condition;
      }
      const fieldQuery: any = {};
      for (const op in condition) {
        if (!Object.prototype.hasOwnProperty.call(condition, op)) continue;
        const opValue = (condition as any)[op];
        if (this.isOperator(op)) {
          switch (op) {
            case '$not':
              if (typeof opValue !== 'object' || opValue === null) {
                throw new Error('$not operator requires a non-null object');
              }
              fieldQuery[op] = this.processFieldCondition(opValue);
              break;
            case '$gt':
            case '$gte':
            case '$lt':
            case '$lte':
              if (typeof opValue !== 'number') {
                throw new Error(`${op} operator requires a numeric value`);
              }
              fieldQuery[op] = opValue;
              break;
            case '$in':
            case '$nin':
              if (!Array.isArray(opValue)) {
                throw new Error(`${op} operator requires an array`);
              }
              fieldQuery[op] = opValue;
              break;
            case '$exists':
              if (typeof opValue !== 'boolean') {
                throw new Error(`${op} operator requires a boolean value`);
              }
              fieldQuery[op] = opValue;
              break;
            case '$all':
              if (!Array.isArray(opValue) || opValue.length === 0) {
                throw new Error('A non-empty array is required for the $all operator');
              }
              fieldQuery[op] = opValue;
              break;
            // For now, we ignore $size support.
            default:
              fieldQuery[op] = opValue;
          }
        } else {
          fieldQuery[op] = this.processFieldCondition(opValue);
        }
      }
      return fieldQuery;
    } else {
      throw new Error(`Unsupported field condition type: ${typeof condition}`);
    }
  }

  private isDate(value: any): boolean {
    return Object.prototype.toString.call(value) === '[object Date]';
  }

  protected getSupportedOperators(): OperatorSupport {
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