import type { Schema } from '@internal/ai-sdk-v5';
import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec';
import type { JSONSchema7 } from 'json-schema';
import z3 from 'zod-v3';
import { toStandardSchema as toStandardSchemaAiSdk } from './adapters/ai-sdk';
import { toStandardSchema as toStandardSchemaJsonSchema } from './adapters/json-schema';
import { toStandardSchema as toStandardSchemaZodV3 } from './adapters/zod-v3';
import type { PublicSchema } from './schema';
import type { StandardSchemaWithJSON } from './standard-schema.types';

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

  if (schema instanceof z3.ZodAny) {
    // @ts-ignore - Type instantiation is excessively deep and possibly infinite.
    return toStandardSchemaZodV3(schema);
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
 * Uses the built-in jsonSchema.output() method from the StandardJSONSchemaV1 interface.
 *
 * @param schema - The StandardSchemaWithJSON schema to convert
 * @param target - The JSON Schema target version (default: 'draft-07')
 * @returns The JSON Schema representation
 *
 * @example
 * ```typescript
 * import { standardSchemaToJSONSchema, toStandardSchema } from '@mastra/core/schema/standard-schema';
 * import { z } from 'zod';
 *
 * const zodSchema = z.object({ name: z.string() });
 * const standardSchema = toStandardSchema(zodSchema);
 * const jsonSchema = standardSchemaToJSONSchema(standardSchema);
 * // { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }
 * ```
 */
export function standardSchemaToJSONSchema(schema: StandardSchemaWithJSON, target: StandardJSONSchemaV1.Target = 'draft-07'): JSONSchema7 {
    return schema['~standard'].jsonSchema.output({ target }) as JSONSchema7;
}
