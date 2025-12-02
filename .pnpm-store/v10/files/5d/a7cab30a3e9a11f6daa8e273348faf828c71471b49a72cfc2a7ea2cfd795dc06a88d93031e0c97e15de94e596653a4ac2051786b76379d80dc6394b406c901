'use strict';

// src/vector/filter/base.ts
var BaseFilterTranslator = class _BaseFilterTranslator {
  /**
   * Operator type checks
   */
  isOperator(key) {
    return key.startsWith("$");
  }
  static BASIC_OPERATORS = ["$eq", "$ne"];
  static NUMERIC_OPERATORS = ["$gt", "$gte", "$lt", "$lte"];
  static ARRAY_OPERATORS = ["$in", "$nin", "$all", "$elemMatch"];
  static LOGICAL_OPERATORS = ["$and", "$or", "$not", "$nor"];
  static ELEMENT_OPERATORS = ["$exists"];
  static REGEX_OPERATORS = ["$regex", "$options"];
  static DEFAULT_OPERATORS = {
    logical: _BaseFilterTranslator.LOGICAL_OPERATORS,
    basic: _BaseFilterTranslator.BASIC_OPERATORS,
    numeric: _BaseFilterTranslator.NUMERIC_OPERATORS,
    array: _BaseFilterTranslator.ARRAY_OPERATORS,
    element: _BaseFilterTranslator.ELEMENT_OPERATORS,
    regex: _BaseFilterTranslator.REGEX_OPERATORS
  };
  isLogicalOperator(key) {
    return _BaseFilterTranslator.DEFAULT_OPERATORS.logical.includes(key);
  }
  isBasicOperator(key) {
    return _BaseFilterTranslator.DEFAULT_OPERATORS.basic.includes(key);
  }
  isNumericOperator(key) {
    return _BaseFilterTranslator.DEFAULT_OPERATORS.numeric.includes(key);
  }
  isArrayOperator(key) {
    return _BaseFilterTranslator.DEFAULT_OPERATORS.array.includes(key);
  }
  isElementOperator(key) {
    return _BaseFilterTranslator.DEFAULT_OPERATORS.element.includes(key);
  }
  isRegexOperator(key) {
    return _BaseFilterTranslator.DEFAULT_OPERATORS.regex.includes(key);
  }
  isFieldOperator(key) {
    return this.isOperator(key) && !this.isLogicalOperator(key);
  }
  isCustomOperator(key) {
    const support = this.getSupportedOperators();
    return support.custom?.includes(key) ?? false;
  }
  getSupportedOperators() {
    return _BaseFilterTranslator.DEFAULT_OPERATORS;
  }
  isValidOperator(key) {
    const support = this.getSupportedOperators();
    const allSupported = Object.values(support).flat();
    return allSupported.includes(key);
  }
  /**
   * Value normalization for comparison operators
   */
  normalizeComparisonValue(value) {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === "number" && Object.is(value, -0)) {
      return 0;
    }
    return value;
  }
  /**
   * Helper method to simulate $all operator using $and + $eq when needed.
   * Some vector stores don't support $all natively.
   */
  simulateAllOperator(field, values) {
    return {
      $and: values.map((value) => ({
        [field]: { $in: [this.normalizeComparisonValue(value)] }
      }))
    };
  }
  /**
   * Utility functions for type checking
   */
  isPrimitive(value) {
    return value === null || value === void 0 || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
  }
  isRegex(value) {
    return value instanceof RegExp;
  }
  isEmpty(obj) {
    return obj === null || obj === void 0 || typeof obj === "object" && Object.keys(obj).length === 0;
  }
  static ErrorMessages = {
    UNSUPPORTED_OPERATOR: (op) => `Unsupported operator: ${op}`,
    INVALID_LOGICAL_OPERATOR_LOCATION: (op, path) => `Logical operator ${op} cannot be used at field level: ${path}`,
    NOT_REQUIRES_OBJECT: `$not operator requires an object`,
    NOT_CANNOT_BE_EMPTY: `$not operator cannot be empty`,
    INVALID_LOGICAL_OPERATOR_CONTENT: (path) => `Logical operators must contain field conditions, not direct operators: ${path}`,
    INVALID_TOP_LEVEL_OPERATOR: (op) => `Invalid top-level operator: ${op}`,
    ELEM_MATCH_REQUIRES_OBJECT: `$elemMatch requires an object with conditions`
  };
  /**
   * Helper to handle array value normalization consistently
   */
  normalizeArrayValues(values) {
    return values.map((value) => this.normalizeComparisonValue(value));
  }
  validateFilter(filter) {
    const validation = this.validateFilterSupport(filter);
    if (!validation.supported) {
      throw new Error(validation.messages.join(", "));
    }
  }
  /**
   * Validates if a filter structure is supported by the specific vector DB
   * and returns detailed validation information.
   */
  validateFilterSupport(node, path = "") {
    const messages = [];
    if (this.isPrimitive(node) || this.isEmpty(node)) {
      return { supported: true, messages: [] };
    }
    if (Array.isArray(node)) {
      const arrayResults = node.map((item) => this.validateFilterSupport(item, path));
      const arrayMessages = arrayResults.flatMap((r) => r.messages);
      return {
        supported: arrayResults.every((r) => r.supported),
        messages: arrayMessages
      };
    }
    const nodeObj = node;
    let isSupported = true;
    for (const [key, value] of Object.entries(nodeObj)) {
      const newPath = path ? `${path}.${key}` : key;
      if (this.isOperator(key)) {
        if (!this.isValidOperator(key)) {
          isSupported = false;
          messages.push(_BaseFilterTranslator.ErrorMessages.UNSUPPORTED_OPERATOR(key));
          continue;
        }
        if (!path && !this.isLogicalOperator(key)) {
          isSupported = false;
          messages.push(_BaseFilterTranslator.ErrorMessages.INVALID_TOP_LEVEL_OPERATOR(key));
          continue;
        }
        if (key === "$elemMatch" && (typeof value !== "object" || Array.isArray(value))) {
          isSupported = false;
          messages.push(_BaseFilterTranslator.ErrorMessages.ELEM_MATCH_REQUIRES_OBJECT);
          continue;
        }
        if (this.isLogicalOperator(key)) {
          if (key === "$not") {
            if (Array.isArray(value) || typeof value !== "object") {
              isSupported = false;
              messages.push(_BaseFilterTranslator.ErrorMessages.NOT_REQUIRES_OBJECT);
              continue;
            }
            if (this.isEmpty(value)) {
              isSupported = false;
              messages.push(_BaseFilterTranslator.ErrorMessages.NOT_CANNOT_BE_EMPTY);
              continue;
            }
            continue;
          }
          if (path && !this.isLogicalOperator(path.split(".").pop())) {
            isSupported = false;
            messages.push(_BaseFilterTranslator.ErrorMessages.INVALID_LOGICAL_OPERATOR_LOCATION(key, newPath));
            continue;
          }
          if (Array.isArray(value)) {
            const hasDirectOperators = value.some(
              (item) => typeof item === "object" && Object.keys(item).length === 1 && this.isFieldOperator(Object.keys(item)[0])
            );
            if (hasDirectOperators) {
              isSupported = false;
              messages.push(_BaseFilterTranslator.ErrorMessages.INVALID_LOGICAL_OPERATOR_CONTENT(newPath));
              continue;
            }
          }
        }
      }
      const nestedValidation = this.validateFilterSupport(value, newPath);
      if (!nestedValidation.supported) {
        isSupported = false;
        messages.push(...nestedValidation.messages);
      }
    }
    return { supported: isSupported, messages };
  }
};

exports.BaseFilterTranslator = BaseFilterTranslator;
//# sourceMappingURL=chunk-6XCINXZ7.cjs.map
//# sourceMappingURL=chunk-6XCINXZ7.cjs.map