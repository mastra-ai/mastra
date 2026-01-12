/**
 * Type compatibility layer for Zod v3 and v4
 *
 * Zod v3 and v4 have different internal type structures, but they share
 * the same public API. This type uses structural typing to accept schemas
 * from both versions by checking for the presence of key methods rather
 * than relying on exact type matching.
 */
export type ZodLikeSchema = {
  parse: (data: unknown) => any;
  safeParse: (data: unknown) => { success: boolean; data?: any; error?: any };
};

/**
 * Helper type for extracting the inferred type from a Zod-like schema after parsing
 */
export type InferZodLikeSchema<T> = T extends { parse: (data: unknown) => infer U } ? U : any;

/**
 * Helper type for extracting the input type from a Zod-like schema.
 * This is useful for schemas with transforms where the input type differs from the output type.
 *
 * For schemas with transforms:
 * - InferZodLikeSchemaInput<T> gives the type before transformation
 * - InferZodLikeSchema<T> gives the type after transformation
 */
export type InferZodLikeSchemaInput<T> = T extends { _input: infer U }
  ? U
  : T extends { parse: (data: unknown) => infer U }
    ? U
    : any;
