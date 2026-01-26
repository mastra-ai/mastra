import type { Schema } from '@internal/ai-sdk-v5';
import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec';
import type { JSONSchema7 } from 'json-schema';
import z3, { type ZodType } from 'zod/v3';
import { toStandardSchema as toStandardSchemaAiSdk } from './adapters/ai-sdk';
import { toStandardSchema as toStandardSchemaJsonSchema } from './adapters/json-schema';
import { toStandardSchema as toStandardSchemaZodV3 } from './adapters/zod-v3';
import type { PublicSchema } from './schema';
import type { StandardSchemaWithJSON } from './standard-schema.types';

/**
 * Library options for JSON Schema conversion.
 * - unrepresentable: 'any' allows z.custom() and other unrepresentable types to be converted to {}
 *   instead of throwing "Custom types cannot be represented in JSON Schema"
 */
export const JSON_SCHEMA_LIBRARY_OPTIONS = {
  unrepresentable: 'any' as const,
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
    typeof (schema as Schema)._type !== 'undefined' &&
    typeof (schema as Schema).jsonSchema !== 'undefined'
  );
}

export function toStandardSchema<T = unknown>(schema: PublicSchema<T>): StandardSchemaWithJSON<T> {
  if (isStandardSchemaWithJSON(schema)) {
    return schema;
  }

  if (schema instanceof z3.ZodType) {
    // @ts-ignore - Type instantiation is excessively deep and possibly infinite.
    return toStandardSchemaZodV3(schema as ZodType);
  }

  if (isVercelSchema(schema)) {
    return toStandardSchemaAiSdk(schema as Schema<T>);
  }

  // At this point, assume it's a plain JSON Schema object
  // JSON Schema objects are plain objects with properties like 'type', 'properties', etc.
  if (typeof schema !== 'object' || schema === null) {
    throw new Error(`Unsupported schema type: ${typeof schema}`);
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
 * import { isStandardSchema } from '@mastra/core/schema/adapters/zod-v3';
 *
 * if (isStandardSchema(someValue)) {
 *   const result = someValue['~standard'].validate(input);
 * }
 * ```
 */
export function isStandardSchema(value: unknown): value is StandardSchemaV1 {
  return (
    typeof value === 'object' &&
    value !== null &&
    '~standard' in value &&
    typeof (value as any)['~standard'] === 'object' &&
    (value as any)['~standard'] !== null &&
    'version' in (value as any)['~standard'] &&
    (value as any)['~standard'].version === 1 &&
    'vendor' in (value as any)['~standard'] &&
    'validate' in (value as any)['~standard'] &&
    typeof (value as any)['~standard'].validate === 'function'
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
 * import { isStandardJSONSchema } from '@mastra/core/schema/adapters/zod-v3';
 *
 * if (isStandardJSONSchema(someValue)) {
 *   const jsonSchema = someValue['~standard'].jsonSchema.output({ target: 'draft-07' });
 * }
 * ```
 */
export function isStandardJSONSchema(value: unknown): value is StandardJSONSchemaV1 {
  return (
    typeof value === 'object' &&
    value !== null &&
    '~standard' in value &&
    typeof (value as any)['~standard'] === 'object' &&
    (value as any)['~standard'] !== null &&
    'version' in (value as any)['~standard'] &&
    (value as any)['~standard'].version === 1 &&
    'vendor' in (value as any)['~standard'] &&
    'jsonSchema' in (value as any)['~standard'] &&
    typeof (value as any)['~standard'].jsonSchema === 'object' &&
    typeof (value as any)['~standard'].jsonSchema.input === 'function' &&
    typeof (value as any)['~standard'].jsonSchema.output === 'function'
  );
}

/**
 * Type guard to check if a value implements both StandardSchemaV1 and StandardJSONSchemaV1.
 *
 * @param value - The value to check
 * @returns True if the value implements both interfaces
 *
 * @example
 * ```typescript
 * import { isStandardSchemaWithJSON } from '@mastra/core/schema/adapters/zod-v3';
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
 * import { standardSchemaToJSONSchema, toStandardSchema } from '@mastra/core/schema/standard-schema';
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
  } = {},
): JSONSchema7 {
  const { target = 'draft-07', io = 'output' } = options;
  const jsonSchemaFn = schema['~standard'].jsonSchema[io];
  return jsonSchemaFn({ target, libraryOptions: JSON_SCHEMA_LIBRARY_OPTIONS }) as JSONSchema7;
}
