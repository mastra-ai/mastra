import type { JsonSchema, JsonSchemaProperty } from '@/lib/json-schema';

const MAX_DEPTH = 10;

/**
 * Generates a default value for a single property based on its type
 */
function generatePropertyDefault(property: JsonSchemaProperty, depth: number): unknown {
  // Return explicit default if provided
  if (property.default !== undefined) {
    return property.default;
  }

  // Guard against circular references
  if (depth >= MAX_DEPTH) {
    return undefined;
  }

  const type = Array.isArray(property.type) ? property.type[0] : property.type;

  switch (type) {
    case 'string':
      return '';
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object':
      if (property.properties) {
        return generateObjectDefaults(property.properties, depth + 1);
      }
      return {};
    case 'null':
      return null;
    default:
      return '';
  }
}

/**
 * Generates default values for an object's properties
 */
function generateObjectDefaults(
  properties: Record<string, JsonSchemaProperty>,
  depth: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, property] of Object.entries(properties)) {
    result[key] = generatePropertyDefault(property, depth);
  }

  return result;
}

/**
 * Generates default values from a JSON Schema.
 *
 * For each property:
 * - Uses `default` value if specified in schema
 * - Otherwise generates a placeholder based on type:
 *   - string → ""
 *   - number/integer → 0
 *   - boolean → false
 *   - array → []
 *   - object → recurses into nested properties
 *   - null → null
 *
 * @param schema - JSON Schema definition
 * @returns Object with default values for all properties
 */
export function generateDefaultValues(schema: JsonSchema | undefined): Record<string, unknown> {
  if (!schema || !schema.properties) {
    return {};
  }

  return generateObjectDefaults(schema.properties, 0);
}
