import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import type { ZodSchema as ZodSchemaV3 } from 'zod/v3';
import type { ZodType as ZodSchemaV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import zodToJsonSchemaOriginal from 'zod-to-json-schema';

export function zodToJsonSchema(zodSchema: ZodSchemaV3 | ZodSchemaV4, target: Targets = 'jsonSchema7') {
  const fn = 'toJSONSchema';

  if (fn in z) {
    // Use dynamic property access to avoid import errors in Zod v3
    return (z as any)[fn](zodSchema, {
      unrepresentable: 'any',
      override: (ctx: any) => {
        // Safe access to handle cases where _zod might be undefined
        const def = ctx.zodSchema?._zod?.def;
        if (def && def.type === 'date') {
          ctx.jsonSchema.type = 'string';
          ctx.jsonSchema.format = 'date-time';
        }
      },
    }) as JSONSchema7;
  } else {
    return zodToJsonSchemaOriginal(zodSchema as ZodSchemaV3, {
      $refStrategy: 'none',
      target,
    }) as JSONSchema7;
  }
}
