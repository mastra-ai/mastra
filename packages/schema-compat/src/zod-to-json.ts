import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import type { ZodSchema as ZodSchemaV3 } from 'zod/v3';
import type { ZodType as ZodSchemaV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import zodToJsonSchemaOriginal from 'zod-to-json-schema';

export function zodToJsonSchema(
  zodSchema: ZodSchemaV3 | ZodSchemaV4,
  target: Targets = 'jsonSchema7',
  strategy: 'none' | 'seen' | 'root' | 'relative' = 'relative',
) {
  const fn = 'toJSONSchema';

  if (fn in z) {
    // Wrap in try-catch and fall back to v3 converter when it fails
    try {
      return (z as any)[fn](zodSchema, {
        unrepresentable: 'any',
        override: (ctx: any) => {
          // Handle both Zod v4 structures: _def directly or nested in _zod
          const def = ctx.zodSchema?._def || ctx.zodSchema?._zod?.def;
          // Check for date type using both possible property names
          if (def && (def.typeName === 'ZodDate' || def.type === 'date')) {
            ctx.jsonSchema.type = 'string';
            ctx.jsonSchema.format = 'date-time';
          }
        },
      }) as JSONSchema7;
    } catch {
      // Fall back to v3 converter if v4 fails
      return zodToJsonSchemaOriginal(zodSchema as ZodSchemaV3, {
        $refStrategy: strategy,
        target,
      }) as JSONSchema7;
    }
  } else {
    // Zod v3 path - use the original converter
    return zodToJsonSchemaOriginal(zodSchema as ZodSchemaV3, {
      $refStrategy: strategy,
      target,
    }) as JSONSchema7;
  }
}
