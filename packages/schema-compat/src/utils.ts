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
 * Standard Schema V1 interface.
 *
 * This is the core interface that validation libraries implement to be
 * Standard Schema compliant. Libraries like Zod (v3.25+), Valibot, ArkType,
 * and others implement this interface.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  /** The Standard Schema properties. */
  readonly '~standard': StandardSchemaV1.Props<Input, Output>;
}

export namespace StandardSchemaV1 {
  /** The Standard Schema properties interface. */
  export interface Props<Input = unknown, Output = Input> {
    /** The version number of the standard. */
    readonly version: 1;
    /** The vendor name of the schema library. */
    readonly vendor: string;
    /** Validates unknown input values. */
    readonly validate: (value: unknown, options?: Options | undefined) => Result<Output> | Promise<Result<Output>>;
    /** Inferred types associated with the schema. */
    readonly types?: Types<Input, Output> | undefined;
  }

  /** The Standard Schema types interface. */
  export interface Types<Input = unknown, Output = Input> {
    /** The input type of the schema. */
    readonly input: Input;
    /** The output type of the schema. */
    readonly output: Output;
  }

  /** Options for validate function. */
  export interface Options {
    /** Explicit support for additional vendor-specific parameters, if needed. */
    readonly libraryOptions?: Record<string, unknown> | undefined;
  }

  /** The result interface of the validate function. */
  export type Result<Output> = SuccessResult<Output> | FailureResult;

  /** The result interface if validation succeeds. */
  export interface SuccessResult<Output> {
    /** The typed output value. */
    readonly value: Output;
    /** A falsy value for `issues` indicates success. */
    readonly issues?: undefined;
  }

  /** The result interface if validation fails. */
  export interface FailureResult {
    /** The issues of failed validation. */
    readonly issues: ReadonlyArray<Issue>;
  }

  /** The issue interface of the failure output. */
  export interface Issue {
    /** The error message of the issue. */
    readonly message: string;
    /** The path of the issue, if any. */
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }

  /** The path segment interface of the issue. */
  export interface PathSegment {
    /** The key representing a path segment. */
    readonly key: PropertyKey;
  }
}

/**
 * Standard JSON Schema V1 interface.
 *
 * This interface extends StandardTypedV1 to add JSON Schema generation capabilities.
 * Libraries that can convert their schemas to JSON Schema implement this interface.
 */
export interface StandardJSONSchemaV1<Input = unknown, Output = Input> {
  /** The Standard JSON Schema properties. */
  readonly '~standard': StandardJSONSchemaV1.Props<Input, Output>;
}

export namespace StandardJSONSchemaV1 {
  /** The Standard JSON Schema properties interface. */
  export interface Props<Input = unknown, Output = Input> {
    /** The version number of the standard. */
    readonly version: 1;
    /** The vendor name of the schema library. */
    readonly vendor: string;
    /** Inferred types associated with the schema. */
    readonly types?: Types<Input, Output> | undefined;
    /** Methods for generating the input/output JSON Schema. */
    readonly jsonSchema: Converter;
  }

  /** The Standard JSON Schema converter interface. */
  export interface Converter {
    /** Converts the input type to JSON Schema. May throw if conversion is not supported. */
    readonly input: (options: Options) => Record<string, unknown>;
    /** Converts the output type to JSON Schema. May throw if conversion is not supported. */
    readonly output: (options: Options) => Record<string, unknown>;
  }

  /**
   * The target version of the generated JSON Schema.
   */
  export type Target = 'draft-2020-12' | 'draft-07' | 'openapi-3.0' | ({} & string);

  /** The options for the input/output methods. */
  export interface Options {
    /** Specifies the target version of the generated JSON Schema. */
    readonly target: Target;
    /** Explicit support for additional vendor-specific parameters, if needed. */
    readonly libraryOptions?: Record<string, unknown> | undefined;
  }

  /** The Standard types interface. */
  export interface Types<Input = unknown, Output = Input> {
    /** The input type of the schema. */
    readonly input: Input;
    /** The output type of the schema. */
    readonly output: Output;
  }
}

/**
 * Checks if a value is a Standard Schema (implements the ~standard interface with validate).
 *
 * @param value - The value to check
 * @returns True if the value implements StandardSchemaV1, false otherwise
 */
export function isStandardSchema(value: unknown): value is StandardSchemaV1 {
  // Check for object or function (ArkType returns functions)
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
    return false;
  }

  if (!('~standard' in value)) {
    return false;
  }

  const std = (value as any)['~standard'];
  return (
    typeof std === 'object' &&
    std !== null &&
    typeof std.version === 'number' &&
    typeof std.vendor === 'string' &&
    typeof std.validate === 'function'
  );
}

/**
 * Checks if a value is a Standard JSON Schema (implements JSON Schema generation).
 *
 * @param value - The value to check
 * @returns True if the value implements StandardJSONSchemaV1, false otherwise
 */
