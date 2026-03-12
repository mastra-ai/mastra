import type { JSONSchema7, JSONSchema7TypeName } from 'json-schema';

/**
 * Type guard to check if a JSON Schema has a specific type
 */
function hasType(schema: JSONSchema7, type: JSONSchema7TypeName): boolean {
  if (schema.type === type) return true;
  if (Array.isArray(schema.type) && schema.type.includes(type)) return true;
  return false;
}

/**
 * Check if a JSON Schema represents an object type
 */
export function isObjectSchema(schema: JSONSchema7): boolean {
  return hasType(schema, 'object') || schema.properties !== undefined;
}

/**
 * Check if a JSON Schema represents an array type
 */
export function isArraySchema(schema: JSONSchema7): boolean {
  return hasType(schema, 'array') || schema.items !== undefined;
}

/**
 * Check if a JSON Schema represents a string type
 */
export function isStringSchema(schema: JSONSchema7): boolean {
  return hasType(schema, 'string');
}

/**
 * Check if a JSON Schema represents a number type (number or integer)
 */
export function isNumberSchema(schema: JSONSchema7): boolean {
  return hasType(schema, 'number') || hasType(schema, 'integer');
}

/**
 * Check if a JSON Schema uses anyOf
 */
export function isAnyOfSchema(schema: JSONSchema7): schema is JSONSchema7 & { anyOf: JSONSchema7[] } {
  return Array.isArray(schema.anyOf) && schema.anyOf.length > 0;
}

/**
 * Check if a JSON Schema uses oneOf
 */
export function isOneOfSchema(schema: JSONSchema7): schema is JSONSchema7 & { oneOf: JSONSchema7[] } {
  return Array.isArray(schema.oneOf) && schema.oneOf.length > 0;
}

/**
 * Check if a JSON Schema is a union type (anyOf or oneOf)
 */
export function isUnionSchema(schema: JSONSchema7): boolean {
  return isAnyOfSchema(schema) || isOneOfSchema(schema) || Array.isArray(schema.type);
}

/**
 * Check if a JSON Schema is an enum type
 */
export function isEnumSchema(schema: JSONSchema7): boolean {
  return Array.isArray(schema.enum) && schema.enum.length > 0;
}

/**
 * Check if a JSON Schema is a nullable type
 */
export function isNullableSchema(schema: JSONSchema7): boolean {
  return schema.type === 'null';
}

/**
 * Check if a JSON Schema has number constraints (minimum, maximum, etc.)
 */
export function hasNumberConstraints(schema: JSONSchema7): boolean {
  return (
    schema.minimum !== undefined ||
    schema.maximum !== undefined ||
    schema.exclusiveMinimum !== undefined ||
    schema.exclusiveMaximum !== undefined ||
    schema.multipleOf !== undefined
  );
}

/**
 * Check if a JSON Schema has string constraints (minLength, maxLength, pattern, format)
 */
export function hasStringConstraints(schema: JSONSchema7): boolean {
  return (
    schema.minLength !== undefined ||
    schema.maxLength !== undefined ||
    schema.pattern !== undefined ||
    schema.format !== undefined
  );
}

/**
 * Check if a JSON Schema has array constraints (minItems, maxItems, uniqueItems)
 */
export function hasArrayConstraints(schema: JSONSchema7): boolean {
  return schema.minItems !== undefined || schema.maxItems !== undefined || schema.uniqueItems !== undefined;
}

/**
 * Check if a property is optional within a parent object schema.
 * A property is optional if it's not in the parent's `required` array.
 * @param propertyName - The name of the property to check
 * @param parentSchema - The parent object schema containing the property
 */
export function isOptionalSchema(propertyName: string, parentSchema: JSONSchema7): boolean {
  if (!parentSchema.required || !Array.isArray(parentSchema.required)) {
    return true; // If no required array, all properties are optional
  }
  return !parentSchema.required.includes(propertyName);
}
