import { jsonSchema, Schema } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema } from 'zod';
import { z } from 'zod';
import { convertJsonSchemaToZod } from 'zod-from-json-schema';
import type { JSONSchema as ZodFromJSONSchema_JSONSchema } from 'zod-from-json-schema';
import type { Targets } from 'zod-to-json-schema';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { SchemaCompatibility } from './schema-compatibility';

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
 * import { convertZodSchemaToAISDKSchema } from '@mastra/schema';
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
export function convertZodSchemaToAISDKSchema(zodSchema: ZodSchema, target: Targets = 'jsonSchema7') {
  return jsonSchema(
    zodToJsonSchema(zodSchema, {
      $refStrategy: 'none',
      target,
    }) as JSONSchema7,
    {
      validate: value => {
        const result = zodSchema.safeParse(value);
        return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
      },
    },
  );
}

/**
 * Checks if a value is a Zod type by examining its properties and methods.
 *
 * @param value - The value to check
 * @returns True if the value is a Zod type, false otherwise
 * @internal
 */
function isZodType(value: unknown): value is z.ZodType {
  // Check if it's a Zod schema by looking for common Zod properties and methods
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
 * import { convertSchemaToZod } from '@mastra/schema';
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
export function convertSchemaToZod(schema: Schema | z.ZodSchema): z.ZodType {
  if (isZodType(schema)) {
    return schema;
  } else {
    const jsonSchemaToConvert = ('jsonSchema' in schema ? schema.jsonSchema : schema) as ZodFromJSONSchema_JSONSchema;
    try {
      return convertJsonSchemaToZod(jsonSchemaToConvert);
    } catch (e: unknown) {
      const errorMessage = `[Schema Builder] Failed to convert Vercel tool JSON schema parameters to Zod. Original schema: ${JSON.stringify(jsonSchemaToConvert)}`;
      console.error(errorMessage, e);
      throw new Error(errorMessage + (e instanceof Error ? `\n${e.stack}` : '\nUnknown error object'));
    }
  }
}

/**
 * Processes a schema using provider compatibility layers and converts it to the specified format.
 *
 * This function automatically applies the first matching compatibility layer from the provided
 * list based on the model configuration. If no compatibility applies, it falls back to
 * standard conversion.
 *
 * @param options - Configuration object for schema processing
 * @param options.schema - The schema to process (AI SDK Schema or Zod object schema)
 * @param options.compatibilities - Array of compatibility layers to try
 * @param options.mode - Output format: 'jsonSchema' for JSONSchema7 or 'aiSdkSchema' for AI SDK Schema
 * @returns Processed schema in the requested format
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { processSchema, OpenAISchemaCompat, AnthropicSchemaCompat } from '@mastra/schema';
 *
 * const schema = z.object({
 *   query: z.string().email(),
 *   limit: z.number().min(1).max(100)
 * });
 *
 * const compatibilities = [
 *   new OpenAISchemaCompat(model),
 *   new AnthropicSchemaCompat(model)
 * ];
 *
 * const result = processSchema({
 *   schema,
 *   compatibilities,
 *   mode: 'aiSdkSchema'
 * });
 * ```
 */
export function processSchema({
  schema,
  compatibilities,
  mode,
}: {
  schema: Schema | z.AnyZodObject;
  compatibilities: SchemaCompatibility[];
  mode: 'jsonSchema' | 'aiSdkSchema';
}): JSONSchema7 | Schema {
  let zodSchema: z.AnyZodObject;

  if (!isZodType(schema)) {
    // Convert Schema to ZodObject
    const convertedSchema = convertSchemaToZod(schema);
    if (convertedSchema instanceof z.ZodObject) {
      zodSchema = convertedSchema;
    } else {
      // If it's not an object schema, wrap it in an object
      zodSchema = z.object({ value: convertedSchema });
    }
  } else {
    // Ensure it's a ZodObject
    if (schema instanceof z.ZodObject) {
      zodSchema = schema;
    } else {
      // Wrap non-object schemas in an object
      zodSchema = z.object({ value: schema });
    }
  }

  for (const compat of compatibilities) {
    if (compat.shouldApply()) {
      return mode === 'jsonSchema' ? compat.processToJSONSchema(zodSchema) : compat.processtoAISDKSchema(zodSchema);
    }
  }

  // If no compatibility applied, convert back to appropriate format
  if (mode === 'jsonSchema') {
    return zodToJsonSchema(zodSchema, { $refStrategy: 'none', target: 'jsonSchema7' }) as JSONSchema7;
  } else {
    return convertZodSchemaToAISDKSchema(zodSchema);
  }
}
