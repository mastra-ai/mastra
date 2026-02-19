import type { Schema } from '@internal/ai-v6';
import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec';
import type { JSONSchema7 } from 'json-schema';
import z3 from 'zod/v3';
import type { ZodType } from 'zod/v3';
import type { PublicSchema } from '../schema.types';
import { toStandardSchema as toStandardSchemaAiSdk } from './adapters/ai-sdk';
import { toStandardSchema as toStandardSchemaJsonSchema } from './adapters/json-schema';
import { toStandardSchema as toStandardSchemaZodV3 } from './adapters/zod-v3';
import type { StandardSchemaWithJSON } from './standard-schema.types';

/**
 * Override function for JSON Schema conversion.
 * Handles types that Zod v4 cannot natively represent in JSON Schema:
 * - z.date() -> { type: 'string', format: 'date-time' }
 */
function jsonSchemaOverride(ctx: { zodSchema: unknown; jsonSchema: Record<string, unknown> }): undefined {
  const zodSchema = ctx.zodSchema as { type?: string; _zod?: { def?: { type?: string } }; optional?: () => unknown };
  if (zodSchema) {
    // Convert z.date() to JSON Schema string with date-time format
    if (zodSchema?.type === 'date') {
      ctx.jsonSchema.type = 'string';
      ctx.jsonSchema.format = 'date-time';
    }
    // Add additionalProperties: false for object types to match Zod v3 behavior
    // This is required for OpenAI strict mode function calling
    if (zodSchema?.type === 'object') {
      ctx.jsonSchema.additionalProperties = false;
    }
  }
  return undefined;
}
/**
 * Library options for JSON Schema conversion.
 * - unrepresentable: 'any' allows z.custom() and other unrepresentable types to be converted to {}
 *   instead of throwing "Custom types cannot be represented in JSON Schema"
 * - override: converts z.date() to { type: 'string', format: 'date-time' }
 */
export const JSON_SCHEMA_LIBRARY_OPTIONS = {
  unrepresentable: 'any' as const,
  override: jsonSchemaOverride,
};

export type {
  StandardSchemaWithJSON,
  StandardSchemaWithJSONProps,
  InferInput,
  InferOutput,
  StandardSchemaIssue,
} from './standard-schema.types';

function isVercelSchema(schema: unknown): schema is Schema {
  return (
    typeof schema === 'object' &&
    schema !== null &&
    '_type' in schema &&
    'jsonSchema' in schema &&
    typeof (schema as Schema).jsonSchema === 'object'
  );
}

/**
 * Check if a schema is Zod v4 (has _zod property which is v4-only)
 */
function isZodV4(schema: unknown): boolean {
  return typeof schema === 'object' && schema !== null && '_zod' in schema;
}

/**
 * Check if a schema is Zod v3.
 *
 * Zod v3 can come from:
 * 1. The old standalone 'zod-v3' package
 * 2. The 'zod/v3' compat export from modern zod
 *
 * We detect Zod v3 by checking:
 * - Has ~standard.vendor === 'zod' (both v3 and v4 have this)
 * - Does NOT have ~standard.jsonSchema (only Zod v4 has native JSON Schema support)
 * - Does NOT have _zod property (only Zod v4 has this)
 *
 * Note: We can't use instanceof z3.ZodType because the old 'zod-v3' package
 * has a different prototype chain than 'zod/v3'.
 */
function isZodV3(schema: unknown): schema is ZodType {
  if (schema === null || typeof schema !== 'object') {
    return false;
  }

  // Must not be Zod v4
  if (isZodV4(schema)) {
    return false;
  }

  // Check for ~standard with vendor 'zod' but no jsonSchema
  if ('~standard' in schema) {
    const std = (schema as any)['~standard'];
    if (typeof std === 'object' && std !== null && std.vendor === 'zod' && !('jsonSchema' in std)) {
      return true;
    }
  }

  // Fallback: check instanceof for zod/v3 compat export
  return schema instanceof z3.ZodType;
}

export function toStandardSchema<T = unknown>(schema: PublicSchema<T>): StandardSchemaWithJSON<T> {
  // First check: if already StandardSchemaWithJSON, return as-is
  // This handles ArkType, Zod v4 (when it has jsonSchema), and pre-wrapped schemas
  if (isStandardSchemaWithJSON(schema)) {
    return schema;
  }

  // Check for Zod v3 schemas (need wrapping to add JSON Schema support)
  // Important: Must use isZodV3() not instanceof z3.ZodType because
  // Zod v4 schemas are also instanceof z3.ZodType due to prototype compatibility
  if (isZodV3(schema)) {
    return toStandardSchemaZodV3(schema as ZodType);
  }

  // Check for AI SDK Schema objects (Vercel's jsonSchema wrapper)
  if (isVercelSchema(schema)) {
    return toStandardSchemaAiSdk(schema as Schema<T>);
  }

  // At this point, assume it's a plain JSON Schema object
  // JSON Schema objects are plain objects with properties like 'type', 'properties', etc.
  if (schema === null || (typeof schema !== 'object' && typeof schema !== 'function')) {
    throw new Error(`Unsupported schema type: ${typeof schema}`);
  }

  // If it's a function that's not StandardSchemaWithJSON, it's not supported
  if (typeof schema === 'function') {
    throw new Error(`Unsupported schema type: function (schema libraries should implement StandardSchemaWithJSON)`);
  }

  return toStandardSchemaJsonSchema(schema as JSONSchema7);
}

