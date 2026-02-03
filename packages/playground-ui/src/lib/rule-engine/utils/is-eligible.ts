import { Rule, RuleContext } from '../types';

const isString = (value: unknown): value is string => typeof value === 'string';

const isNumber = (value: unknown): value is number => typeof value === 'number' && !Number.isNaN(value);

const areBothNumbers = (a: unknown, b: unknown): boolean => isNumber(a) && isNumber(b);

const areBothStrings = (a: unknown, b: unknown): boolean => isString(a) && isString(b);

const isDate = (value: unknown): value is Date => value instanceof Date && !Number.isNaN(value.getTime());

const areBothDates = (a: unknown, b: unknown): boolean => isDate(a) && isDate(b);

/**
 * Checks if a value is null or undefined.
 */
const isNullish = (value: unknown): value is null | undefined => typeof value === 'undefined' || value === null;

/**
 * Gets a nested value from an object using dot notation.
 * Supports paths like "user.email" or "user.address.city".
 *
 * @param obj - The object to get the value from
 * @param path - The dot-notation path (e.g., "user.email")
 * @returns The value at the path, or undefined if not found
 */
const getNestedValue = (obj: RuleContext, path: string): unknown => {
  const keys = path.split('.').filter(Boolean);

  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return current;
};

/**
 * Evaluates whether a context matches all rules.
 *
 * @param rules - Array of rules to evaluate
 * @param context - Context with custom fields (pre-validated JSON Schema data)
 * @returns true if context matches all rules, false otherwise
 */
export const isEligible = (rules: Rule[], context: RuleContext): boolean => {
  if (rules.length === 0) return true;

  return rules.every(rule => {
    switch (rule.operator) {
      case 'equals':
        return getNestedValue(context, rule.field) === rule.value;

      case 'not_equals':
        return getNestedValue(context, rule.field) !== rule.value;

      case 'greater_than': {
        const fieldValue = getNestedValue(context, rule.field);

        if (isNullish(fieldValue) || isNullish(rule.value)) return false;

        // Only compare values of the same type
        if (areBothNumbers(fieldValue, rule.value)) {
          return fieldValue > rule.value;
        }
        if (areBothStrings(fieldValue, rule.value)) {
          return fieldValue > rule.value;
        }
        if (areBothDates(fieldValue, rule.value)) {
          return fieldValue > rule.value;
        }

        // Incompatible types - cannot compare
        return false;
      }

      case 'less_than': {
        const fieldValue = getNestedValue(context, rule.field);

        if (isNullish(fieldValue) || isNullish(rule.value)) return false;

        // Only compare values of the same type
        if (areBothNumbers(fieldValue, rule.value)) {
          return fieldValue < rule.value;
        }
        if (areBothStrings(fieldValue, rule.value)) {
          return fieldValue < rule.value;
        }
        if (areBothDates(fieldValue, rule.value)) {
          return fieldValue < rule.value;
        }

        // Incompatible types - cannot compare
        return false;
      }

      case 'contains': {
        const fieldValue = getNestedValue(context, rule.field);

        // String contains string
        if (isString(fieldValue) && isString(rule.value)) {
          return fieldValue.includes(rule.value);
        }

        // Array contains value
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(rule.value);
        }

        // Incompatible types
        return false;
      }

      case 'not_contains': {
        const fieldValue = getNestedValue(context, rule.field);

        // String does not contain string
        if (isString(fieldValue) && isString(rule.value)) {
          return !fieldValue.includes(rule.value);
        }

        // Array does not contain value
        if (Array.isArray(fieldValue)) {
          return !fieldValue.includes(rule.value);
        }

        // Incompatible types - cannot determine containment
        return false;
      }

      case 'in': {
        const fieldValue = getNestedValue(context, rule.field);

        return Array.isArray(rule.value) && rule.value.indexOf(fieldValue) !== -1;
      }

      case 'not_in': {
        const fieldValue = getNestedValue(context, rule.field);

        return Array.isArray(rule.value) && rule.value.indexOf(fieldValue) === -1;
      }

      default:
        return false;
    }
  });
};