export function isStandardJSONSchema(value: unknown): value is StandardJSONSchemaV1 {
  // Check for object or function (ArkType returns functions)
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
    return false;
  }

  if (!('~standard' in value)) {
    return false;
  }

  const std = (value as any)['~standard'];
  return (
    typeof std === 'object' &&
    std !== null &&
    typeof std.jsonSchema === 'object' &&
    typeof std.jsonSchema?.input === 'function'
  );
}

/**
 * Converts a Standard Schema to an AI SDK Schema with validation support.
 *
 * This function converts any Standard Schema (from Zod, Valibot, ArkType, etc.)
 * to an AI SDK Schema that can be used with LLMs.
 *
 * @param standardSchema - The Standard Schema to convert
 * @param target - The JSON Schema target format (defaults to 'draft-07')
 * @returns An AI SDK Schema object with built-in validation
 *
 * @example
 * ```typescript
 * import { v } from 'valibot';
 * import { convertStandardSchemaToAISDKSchema } from '@mastra/schema-compat';
 *
 * const userSchema = v.object({
 *   name: v.string(),
 *   age: v.number()
 * });
 *
 * const aiSchema = convertStandardSchemaToAISDKSchema(userSchema);
 * ```
 */
export function convertStandardSchemaToAISDKSchema(
  standardSchema: StandardSchemaV1 | StandardJSONSchemaV1,
  target: StandardJSONSchemaV1.Target = 'draft-07',
): Schema<any> {
  // Check if it supports StandardSchemaV1 (has validate)
  const hasValidate = isStandardSchema(standardSchema);

  // Check if it also supports StandardJSONSchemaV1 for direct JSON Schema generation
  if (isStandardJSONSchema(standardSchema)) {
    const jsonSchemaResult = standardSchema['~standard'].jsonSchema.input({ target });
    return jsonSchema(jsonSchemaResult as JSONSchema7, {
      validate: value => {
        if (!hasValidate) {
          // No validation available, just return success
          return { success: true, value };
        }
        const result = (standardSchema as unknown as StandardSchemaV1)['~standard'].validate(value);
        if (result instanceof Promise) {
          // Handle async validation - convert to sync for AI SDK compatibility
          return { success: true, value };
        }
        return result.issues
          ? { success: false, error: new Error(result.issues.map(i => i.message).join(', ')) }
          : { success: true, value: result.value };
      },
    });
  }

  // For Standard Schema without JSON Schema generation, we still have validation
  if (hasValidate) {
    console.warn(
      `Schema from vendor "${standardSchema['~standard'].vendor}" does not support JSON Schema generation. ` +
        'Consider using a library that implements StandardJSONSchemaV1 or use Zod directly.',
    );

    return jsonSchema({ type: 'object' } as JSONSchema7, {
      validate: value => {
        const result = standardSchema['~standard'].validate(value);
        if (result instanceof Promise) {
          return { success: true, value };
        }
        return result.issues
          ? { success: false, error: new Error(result.issues.map(i => i.message).join(', ')) }
          : { success: true, value: result.value };
      },
    });
  }

  // Neither validation nor JSON Schema - shouldn't happen but handle gracefully
  return jsonSchema({ type: 'object' } as JSONSchema7, {
    validate: value => ({ success: true, value }),
  });
}

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
 * Union type for any schema format supported by Mastra.
 */
export type AnySchema = Schema | ZodSchema | JSONSchema7 | StandardSchemaV1 | StandardJSONSchemaV1;

/**
 * Converts any supported schema format to an AI SDK Schema.
 *
 * This function detects the schema type and applies the appropriate conversion:
 * - Zod schemas are converted using zod-to-json-schema
 * - Standard Schema with JSON Schema support uses the built-in converter
 * - Standard Schema without JSON Schema falls back with a warning
 * - JSON Schema is wrapped directly
 * - AI SDK Schema is returned as-is
 *
 * @param schema - The schema to convert
 * @param target - The JSON Schema target format (defaults to 'jsonSchema7')
 * @returns An AI SDK Schema object
 */
