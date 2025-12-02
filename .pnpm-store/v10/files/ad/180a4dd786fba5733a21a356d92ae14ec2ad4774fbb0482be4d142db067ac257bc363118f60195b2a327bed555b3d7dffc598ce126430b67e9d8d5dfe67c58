import { z } from "zod";

/**
 * Convenience wrapper for z.object(...).passthrough().
 *
 * This object validator allows extra properties and passes them through.
 * This is useful for forwards compatibility if the server adds extra unknown
 * fields.
 */
export function looseObject<T extends z.ZodRawShape>(
  shape: T,
  params?: z.RawCreateParams,
): z.ZodObject<
  T,
  "passthrough",
  z.ZodTypeAny,
  {
    [k_1 in keyof z.objectUtil.addQuestionMarks<
      z.baseObjectOutputType<T>,
      {
        [k in keyof z.baseObjectOutputType<T>]: undefined extends z.baseObjectOutputType<T>[k]
          ? never
          : k;
      }[keyof T]
    >]: z.objectUtil.addQuestionMarks<
      z.baseObjectOutputType<T>,
      {
        [k in keyof z.baseObjectOutputType<T>]: undefined extends z.baseObjectOutputType<T>[k]
          ? never
          : k;
      }[keyof T]
    >[k_1];
  },
  { [k_2 in keyof z.baseObjectInputType<T>]: z.baseObjectInputType<T>[k_2] }
> {
  return z.object(shape, params).passthrough();
}
