import type { Schema } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import { convertJsonSchemaToZod } from 'zod-from-json-schema';
import type { JSONSchema as ZodFromJSONSchema_JSONSchema } from 'zod-from-json-schema';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { SchemaCompatLayer } from './schema-compatibility';

// Official library authors guidance: Use version-specific imports
// Supports both v3 and v4 through proper import handling
import { z } from 'zod';

// Version detection following official guidance - cached for performance
let _isV4Runtime: boolean | null = null;
function isZodV4Runtime(): boolean {
  if (_isV4Runtime === null) {
    const testSchema = z.string();
    _isV4Runtime = '_zod' in testSchema;
  }
  return _isV4Runtime;
}

// TypeName constants to prevent magic string errors (addressing review comment)
export const ZOD_TYPE_NAMES = {
  ZodString: 'ZodString',
  ZodNumber: 'ZodNumber',
  ZodBigInt: 'ZodBigInt',
  ZodBoolean: 'ZodBoolean',
  ZodDate: 'ZodDate',
  ZodUndefined: 'ZodUndefined',
  ZodNull: 'ZodNull',
  ZodAny: 'ZodAny',
  ZodUnknown: 'ZodUnknown',
  ZodNever: 'ZodNever',
  ZodVoid: 'ZodVoid',
  ZodArray: 'ZodArray',
  ZodObject: 'ZodObject',
  ZodUnion: 'ZodUnion',
  ZodDiscriminatedUnion: 'ZodDiscriminatedUnion',
  ZodIntersection: 'ZodIntersection',
  ZodTuple: 'ZodTuple',
  ZodRecord: 'ZodRecord',
  ZodMap: 'ZodMap',
  ZodSet: 'ZodSet',
  ZodFunction: 'ZodFunction',
  ZodLazy: 'ZodLazy',
  ZodLiteral: 'ZodLiteral',
  ZodEnum: 'ZodEnum',
  ZodNativeEnum: 'ZodNativeEnum',
  ZodPromise: 'ZodPromise',
  ZodOptional: 'ZodOptional',
  ZodNullable: 'ZodNullable',
  ZodDefault: 'ZodDefault',
  ZodCatch: 'ZodCatch',
  ZodPreprocess: 'ZodPreprocess',
  ZodEffects: 'ZodEffects',
  ZodBranded: 'ZodBranded',
  ZodPipeline: 'ZodPipeline',
  ZodReadonly: 'ZodReadonly',
  // v4 specific types
  ZodEmail: 'ZodEmail',
  ZodURL: 'ZodURL',
  ZodUUID: 'ZodUUID',
  ZodCUID: 'ZodCUID',
  ZodIP: 'ZodIP',
} as const;

// Type definitions for dual version compatibility (official guidance)
type ZodSchema = z.ZodSchema<any, any, any>;
type ZodTypeAny = z.ZodTypeAny;

// ==================== SIMPLE VERSION DETECTION ====================
// Following official zod.dev/library-authors guidance

/**
 * Official library authors pattern for version detection
 * @param schema - The schema to check
 * @returns true if Zod v4 schema, false if Zod v3 schema
 */
function isZodV4Schema(schema: any): boolean {
  return schema && typeof schema === 'object' && '_zod' in schema;
}

// ==================== SIMPLIFIED JSON SCHEMA CONVERSION ====================
// Direct approach following official guidance

/**
 * Convert Zod schemas to JSON Schema with dual v3/v4 support
 */
// Helper function to recursively preserve descriptions in JSON schema
function preserveDescriptions(jsonSchema: JSONSchema7, zodSchema: ZodSchema): void {
  // Preserve top-level description
  if (zodSchema.description && !jsonSchema.description) {
    jsonSchema.description = zodSchema.description;
  }
  
  // Recursively preserve descriptions for object properties
  if (jsonSchema.type === 'object' && jsonSchema.properties && zodSchema.shape) {
    const properties = jsonSchema.properties;
    const shape = zodSchema.shape;
    
    for (const key in properties) {
      const propertyJsonSchema = properties[key] as JSONSchema7;
      const propertyZodSchema = shape[key];
      
      if (propertyZodSchema && propertyJsonSchema) {
        preserveDescriptions(propertyJsonSchema, propertyZodSchema);
      }
    }
  }
  
  // Recursively preserve descriptions for array items
  if (jsonSchema.type === 'array' && jsonSchema.items && zodSchema.element) {
    const itemJsonSchema = jsonSchema.items as JSONSchema7;
    const itemZodSchema = zodSchema.element;
    
    if (itemZodSchema && itemJsonSchema) {
      preserveDescriptions(itemJsonSchema, itemZodSchema);
    }
  }
}

/**
 * Converts Zod schemas to JSON Schema with automatic v3/v4 compatibility.
 * 
 * Automatically detects Zod version at runtime and uses the appropriate conversion method:
 * - v4: Uses native `z.toJSONSchema()` with fallback to v3 library for edge cases
 * - v3: Uses `zod-to-json-schema` library
 * - Both: Preserves nested property descriptions (fixes known v3/v4 limitation)
 * 
 * @param zodSchema - The Zod schema to convert
 * @param options - Options passed to the underlying conversion function
 * @returns JSONSchema7 object with preserved descriptions and graceful fallbacks
 * 
 * @example
 * ```typescript
 * const schema = z.object({ name: z.string().describe('User name') });
 * const jsonSchema = safeToJSONSchema(schema);
 * // Result preserves nested descriptions across v3/v4
 * ```
 */
