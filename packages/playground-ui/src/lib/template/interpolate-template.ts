import { VARIABLE_PATTERN } from '@/ds/components/CodeEditor';

/**
 * Gets a nested value from an object using dot notation path
 * Returns undefined if any part of the path is missing
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Converts a value to string representation
 * Handles null, undefined, and non-primitive types
 */
function valueToString(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Replaces {{variable}} placeholders in a template with actual values from the variables object.
 *
 * Supports dot-notation paths (e.g., {{user.name}}) for nested object access.
 * If a variable is not found, the placeholder is kept as-is (e.g., {{missingVar}}).
 *
 * @param template - The template string containing {{variable}} placeholders
 * @param variables - Object containing variable values
 * @returns The template with placeholders replaced by their values
 */
export function interpolateTemplate(template: string, variables: Record<string, unknown>): string {
  if (!template) return '';

  // Create a new regex instance to avoid global state issues
  const pattern = new RegExp(VARIABLE_PATTERN.source, 'g');

  return template.replace(pattern, (match, variablePath: string) => {
    const value = getNestedValue(variables, variablePath);

    // If variable not found, keep the placeholder as-is
    if (value === undefined) {
      return match;
    }

    return valueToString(value);
  });
}
