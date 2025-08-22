import type { JSONSchema7 } from "json-schema";
import z from "zod/v4";
import type { Targets } from "zod-to-json-schema";
import  zodToJsonSchemaOriginal from "zod-to-json-schema";

export function zodToJsonSchema(zodSchema: z.ZodSchema, target: Targets = 'jsonSchema7') {
    if (
        'toJSONSchema' in z
    ) {
      return z.toJSONSchema(zodSchema) as JSONSchema7;
      
    } else {
      return zodToJsonSchemaOriginal(zodSchema, {
        $refStrategy: 'none',
        target,
      }) as JSONSchema7;
    }
  }