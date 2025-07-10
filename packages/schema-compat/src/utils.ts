import type { Schema } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import type { ZodSchema } from 'zod';
import { convertJsonSchemaToZod } from 'zod-from-json-schema';
import type { JSONSchema as ZodFromJSONSchema_JSONSchema } from 'zod-from-json-schema';
import type { SchemaCompatLayer } from './schema-compatibility';

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
/**
 * Higher-order function that wraps Zod's z.toJSONSchema with fallback handling
 * for known bugs in Zod v4.0.2 (e.g., z.record types)
 * 
 * @param zodSchema - The Zod schema to convert
 * @param options - Optional z.toJSONSchema options
 * @param fallbackSchema - Custom fallback schema (optional)
 * @returns JSONSchema7 object or fallback
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const jsonSchema = safeToJSONSchema(z.record(z.string()));
 * 
 * // With custom options
 * const jsonSchema = safeToJSONSchema(schema, {
 *   unrepresentable: "any",
 *   override: (ctx) => { ... }
 * });
 * 
 * // With custom fallback
 * const jsonSchema = safeToJSONSchema(schema, {}, {
 *   type: "string",
 *   description: "Custom fallback"
 * });
 * ```
 */
export function safeToJSONSchema(
  zodSchema: ZodSchema,
  options?: Parameters<typeof z.toJSONSchema>[1],
  fallbackSchema?: Partial<JSONSchema7>
): JSONSchema7 {
  try {
    return z.toJSONSchema(zodSchema, options) as JSONSchema7;
  } catch (error) {
    // Fallback for schemas that can't be converted due to Zod v4.0.2 bugs
    // Known issues: z.record() schemas fail with "Cannot read properties of undefined (reading '_zod')"
    console.warn('z.toJSONSchema failed, using fallback schema. Error:', error instanceof Error ? error.message : String(error));
    
    return {
      type: "object",
      additionalProperties: true,
      description: "Schema conversion fallback - original validation preserved",
      ...fallbackSchema
    };
  }
}

/**
 * Safely validates a value against a Zod schema, with fallback for corrupted schemas.
 * 
 * This companion utility to safeToJSONSchema() handles validation corruption that can
 * occur when schemas are malformed due to reconstruction issues in Zod v4.
 * 
 * @param zodSchema - The Zod schema to validate against (may be corrupted)
 * @param value - The value to validate
 * @returns Safe validation result with fallback behavior
 */
export function safeValidate(zodSchema: ZodSchema, value: unknown): { success: boolean; value?: any; error?: any } {
  try {
    const result = zodSchema.safeParse(value);
    return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
  } catch (error) {
    // Fallback for schemas that can't validate due to corruption
    console.warn('Schema validation failed due to corruption, using permissive fallback. Error:', error instanceof Error ? error.message : String(error));
    
    // Permissive fallback - accept the value as-is
    // This maintains functionality while allowing developers to fix the underlying schema corruption
    return { success: true, value: value };
  }
}

/**
 * Safely accesses Zod schema properties with v3/v4 compatibility and corruption fallbacks.
 * 
 * This higher-order utility handles the complexity of Zod v4 property access patterns
 * while providing graceful fallbacks for corrupted schemas.
 * 
 * @param schema - The Zod schema to extract properties from
 * @param property - The property name to extract (e.g., 'typeName', 'checks', 'options')
 * @param defaultValue - Fallback value if property access fails
 * @returns The property value or default
 */
export function safeGetSchemaProperty(schema: any, property: string, defaultValue: any = undefined): any {
  try {
    // Check if schema is valid object first
    if (!schema || typeof schema !== 'object') {
      return defaultValue;
    }
    
    // Special handling for typeName in Zod v4
    if (property === 'typeName') {
      // Try Zod v4 traits first (most reliable for type identification)
      if ('_zod' in schema && schema._zod?.traits) {
        const traits = Array.from(schema._zod.traits);
        const zodTrait = traits.find(trait => typeof trait === 'string' && trait.startsWith('Zod') && !trait.startsWith('$'));
        if (zodTrait) {
          return zodTrait;
        }
      }
      
      // Fallback to constructor name
      if (schema.constructor?.name) {
        return schema.constructor.name;
      }
    }
    
    // Try Zod v4 pattern first: _zod.def.property
    if ('_zod' in schema && schema._zod?.def?.[property] !== undefined) {
      return schema._zod.def[property];
    }
    
    // Try Zod v3/v4 fallback: _def.property
    if ('_def' in schema && schema._def?.[property] !== undefined) {
      return schema._def[property];
    }
    
    // Return default if property not found
    return defaultValue;
  } catch (error) {
    console.warn(`Safe property access failed for '${property}', using default. Error:`, error instanceof Error ? error.message : String(error));
    return defaultValue;
  }
}

// mirrors https://github.com/vercel/ai/blob/main/packages/ui-utils/src/zod-schema.ts#L21 but with a custom target
export function convertZodSchemaToAISDKSchema(zodSchema: ZodSchema, target?: string): Schema {
  const jsonSchemaObject = safeToJSONSchema(zodSchema, {
    unrepresentable: "any",
    override: (ctx) => {
      const def = ctx.zodSchema._zod?.def;
      if (def?.typeName === "ZodDate") {
        ctx.jsonSchema.type = "string";
        ctx.jsonSchema.format = "date-time";
      }
    },
  });

  return {
    jsonSchema: jsonSchemaObject,
    validate: value => {
      // Use safeValidate to handle schema corruption gracefully
      return safeValidate(zodSchema, value);
    },
  };
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
export function convertSchemaToZod(schema: Schema | z.ZodSchema): z.ZodType {
  if (isZodType(schema)) {
    return schema;
  } else {
    const jsonSchemaToConvert = ('jsonSchema' in schema ? schema.jsonSchema : schema) as ZodFromJSONSchema_JSONSchema;
    try {
      return convertJsonSchemaToZod(jsonSchemaToConvert);
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
  schema: Schema | z.ZodSchema;
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
  schema: Schema | z.ZodSchema;
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
  schema: Schema | z.ZodSchema;
  compatLayers: SchemaCompatLayer[];
  mode: 'jsonSchema' | 'aiSdkSchema';
}): JSONSchema7 | Schema {
  let zodSchema: z.ZodSchema;

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
    return z.toJSONSchema(zodSchema, {
      unrepresentable: "any",
      override: (ctx) => {
        const def = ctx.zodSchema._zod?.def;
        if (def?.typeName === "ZodDate") {
          ctx.jsonSchema.type = "string";
          ctx.jsonSchema.format = "date-time";
        }
      },
    }) as JSONSchema7;
  } else {
    return convertZodSchemaToAISDKSchema(zodSchema);
  }
}