/**
 * Type guard to check if a value implements the StandardSchemaV1 interface.
 *
 * @param value - The value to check
 * @returns True if the value implements StandardSchemaV1
 *
 * @example
 * ```typescript
 * import { isStandardSchema } from '@mastra/schema-compat';
 *
 * if (isStandardSchema(someValue)) {
 *   const result = someValue['~standard'].validate(input);
 * }
 * ```
 */
export function isStandardSchema(value: unknown): value is StandardSchemaV1 {
  // Check for object or function (some libraries like ArkType use callable schemas)
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
    'version' in std &&
    std.version === 1 &&
    'vendor' in std &&
    'validate' in std &&
    typeof std.validate === 'function'
  );
}

/**
 * Type guard to check if a value implements the StandardJSONSchemaV1 interface.
 *
 * @param value - The value to check
 * @returns True if the value implements StandardJSONSchemaV1
 *
 * @example
 * ```typescript
 * import { isStandardJSONSchema } from '@mastra/schema-compat';
 *
 * if (isStandardJSONSchema(someValue)) {
 *   const jsonSchema = someValue['~standard'].jsonSchema.output({ target: 'draft-07' });
 * }
 * ```
 */
export function isStandardJSONSchema(value: unknown): value is StandardJSONSchemaV1 {
  // Check for object or function (some libraries like ArkType use callable schemas)
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
    return false;
  }
  if (!('~standard' in value)) {
    return false;
  }
  const std = (value as any)['~standard'];
  if (typeof std !== 'object' || std === null) {
    return false;
  }
  if (!('version' in std) || std.version !== 1 || !('vendor' in std)) {
    return false;
  }
  if (!('jsonSchema' in std) || typeof std.jsonSchema !== 'object') {
    return false;
  }
  return typeof std.jsonSchema.input === 'function' && typeof std.jsonSchema.output === 'function';
}

/**
 * Type guard to check if a value implements both StandardSchemaV1 and StandardJSONSchemaV1.
 *
 * @param value - The value to check
 * @returns True if the value implements both interfaces
 *
 * @example
 * ```typescript
 * import { isStandardSchemaWithJSON } from '@mastra/schema-compat';
 *
 * if (isStandardSchemaWithJSON(someValue)) {
 *   // Can use both validation and JSON Schema conversion
 *   const result = someValue['~standard'].validate(input);
 *   const jsonSchema = someValue['~standard'].jsonSchema.output({ target: 'draft-07' });
 * }
 * ```
 */
export function isStandardSchemaWithJSON(value: unknown): value is StandardSchemaWithJSON {
  return isStandardSchema(value) && isStandardJSONSchema(value);
}

/**
 * Converts a StandardSchemaWithJSON to a JSON Schema.
 *
 * @param schema - The StandardSchemaWithJSON schema to convert
 * @param options - Conversion options
 * @param options.target - The JSON Schema target version (default: 'draft-07')
 * @param options.io - Whether to use input or output schema (default: 'output')
 *   - 'input': Use for tool parameters, function arguments, request bodies
 *   - 'output': Use for return types, response bodies
 * @returns The JSON Schema representation
 *
 * @example
 * ```typescript
 * import { standardSchemaToJSONSchema, toStandardSchema } from '@mastra/schema-compat';
 * import { z } from 'zod';
 *
 * const zodSchema = z.object({ name: z.string() });
 * const standardSchema = toStandardSchema(zodSchema);
 *
 * // For output types (default)
 * const outputSchema = standardSchemaToJSONSchema(standardSchema);
 *
 * // For input types (tool parameters)
 * const inputSchema = standardSchemaToJSONSchema(standardSchema, { io: 'input' });
 * ```
 */
export function standardSchemaToJSONSchema(
  schema: StandardSchemaWithJSON,
  options: {
    target?: StandardJSONSchemaV1.Target;
    io?: 'input' | 'output';
    override?: (typeof JSON_SCHEMA_LIBRARY_OPTIONS)['override'];
  } = {},
): JSONSchema7 {
  const { target = 'draft-07', io = 'output', override = JSON_SCHEMA_LIBRARY_OPTIONS.override } = options;
  const jsonSchemaFn = schema['~standard'].jsonSchema[io];
  return jsonSchemaFn({
    target,
    libraryOptions: {
      ...JSON_SCHEMA_LIBRARY_OPTIONS,
      override,
    },
  }) as JSONSchema7;
}
