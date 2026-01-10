import { z } from 'zod';
import type { ZodSchema as ZodSchemaV3, ZodType as ZodTypeV3 } from 'zod/v3';
import type { ZodType as ZodSchemaV4, ZodType as ZodTypeV4 } from 'zod/v4';
import { convertJsonSchemaToZod } from 'zod-from-json-schema';
import { convertJsonSchemaToZod as convertJsonSchemaToZodV3 } from 'zod-from-json-schema-v3';
import type { Targets } from 'zod-to-json-schema';
import type { JSONSchema7, Schema } from './json-schema';
import { jsonSchema } from './json-schema';
import type { SchemaCompatLayer } from './schema-compatibility';
import { zodToJsonSchema } from './zod-to-json';

type ZodSchema = ZodSchemaV3 | ZodSchemaV4;
type ZodType = ZodTypeV3 | ZodTypeV4;

/**
 * Converts a Zod schema to an AI SDK Schema with validation support.
 *
 * This function mirrors the behavior of Vercel's AI SDK zod-schema utility but allows
 * customization of the JSON Schema target format.
 *
 * @param zodSchema - The Zod schema to convert
 * @param target - The JSON Schema target format (defaults to 'jsonSchema7')
 * @returns An AI SDK Schema object with built-in validation
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { convertZodSchemaToAISDKSchema } from '@mastra/schema-compat';
 *
 * const userSchema = z.object({
 *   name: z.string(),
 *   age: z.number().min(0)
 * });
 *
 * const aiSchema = convertZodSchemaToAISDKSchema(userSchema);
 * ```
 */
// mirrors https://github.com/vercel/ai/blob/main/packages/ui-utils/src/zod-schema.ts#L21 but with a custom target
export function convertZodSchemaToAISDKSchema(zodSchema: ZodSchema, target: Targets = 'jsonSchema7'): Schema<any> {
  const jsonSchemaToUse = zodToJsonSchema(zodSchema, target) as JSONSchema7;

  return jsonSchema(jsonSchemaToUse, {
    validate: value => {
      const result = zodSchema.safeParse(value);
      return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
    },
  });
}

/**
 * Checks if a value is a Zod type by examining its properties and methods.
 *
 * @param value - The value to check
 * @returns True if the value is a Zod type, false otherwise
 * @internal
 */
export function isZodType(value: unknown): value is ZodType {
  // Check if it's a Zod schema by looking for common Zod properties and methods
  // _def is used in Zod v3, _zod is used in Zod v4
  return (
    typeof value === 'object' &&
    value !== null &&
    ('_def' in value || '_zod' in value) &&
    'parse' in value &&
    typeof (value as any).parse === 'function' &&
    'safeParse' in value &&
    typeof (value as any).safeParse === 'function'
  );
}

/**
 * Checks if a value is a plain JSON Schema object.
 *
 * A plain JSON Schema is identified by:
 * - Being an object
 * - Having a 'type' property
 * - NOT being a Zod schema (no _def or parse methods)
 * - NOT being an AI SDK Schema (no jsonSchema property with nested structure)
 *
 * @param value - The value to check
 * @returns True if the value is a plain JSON Schema object, false otherwise
 *
 * @example
 * ```typescript
 * const jsonSchema = { type: 'object', properties: { name: { type: 'string' } } };
 * isPlainJSONSchema(jsonSchema); // true
 *
 * const zodSchema = z.object({ name: z.string() });
 * isPlainJSONSchema(zodSchema); // false
 * ```
 */
export function isPlainJSONSchema(value: unknown): value is JSONSchema7 {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  // Check it's not a Zod schema
  if (isZodType(value)) {
    return false;
  }

  // Check it's not an AI SDK Schema (which has a jsonSchema property)
  if ('jsonSchema' in value && typeof (value as any).jsonSchema === 'object') {
    return false;
  }

  // Check it has JSON Schema characteristics
  // Must have a type property (string or array for union types)
  if ('type' in value) {
    const type = (value as any).type;
    const validTypes = ['object', 'array', 'string', 'number', 'boolean', 'null', 'integer'];

    if (typeof type === 'string' && validTypes.includes(type)) {
      return true;
    }

    if (Array.isArray(type) && type.every(t => typeof t === 'string' && validTypes.includes(t))) {
      return true;
    }
  }

  // Also check for $schema which is common in JSON Schemas
  if ('$schema' in value && typeof (value as any).$schema === 'string') {
    return true;
  }

  return false;
}

