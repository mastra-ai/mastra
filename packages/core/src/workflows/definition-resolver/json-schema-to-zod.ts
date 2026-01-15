/**
 * Converts JSON Schema objects to Zod schemas at runtime.
 *
 * This is used to convert the inputSchema/outputSchema of workflow definitions
 * (stored as JSON Schema) to Zod schemas for validation.
 */

import { z, type ZodType } from 'zod';

/**
 * Converts a JSON Schema object to a Zod schema.
 *
 * Supports common JSON Schema types:
 * - string (with minLength, maxLength, pattern, enum, format)
 * - number, integer (with minimum, maximum, exclusiveMinimum, exclusiveMaximum)
 * - boolean
 * - null
 * - array (with items, minItems, maxItems)
 * - object (with properties, required, additionalProperties)
 * - anyOf, oneOf, allOf unions
 *
 * @param schema - A JSON Schema object
 * @returns A Zod schema that validates the same shape
 *
 * @example
 * const jsonSchema = {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string', minLength: 1 },
 *     age: { type: 'integer', minimum: 0 }
 *   },
 *   required: ['name']
 * };
 *
 * const zodSchema = jsonSchemaToZod(jsonSchema);
 * zodSchema.parse({ name: 'John', age: 25 }); // Valid
 */
export function jsonSchemaToZod(schema: Record<string, unknown>): ZodType {
  // Handle empty or missing schema
  if (!schema || Object.keys(schema).length === 0) {
    return z.unknown();
  }

  const type = schema.type as string | string[] | undefined;

  // Handle type arrays (e.g., ["string", "null"])
  if (Array.isArray(type)) {
    const types = type.map(t => jsonSchemaToZod({ ...schema, type: t }));
    if (types.length === 0) return z.unknown();
    if (types.length === 1) return types[0]!;
    return z.union(types as [ZodType, ZodType, ...ZodType[]]);
  }

  // Handle union types first (anyOf, oneOf, allOf)
  if (schema.anyOf) {
    const schemas = (schema.anyOf as Record<string, unknown>[]).map(s => jsonSchemaToZod(s));
    if (schemas.length === 0) return z.unknown();
    if (schemas.length === 1) return schemas[0]!;
    return z.union(schemas as [ZodType, ZodType, ...ZodType[]]);
  }

  if (schema.oneOf) {
    const schemas = (schema.oneOf as Record<string, unknown>[]).map(s => jsonSchemaToZod(s));
    if (schemas.length === 0) return z.unknown();
    if (schemas.length === 1) return schemas[0]!;
    return z.union(schemas as [ZodType, ZodType, ...ZodType[]]);
  }

  if (schema.allOf) {
    const schemas = (schema.allOf as Record<string, unknown>[]).map(s => jsonSchemaToZod(s));
    if (schemas.length === 0) return z.unknown();
    return schemas.reduce((acc, s) => acc.and(s)) as ZodType;
  }

  // Handle const
  if ('const' in schema) {
    return z.literal(schema.const as string | number | boolean);
  }

  // Handle by type
  switch (type) {
    case 'string':
      return buildStringSchema(schema);
    case 'number':
      return buildNumberSchema(schema, false);
    case 'integer':
      return buildNumberSchema(schema, true);
    case 'boolean':
      return z.boolean();
    case 'null':
      return z.null();
    case 'array':
      return buildArraySchema(schema);
    case 'object':
      return buildObjectSchema(schema);
    default:
      // No type specified - try to infer or return unknown
      if (schema.properties) {
        return buildObjectSchema(schema);
      }
      if (schema.items) {
        return buildArraySchema(schema);
      }
      if (schema.enum) {
        return buildEnumSchema(schema);
      }
      return z.unknown();
  }
}

/**
 * Builds a Zod string schema from JSON Schema.
 */
function buildStringSchema(schema: Record<string, unknown>): ZodType {
  // Handle enum first
  if (schema.enum) {
    const enumValues = schema.enum as string[];
    if (enumValues.length === 0) return z.never();
    if (enumValues.length === 1) return z.literal(enumValues[0]!);
    return z.enum(enumValues as [string, ...string[]]);
  }

  let zodSchema = z.string();

  if (typeof schema.minLength === 'number') {
    zodSchema = zodSchema.min(schema.minLength);
  }
  if (typeof schema.maxLength === 'number') {
    zodSchema = zodSchema.max(schema.maxLength);
  }
  if (typeof schema.pattern === 'string') {
    zodSchema = zodSchema.regex(new RegExp(schema.pattern));
  }

  // Handle common formats
  if (schema.format === 'email') {
    zodSchema = zodSchema.email();
  } else if (schema.format === 'uri' || schema.format === 'url') {
    zodSchema = zodSchema.url();
  } else if (schema.format === 'uuid') {
    zodSchema = zodSchema.uuid();
  } else if (schema.format === 'date-time') {
    zodSchema = zodSchema.datetime();
  }

  return zodSchema;
}

