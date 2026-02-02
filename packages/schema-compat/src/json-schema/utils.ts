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
 * Check if a JSON Schema represents a boolean type
 */
export function isBooleanSchema(schema: JSONSchema7): boolean {
  return hasType(schema, 'boolean');
}

/**
 * Check if a JSON Schema represents a null type
 */
export function isNullSchema(schema: JSONSchema7): boolean {
  return hasType(schema, 'null');
}

/**
 * Check if a JSON Schema is nullable (has null in type array or uses anyOf/oneOf with null)
 */
export function isNullableSchema(schema: JSONSchema7): boolean {
  // Check if type array includes null
  if (Array.isArray(schema.type) && schema.type.includes('null')) {
    return true;
  }

  // Check anyOf pattern: [{type: X}, {type: "null"}]
  if (schema.anyOf && Array.isArray(schema.anyOf)) {
    return schema.anyOf.some(s => typeof s === 'object' && s !== null && (s as JSONSchema7).type === 'null');
  }

  // Check oneOf pattern
  if (schema.oneOf && Array.isArray(schema.oneOf)) {
    return schema.oneOf.some(s => typeof s === 'object' && s !== null && (s as JSONSchema7).type === 'null');
  }

  return false;
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
 * Check if a JSON Schema uses allOf
 */
export function isAllOfSchema(schema: JSONSchema7): schema is JSONSchema7 & { allOf: JSONSchema7[] } {
  return Array.isArray(schema.allOf) && schema.allOf.length > 0;
}

/**
 * Check if a JSON Schema is a union type (anyOf or oneOf)
 */
export function isUnionSchema(schema: JSONSchema7): boolean {
  return isAnyOfSchema(schema) || isOneOfSchema(schema);
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

/**
 * Get the non-null type from a nullable schema
 * Returns the schema without the null type
 */
export function getNonNullType(schema: JSONSchema7): JSONSchema7 | null {
  // Handle type array with null
  if (Array.isArray(schema.type)) {
    const nonNullTypes = schema.type.filter(t => t !== 'null');
    if (nonNullTypes.length === 1) {
      return { ...schema, type: nonNullTypes[0] };
    } else if (nonNullTypes.length > 1) {
      return { ...schema, type: nonNullTypes as JSONSchema7['type'] };
    }
    return null;
  }

  // Handle anyOf pattern
  if (schema.anyOf && Array.isArray(schema.anyOf) && schema.anyOf.length === 2) {
    const nonNull = schema.anyOf.find(s => typeof s === 'object' && s !== null && (s as JSONSchema7).type !== 'null');
    if (nonNull && typeof nonNull === 'object') {
      return nonNull as JSONSchema7;
    }
  }

  // Handle oneOf pattern
  if (schema.oneOf && Array.isArray(schema.oneOf) && schema.oneOf.length === 2) {
    const nonNull = schema.oneOf.find(s => typeof s === 'object' && s !== null && (s as JSONSchema7).type !== 'null');
    if (nonNull && typeof nonNull === 'object') {
      return nonNull as JSONSchema7;
    }
  }

  return null;
}