export function convertAnySchemaToAISDKSchema(schema: AnySchema, target: Targets = 'jsonSchema7'): Schema<any> {
  // Already an AI SDK Schema
  if (
    typeof schema === 'object' &&
    schema !== null &&
    'jsonSchema' in schema &&
    typeof schema.jsonSchema === 'object'
  ) {
    return schema as Schema;
  }

  // Zod schema (check before Standard Schema since Zod v3.25+ implements both)
  if (isZodType(schema)) {
    return convertZodSchemaToAISDKSchema(schema, target);
  }

  // Standard JSON Schema (supports JSON Schema generation)
  if (isStandardJSONSchema(schema)) {
    const standardTarget = target === 'jsonSchema7' ? 'draft-07' : target;
    return convertStandardSchemaToAISDKSchema(schema, standardTarget as StandardJSONSchemaV1.Target);
  }

  // Standard Schema (without JSON Schema generation)
  if (isStandardSchema(schema)) {
    return convertStandardSchemaToAISDKSchema(schema);
  }

  // Plain JSON Schema
  return jsonSchema(schema as JSONSchema7, {
    validate: value => ({ success: true, value }),
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
 * Converts any supported schema format to a Zod schema.
 *
 * If the input is already a Zod schema, it returns it unchanged.
 * If the input is an AI SDK Schema, it extracts the JSON schema and converts it to Zod.
 * If the input is a Standard JSON Schema, it uses the JSON Schema converter.
 *
 * @param schema - The schema to convert (AI SDK Schema, Zod schema, JSON Schema, or Standard Schema)
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
export function convertSchemaToZod(schema: AnySchema): ZodType {
  if (isZodType(schema)) {
    return schema;
  }

  // Standard JSON Schema - convert via JSON Schema
  if (isStandardJSONSchema(schema)) {
    const jsonSchemaResult = schema['~standard'].jsonSchema.input({ target: 'draft-07' });
    return convertJsonSchemaToZodInternal(jsonSchemaResult);
  }

  // Standard Schema without JSON Schema - we can't convert without JSON Schema
  if (isStandardSchema(schema)) {
    throw new Error(
      `Cannot convert Standard Schema from vendor "${schema['~standard'].vendor}" to Zod. ` +
        'The schema does not implement StandardJSONSchemaV1. ' +
        'Consider using a library that supports JSON Schema generation.',
    );
  }

  // AI SDK Schema or plain JSON Schema
  const jsonSchemaToConvert = 'jsonSchema' in schema ? schema.jsonSchema : schema;
  return convertJsonSchemaToZodInternal(jsonSchemaToConvert as Record<string, unknown>);
}

/**
 * Internal helper to convert JSON Schema to Zod.
 */
function convertJsonSchemaToZodInternal(jsonSchemaToConvert: Record<string, unknown>): ZodType {
  try {
    if ('toJSONSchema' in z) {
      // Cast needed due to zod version type mismatches between zod-from-json-schema and project zod
      return convertJsonSchemaToZod(jsonSchemaToConvert) as unknown as ZodType;
    } else {
      return convertJsonSchemaToZodV3(jsonSchemaToConvert) as unknown as ZodType;
    }
  } catch (e: unknown) {
    const errorMessage = `[Schema Builder] Failed to convert schema parameters to Zod. Original schema: ${JSON.stringify(jsonSchemaToConvert)}`;
    console.error(errorMessage, e);
    throw new Error(errorMessage + (e instanceof Error ? `\n${e.stack}` : '\nUnknown error object'));
  }
}

/**
 * Processes a schema using provider compatibility layers and converts it to an AI SDK Schema.
 *
 * @param options - Configuration object for schema processing
 * @param options.schema - The schema to process (AI SDK Schema, Zod, JSON Schema, or Standard Schema)
 * @param options.compatLayers - Array of compatibility layers to try
 * @param options.mode - Must be 'aiSdkSchema'
 * @returns Processed schema as an AI SDK Schema
 */
export function applyCompatLayer(options: {
  schema: AnySchema;
  compatLayers: SchemaCompatLayer[];
  mode: 'aiSdkSchema';
}): Schema;

/**
 * Processes a schema using provider compatibility layers and converts it to a JSON Schema.
 *
 * @param options - Configuration object for schema processing
 * @param options.schema - The schema to process (AI SDK Schema, Zod, JSON Schema, or Standard Schema)
 * @param options.compatLayers - Array of compatibility layers to try
 * @param options.mode - Must be 'jsonSchema'
 * @returns Processed schema as a JSONSchema7
 */
export function applyCompatLayer(options: {
  schema: AnySchema;
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
 * Supports any schema format:
 * - Zod schemas (v3 and v4)
 * - AI SDK Schema objects
 * - Plain JSON Schema (JSON Schema 7)
 * - Standard Schema (from Valibot, ArkType, etc.)
 *
 * @param options - Configuration object for schema processing
 * @param options.schema - The schema to process
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
  schema: AnySchema;
  compatLayers: SchemaCompatLayer[];
  mode: 'jsonSchema' | 'aiSdkSchema';
}): JSONSchema7 | Schema {
  // For Standard Schema without JSON Schema support, we can't apply compat layers
  // Return early with just the AI SDK Schema conversion
  if (isStandardSchema(schema) && !isStandardJSONSchema(schema) && !isZodType(schema)) {
    if (mode === 'aiSdkSchema') {
      return convertStandardSchemaToAISDKSchema(schema);
    } else {
      throw new Error(
        `Cannot convert Standard Schema from vendor "${schema['~standard'].vendor}" to JSON Schema. ` +
          'The schema does not implement StandardJSONSchemaV1.',
      );
    }
  }

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
