import type { JsonSchema, JsonSchemaProperty } from '@/lib/json-schema';

/**
 * Represents a variable completion option derived from a schema
 */
export interface VariableCompletion {
  /** The dot-notation path (e.g., "user.name") */
  path: string;
  /** Display label for the autocomplete */
  label: string;
  /** Description from the schema, if available */
  description?: string;
  /** The type of the property */
  type?: string;
}

/**
 * Flattens a JSON Schema into a list of variable completions for autocomplete.
 * Recursively extracts property paths using dot-notation.
 *
 * @param schema - The JSON Schema to flatten
 * @param maxDepth - Maximum recursion depth (default: 5)
 * @returns Array of variable completions
 *
 * @example
 * ```ts
 * const schema = {
 *   type: 'object',
 *   properties: {
 *     user: {
 *       type: 'object',
 *       properties: {
 *         name: { type: 'string' },
 *         email: { type: 'string' }
 *       }
 *     }
 *   }
 * };
 *
 * flattenSchemaToVariables(schema);
 * // Returns:
 * // [
 * //   { path: 'user', label: 'user', type: 'object' },
 * //   { path: 'user.name', label: 'user.name', type: 'string' },
 * //   { path: 'user.email', label: 'user.email', type: 'string' }
 * // ]
 * ```
 */
export function flattenSchemaToVariables(schema: JsonSchema | undefined, maxDepth = 5): VariableCompletion[] {
  if (!schema?.properties) {
    return [];
  }

  const results: VariableCompletion[] = [];

  function processProperty(property: JsonSchemaProperty, path: string, depth: number): void {
    if (depth > maxDepth) {
      return;
    }

    const type = Array.isArray(property.type) ? property.type.join(' | ') : property.type;

    results.push({
      path,
      label: path,
      description: property.description ?? property.title,
      type,
    });

    // Recurse into nested object properties
    if (property.properties) {
      for (const [key, nestedProperty] of Object.entries(property.properties)) {
        processProperty(nestedProperty, `${path}.${key}`, depth + 1);
      }
    }

    // Handle array items if they have properties (array of objects)
    if (property.items?.properties) {
      // Add a placeholder for array item access (e.g., items[0].name)
      for (const [key, itemProperty] of Object.entries(property.items.properties)) {
        processProperty(itemProperty, `${path}[].${key}`, depth + 1);
      }
    }
  }

  for (const [key, property] of Object.entries(schema.properties)) {
    processProperty(property, key, 1);
  }

  return results;
}