/**
 * Converts an AI SDK Schema or Zod schema to a Zod schema.
 *
 * If the input is already a Zod schema, it returns it unchanged.
 * If the input is an AI SDK Schema, it extracts the JSON schema and converts it to Zod.
 *
 * @param schema - The schema to convert (AI SDK Schema or Zod schema)
 * @returns A Zod schema equivalent of the input
 * @throws Error if the conversion fails
 *
 * @example
 * ```typescript
 * import { jsonSchema } from 'ai';
 * import { convertSchemaToZod } from '@mastra/schema-compat';
 *
 * const aiSchema = jsonSchema({
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string' }
 *   }
 * });
 *
 * const zodSchema = convertSchemaToZod(aiSchema);
 * ```
 */
export function convertSchemaToZod(schema: Schema | ZodSchema | JSONSchema7): ZodType {
  if (isZodType(schema)) {
    return schema;
  } else {
    const jsonSchemaToConvert = 'jsonSchema' in schema ? schema.jsonSchema : schema;
    try {
      if ('toJSONSchema' in z) {
        // @ts-expect-error - type issue in convertJsonSchemaToZod
        return convertJsonSchemaToZod(jsonSchemaToConvert);
      } else {
        // @ts-expect-error - type issue in convertJsonSchemaToZodV3
        return convertJsonSchemaToZodV3(jsonSchemaToConvert);
      }
    } catch (e: unknown) {
      const errorMessage = `[Schema Builder] Failed to convert schema parameters to Zod. Original schema: ${JSON.stringify(jsonSchemaToConvert)}`;
      console.error(errorMessage, e);
      throw new Error(errorMessage + (e instanceof Error ? `\n${e.stack}` : '\nUnknown error object'));
    }
  }
}

/**
 * Processes a schema using provider compatibility layers and converts it to an AI SDK Schema.
 *
 * @param options - Configuration object for schema processing
 * @param options.schema - The schema to process (AI SDK Schema or Zod object schema)
 * @param options.compatLayers - Array of compatibility layers to try
 * @param options.mode - Must be 'aiSdkSchema'
 * @returns Processed schema as an AI SDK Schema
 */
export function applyCompatLayer(options: {
  schema: Schema | ZodSchema | JSONSchema7;
  compatLayers: SchemaCompatLayer[];
  mode: 'aiSdkSchema';
}): Schema;

/**
 * Processes a schema using provider compatibility layers and converts it to a JSON Schema.
 *
 * @param options - Configuration object for schema processing
 * @param options.schema - The schema to process (AI SDK Schema or Zod object schema)
 * @param options.compatLayers - Array of compatibility layers to try
 * @param options.mode - Must be 'jsonSchema'
 * @returns Processed schema as a JSONSchema7
 */
export function applyCompatLayer(options: {
  schema: Schema | ZodSchema | JSONSchema7;
  compatLayers: SchemaCompatLayer[];
  mode: 'jsonSchema';
}): JSONSchema7;

/**
 * Processes a schema using provider compatibility layers and converts it to the specified format.
 *
 * This function automatically applies the first matching compatibility layer from the provided
 * list based on the model configuration. If no compatibility applies, it falls back to
 * standard conversion.
 *
 * @param options - Configuration object for schema processing
 * @param options.schema - The schema to process (AI SDK Schema or Zod object schema)
 * @param options.compatLayers - Array of compatibility layers to try
 * @param options.mode - Output format: 'jsonSchema' for JSONSchema7 or 'aiSdkSchema' for AI SDK Schema
 * @returns Processed schema in the requested format
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { applyCompatLayer, OpenAISchemaCompatLayer, AnthropicSchemaCompatLayer } from '@mastra/schema-compat';
 *
 * const schema = z.object({
 *   query: z.string().email(),
 *   limit: z.number().min(1).max(100)
 * });
 *
 * const compatLayers = [
 *   new OpenAISchemaCompatLayer(model),
 *   new AnthropicSchemaCompatLayer(model)
 * ];
 *
 * const result = applyCompatLayer({
 *   schema,
 *   compatLayers,
 *   mode: 'aiSdkSchema'
 * });
 * ```
 */
export function applyCompatLayer({
  schema,
  compatLayers,
  mode,
}: {
  schema: Schema | ZodSchema | JSONSchema7;
  compatLayers: SchemaCompatLayer[];
  mode: 'jsonSchema' | 'aiSdkSchema';
}): JSONSchema7 | Schema {
  let zodSchema: ZodSchema;

  if (!isZodType(schema)) {
    // Convert non-zod schema to Zod
    zodSchema = convertSchemaToZod(schema);
  } else {
    zodSchema = schema;
  }

  for (const compat of compatLayers) {
    if (compat.shouldApply()) {
      return mode === 'jsonSchema' ? compat.processToJSONSchema(zodSchema) : compat.processToAISDKSchema(zodSchema);
    }
  }
  // If no compatibility applied, convert back to appropriate format
  if (mode === 'jsonSchema') {
    return zodToJsonSchema(zodSchema, 'jsonSchema7') as JSONSchema7;
  } else {
    return convertZodSchemaToAISDKSchema(zodSchema);
  }
}
