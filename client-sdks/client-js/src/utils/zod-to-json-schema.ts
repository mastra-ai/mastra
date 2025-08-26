import { z } from 'zod';
import type { ZodType } from 'zod';
import originalZodToJsonSchema from 'zod-to-json-schema';

function isZodType(value: unknown): value is ZodType {
  // Check if it's a Zod schema by looking for common Zod properties and methods
  return (
    typeof value === 'object' &&
    value !== null &&
    '_def' in value &&
    'parse' in value &&
    typeof (value as any).parse === 'function' &&
    'safeParse' in value &&
    typeof (value as any).safeParse === 'function'
  );
}

export function zodToJsonSchema<T extends ZodType | any>(zodSchema: T) {
  if (!isZodType(zodSchema)) {
    return zodSchema;
  }

  if ('toJSONSchema' in z) {
    // @ts-expect-error - zod v4 type
    return z.toJSONSchema(zodSchema);
  }

  return originalZodToJsonSchema(zodSchema, { $refStrategy: 'none' });
}