/**
 * Builds a Zod number schema from JSON Schema.
 */
function buildNumberSchema(schema: Record<string, unknown>, isInteger: boolean): ZodType {
  let zodSchema = z.number();

  if (isInteger) {
    zodSchema = zodSchema.int();
  }

  if (typeof schema.minimum === 'number') {
    zodSchema = zodSchema.min(schema.minimum);
  }
  if (typeof schema.maximum === 'number') {
    zodSchema = zodSchema.max(schema.maximum);
  }
  if (typeof schema.exclusiveMinimum === 'number') {
    zodSchema = zodSchema.gt(schema.exclusiveMinimum);
  }
  if (typeof schema.exclusiveMaximum === 'number') {
    zodSchema = zodSchema.lt(schema.exclusiveMaximum);
  }
  if (typeof schema.multipleOf === 'number') {
    zodSchema = zodSchema.multipleOf(schema.multipleOf);
  }

  // Handle enum for numbers
  if (schema.enum) {
    const enumValues = schema.enum as number[];
    if (enumValues.length === 0) return z.never();
    if (enumValues.length === 1) return z.literal(enumValues[0]!);
    const literals = enumValues.map(v => z.literal(v));
    return z.union([literals[0]!, literals[1]!, ...literals.slice(2)]);
  }

  return zodSchema;
}

/**
 * Builds a Zod array schema from JSON Schema.
 */
function buildArraySchema(schema: Record<string, unknown>): ZodType {
  const items = schema.items as Record<string, unknown> | undefined;
  const itemSchema = items ? jsonSchemaToZod(items) : z.unknown();

  let zodSchema = z.array(itemSchema);

  if (typeof schema.minItems === 'number') {
    zodSchema = zodSchema.min(schema.minItems);
  }
  if (typeof schema.maxItems === 'number') {
    zodSchema = zodSchema.max(schema.maxItems);
  }

  return zodSchema;
}

/**
 * Builds a Zod object schema from JSON Schema.
 */
function buildObjectSchema(schema: Record<string, unknown>): ZodType {
  const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
  const required = (schema.required as string[]) || [];
  const additionalProperties = schema.additionalProperties;

  if (!properties) {
    // No properties defined
    if (additionalProperties === false) {
      return z.object({}).strict();
    }
    if (typeof additionalProperties === 'object') {
      return z.record(jsonSchemaToZod(additionalProperties as Record<string, unknown>));
    }
    return z.record(z.unknown());
  }

  const shape: Record<string, ZodType> = {};

  for (const [key, propSchema] of Object.entries(properties)) {
    let zodProp = jsonSchemaToZod(propSchema);

    // Preserve the property description for LLM context
    const propDescription = propSchema.description as string | undefined;
    if (propDescription) {
      zodProp = zodProp.describe(propDescription);
    }

    if (!required.includes(key)) {
      zodProp = zodProp.optional();
    }
    shape[key] = zodProp;
  }

  let zodSchema: ZodType = z.object(shape);

  // Handle additionalProperties
  if (additionalProperties === false) {
    zodSchema = (zodSchema as z.ZodObject<any>).strict();
  } else if (additionalProperties !== undefined && additionalProperties !== true) {
    zodSchema = (zodSchema as z.ZodObject<any>).catchall(
      jsonSchemaToZod(additionalProperties as Record<string, unknown>),
    );
  }

  // Preserve the schema-level description
  const schemaDescription = schema.description as string | undefined;
  if (schemaDescription) {
    zodSchema = zodSchema.describe(schemaDescription);
  }

  return zodSchema;
}

/**
 * Builds a Zod enum schema from JSON Schema.
 */
function buildEnumSchema(schema: Record<string, unknown>): ZodType {
  const enumValues = schema.enum as unknown[];
  if (!enumValues || enumValues.length === 0) {
    return z.never();
  }

  // Check if all values are strings
  if (enumValues.every(v => typeof v === 'string')) {
    if (enumValues.length === 1) return z.literal(enumValues[0] as string);
    return z.enum(enumValues as [string, ...string[]]);
  }

  // Mixed types - use union of literals
  if (enumValues.length === 1) {
    return z.literal(enumValues[0] as string | number | boolean);
  }
  const literals = enumValues.map(v => z.literal(v as string | number | boolean));
  return z.union([literals[0]!, literals[1]!, ...literals.slice(2)]);
}

export default jsonSchemaToZod;
