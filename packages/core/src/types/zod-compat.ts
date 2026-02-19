/**
 * Type compatibility layer for Zod v3 and v4
 *
 * Zod v3 and v4 have different internal type structures, but they share
 * the same public API. This type uses structural typing to accept schemas
 * from both versions by checking for the presence of `parse` and `safeParse`
 * rather than relying on nominal type matching.
 *
 * Using nominal union types (e.g. `z.ZodType<T> | zv4.ZodType<T>`) causes
 * TypeScript to perform deep comparison of both zod type trees when
 * inferring generics, leading to combinatorial explosion and OOM in `tsc`.
 */
export type ZodLikeSchema<T = any> = {
  parse(data: unknown): T;
  safeParse(
    data: unknown,
  ):
    | { success: true; data: T }
    | { success: false; error: { issues: Array<{ path?: any; message: string }>; format(...args: any[]): any } };
};

/**
 * Helper type for extracting the inferred type from a Zod-like schema after parsing
 */
export type InferZodLikeSchema<T extends ZodLikeSchema<any>> = T extends ZodLikeSchema<infer V> ? V : never;

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
  : T extends { _zod: { input: infer U } }
    ? U
    : T extends { parse: (data: unknown) => infer U }
      ? U
      : any;
