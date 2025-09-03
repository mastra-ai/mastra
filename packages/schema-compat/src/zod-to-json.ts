import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema as ZodSchemaV3 } from 'zod/v3';
import type { ZodType as ZodSchemaV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import zodToJsonSchemaOriginal from 'zod-to-json-schema';

export function zodToJsonSchema(zodSchema: ZodSchemaV3 | ZodSchemaV4, target: Targets = 'jsonSchema7') {
  let toJSONSchemaFn: undefined | ((schema: any, opts?: any) => JSONSchema7) = undefined;
  try {
    toJSONSchemaFn = require('zod').toJSONSchema;
  } catch {}

  if (typeof toJSONSchemaFn === 'function') {
    // Use dynamic property access to avoid import errors in Zod v3
    return toJSONSchemaFn(zodSchema, {
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