export function safeToJSONSchema(zodSchema: ZodSchema, options?: Parameters<typeof z.toJSONSchema>[1]): JSONSchema7 {
  try {
    let result: JSONSchema7;
    
    // Official library authors pattern: Check runtime version
    if (isZodV4Runtime() && z.toJSONSchema) {
      try {
        result = z.toJSONSchema(zodSchema, options) as JSONSchema7;
      } catch (v4Error) {
        // Fallback to v3 library for edge cases
        result = zodToJsonSchema(zodSchema, options) as JSONSchema7;
      }
    } else {
      // Use v3 compatible library
      result = zodToJsonSchema(zodSchema, options) as JSONSchema7;
    }
    
    // Preserve descriptions for both versions (known limitation fix)
    preserveDescriptions(result, zodSchema);
    
    return result;
  } catch (error) {
    console.warn('Schema conversion failed, using fallback:', error);
    return {
      type: "object",
      additionalProperties: true,
      description: "Schema conversion fallback - original validation preserved",
    };
  }
}

// ==================== VALIDATION SYSTEM ====================
// Simple validation following official guidance


/**
 * Validates values against Zod schemas with corruption-resistant error handling.
 * 
 * Provides the same interface as Zod's `safeParse()` but with protection against
 * schema corruption that can occur during v3/v4 migration or complex schema processing.
 * 
 * @param zodSchema - The Zod schema to validate against
 * @param value - The value to validate
 * @returns Validation result with success/error information
 * 
 * @example
 * ```typescript
 * const schema = z.string().min(3);
 * const result = safeValidate(schema, "hello");
 * if (result.success) {
 *   console.log("Valid:", result.value);
 * } else {
 *   console.log("Invalid:", result.error);
 * }
 * ```
 */
export function safeValidate(zodSchema: ZodSchema, value: unknown): { success: boolean; value?: any; error?: any } {
  try {
    const result = zodSchema.safeParse(value);
    return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
  } catch (error) {
    console.warn('Schema validation failed:', error);
    return { success: false, error: error };
  }
}

// ==================== DIRECT PROPERTY ACCESS ====================
// Simplified approach following official guidance

/**
 * Direct property access with v3/v4 compatibility
 */
export function safeGetSchemaProperty<T = unknown>(schema: ZodTypeAny | null | undefined, property: string, defaultValue?: T): T | undefined {
  try {
    if (!schema || typeof schema !== 'object') {
      return defaultValue;
    }
    
    // Direct version check and property access
    if (isZodV4Schema(schema)) {
      // v4 property access
      if (property === 'typeName') {
        return (schema.constructor?.name as T) ?? defaultValue;
      }
      return (schema._zod?.def?.[property] as T) ?? defaultValue;
    } else {
      // v3 property access
      return (schema._def?.[property] as T) ?? defaultValue;
    }
  } catch (error) {
    console.warn(`Property access failed for '${property}', using default:`, error);
    return defaultValue;
  }
}

/**
 * Extract constraints from schema checks
 */
function extractConstraint(schema: any, constraintName: string): any {
  if (!schema) return undefined;
  
  const checks = isZodV4Schema(schema) 
    ? schema._zod?.def?.checks || []
    : schema._def?.checks || [];
  
  const constraint = checks.find((check: any) => check.kind === constraintName);
  return constraint?.value;
}

// ==================== AI SDK INTEGRATION ====================
// Direct AI SDK schema conversion

/**
 * Convert Zod schema to AI SDK schema with validation
 * Mirrors https://github.com/vercel/ai/blob/main/packages/ui-utils/src/zod-schema.ts#L21 but with dual version support
 */
export function convertZodSchemaToAISDKSchema(zodSchema: ZodSchema, target?: string): Schema {
  const jsonSchemaObject = safeToJSONSchema(zodSchema, {
    unrepresentable: "any",
    override: (ctx) => {
      // Handle date schemas
      const typeName = safeGetSchemaProperty(ctx.zodSchema, 'typeName');
      if (typeName === ZOD_TYPE_NAMES.ZodDate) {
        ctx.jsonSchema.type = "string";
        ctx.jsonSchema.format = "date-time";
      }
    },
  });

  return {
    jsonSchema: jsonSchemaObject,
    validate: value => safeValidate(zodSchema, value),
  };
}

/**
 * Checks if a value is a Zod type by examining its properties and methods.
 * Works with both Zod v3 and v4 schemas
 *
 * @param value - The value to check
 * @returns True if the value is a Zod type, false otherwise
 * @internal
 */
function isZodType(value: unknown): value is ZodTypeAny {
  // Check if it's a Zod schema by looking for common Zod properties and methods
  return (
    typeof value === 'object' &&
    value !== null &&
    ('_def' in value || '_zod' in value) && // Support both v3 and v4
    'parse' in value &&
    typeof (value as any).parse === 'function' &&
    'safeParse' in value &&
    typeof (value as any).safeParse === 'function'
  );
}

/**
 * Converts an AI SDK Schema or Zod schema to a Zod schema.
 * Works with both Zod v3 and v4 schemas
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
export function convertSchemaToZod(schema: Schema | ZodSchema): ZodTypeAny {
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
  schema: Schema | ZodSchema;
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
  schema: Schema | ZodSchema;
  compatLayers: SchemaCompatLayer[];
  mode: 'jsonSchema';
}): JSONSchema7;

/**
 * Processes a schema using provider compatibility layers and converts it to the specified format.
 * Works with both Zod v3 and v4 schemas using proper version detection
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
  schema: Schema | ZodSchema;
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
    return safeToJSONSchema(zodSchema, {
      unrepresentable: "any",
      override: (ctx) => {
        const typeName = safeGetSchemaProperty(ctx.zodSchema, 'typeName');
        if (typeName === ZOD_TYPE_NAMES.ZodDate) {
          ctx.jsonSchema.type = "string";
          ctx.jsonSchema.format = "date-time";
        }
      },
    });
  } else {
    return convertZodSchemaToAISDKSchema(zodSchema);
  }
}