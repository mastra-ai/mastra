import { zodToJsonSchema as schemaCompatZodToJsonSchema } from '@mastra/schema-compat/zod-to-json';
import type { JSONSchema7 } from 'json-schema';
import type { ZodType } from 'zod';

/**
 * Check if a value is a Zod schema type.
 * This is a simple check that doesn't require any Node.js dependencies.
 */
function isZodType(value: unknown): value is ZodType {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_def' in value &&
    'parse' in value &&
    typeof (value as any).parse === 'function' &&
    'safeParse' in value &&
    typeof (value as any).safeParse === 'function'
  );
}

/**
 * Check if a value is a ZodObject type (compatible with both Zod v3 and v4).
 */
function isZodObject(value: unknown): boolean {
  if (!isZodType(value)) return false;

  const valueAny = value as any;

  // Zod v3: _def.typeName === 'ZodObject'
  if (valueAny._def?.typeName === 'ZodObject') return true;

  // Zod v4: _def.type === 'object' or _zod.def.type === 'object'
  if (valueAny._def?.type === 'object') return true;
  if (valueAny._zod?.def?.type === 'object') return true;

  return false;
}

/**
 * Ensures that object schemas have type: 'object' at the root level.
 * This is required for AWS Bedrock compatibility.
 */
function ensureObjectType(schema: JSONSchema7): JSONSchema7 {
  if (typeof schema !== 'object' || schema === null) {
    return schema;
  }

  const result = { ...schema };

  // If the schema has properties but no type, add type: 'object'
  if (result.properties !== undefined && result.type === undefined) {
    result.type = 'object';
  }

  // If the schema has additionalProperties but no type, add type: 'object'
  if (result.additionalProperties !== undefined && result.type === undefined) {
    result.type = 'object';
  }

  // Recursively fix nested schemas in properties
  if (result.properties) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, value]) => [key, ensureObjectType(value as JSONSchema7)]),
    );
  }

  // Recursively fix items in arrays
  if (result.items) {
    if (Array.isArray(result.items)) {
      result.items = result.items.map(item => ensureObjectType(item as JSONSchema7));
    } else {
      result.items = ensureObjectType(result.items as JSONSchema7);
    }
  }

  // Recursively fix anyOf/oneOf/allOf schemas
  if (result.anyOf && Array.isArray(result.anyOf)) {
    result.anyOf = result.anyOf.map(s => ensureObjectType(s as JSONSchema7));
  }
  if (result.oneOf && Array.isArray(result.oneOf)) {
    result.oneOf = result.oneOf.map(s => ensureObjectType(s as JSONSchema7));
  }
  if (result.allOf && Array.isArray(result.allOf)) {
    result.allOf = result.allOf.map(s => ensureObjectType(s as JSONSchema7));
  }

  return result;
}

/**
 * Converts a Zod schema to JSON Schema, or passes through non-Zod values unchanged.
 *
 * Uses the schema-compat implementation which includes:
 * - Zod v4 z.record() bug fix
 * - Date to date-time format conversion
 * - Handling of unrepresentable types
 *
 * Additionally ensures that object schemas have type: 'object' for AWS Bedrock compatibility.
 */
export function zodToJsonSchema<T extends ZodType | any>(zodSchema: T) {
  if (!isZodType(zodSchema)) {
    return zodSchema;
  }

  const jsonSchema = schemaCompatZodToJsonSchema(zodSchema);

  // For ZodObject schemas, ensure the root type is 'object'
  // This is required for AWS Bedrock which expects type: 'object' at the root
  if (isZodObject(zodSchema)) {
    if (typeof jsonSchema === 'object' && jsonSchema !== null && jsonSchema.type !== 'object') {
      return ensureObjectType({ ...jsonSchema, type: 'object' });
    }
  }

  return ensureObjectType(jsonSchema);
}
