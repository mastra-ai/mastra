import type { StandardSchemaV1 } from './standard-schema';

/**
 * Type compatibility layer for Zod v3, v4, and Standard Schema compatible libraries.
 *
 * This type uses structural typing to accept schemas from:
 * - Zod v3 and v4 (via parse/safeParse methods)
 * - Any Standard Schema compatible library (Valibot, ArkType, etc.) via the ~standard interface
 *
 * Libraries implementing Standard Schema (https://standardschema.dev/) are automatically
 * compatible, allowing users to bring their preferred validation library.
 */
export type ZodLikeSchema =
  | {
      parse: (data: unknown) => any;
      safeParse: (data: unknown) => { success: boolean; data?: any; error?: any };
    }
  | StandardSchemaV1;

/**
 * Helper type to check if a schema has Zod's _output property for precise type inference.
 * Zod v3 uses _output, Zod v4 uses _zod.output
 */
type HasZodOutput<T> = T extends { _output: any } ? true : T extends { _zod: { output: any } } ? true : false;

/**
 * Extract Zod's output type from either v3 or v4 format.
 */
type ExtractZodOutput<T> = T extends { _output: infer U }
  ? U
  : T extends { _zod: { output: infer U } }
    ? U
    : never;

/**
 * Extract Zod's input type from either v3 or v4 format.
 */
type ExtractZodInput<T> = T extends { _input: infer U }
  ? U
  : T extends { _zod: { input: infer U } }
    ? U
    : never;

/**
 * Helper type for extracting the inferred type from a Zod-like schema after parsing.
 *
 * Priority order:
 * 1. Zod schemas (via _output or _zod.output) - most precise
 * 2. Zod schemas (via parse method return type) - fallback for older Zod
 * 3. Standard Schema (via ~standard.types.output) - for non-Zod libraries
 *
 * This order ensures Zod schemas use their precise type inference even though
 * Zod v3.25+ also implements Standard Schema.
 */
export type InferZodLikeSchema<T> =
  HasZodOutput<T> extends true
    ? ExtractZodOutput<T>
    : T extends { parse: (data: unknown) => infer U }
      ? U
      : T extends StandardSchemaV1
        ? StandardSchemaV1.InferOutput<T>
        : any;

/**
 * Helper type for extracting the input type from a Zod-like schema.
 * This is useful for schemas with transforms where the input type differs from the output type.
 *
 * For schemas with transforms:
 * - InferZodLikeSchemaInput<T> gives the type before transformation
 * - InferZodLikeSchema<T> gives the type after transformation
 *
 * Priority order:
 * 1. Zod schemas (via _input or _zod.input) - most precise for transforms
 * 2. Zod schemas (via parse method return type) - fallback
 * 3. Standard Schema (via ~standard.types.input) - for non-Zod libraries
 */
export type InferZodLikeSchemaInput<T> = T extends { _input: infer U }
  ? U
  : T extends { _zod: { input: infer U } }
    ? U
    : T extends { parse: (data: unknown) => infer U }
      ? U
      : T extends StandardSchemaV1
        ? StandardSchemaV1.InferInput<T>
        : any;
