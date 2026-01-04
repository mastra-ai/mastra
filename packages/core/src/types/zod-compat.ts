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
 * Helper type for extracting the inferred type from a Zod-like schema after parsing.
 *
 * Supports both:
 * - Zod schemas (via parse method return type)
 * - Standard Schema (via ~standard.types.output)
 */
export type InferZodLikeSchema<T> = T extends StandardSchemaV1
  ? StandardSchemaV1.InferOutput<T>
  : T extends { parse: (data: unknown) => infer U }
    ? U
    : any;

/**
 * Helper type for extracting the input type from a Zod-like schema.
 * This is useful for schemas with transforms where the input type differs from the output type.
 *
 * For schemas with transforms:
 * - InferZodLikeSchemaInput<T> gives the type before transformation
 * - InferZodLikeSchema<T> gives the type after transformation
 *
 * Supports both:
 * - Zod schemas (via _input property or parse method)
 * - Standard Schema (via ~standard.types.input)
 */
export type InferZodLikeSchemaInput<T> = T extends StandardSchemaV1
  ? StandardSchemaV1.InferInput<T>
  : T extends { _input: infer U }
    ? U
    : T extends { parse: (data: unknown) => infer U }
      ? U
      : any;
