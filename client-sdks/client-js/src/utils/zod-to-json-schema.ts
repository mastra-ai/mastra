import { ZodSchema } from 'zod';
import originalZodToJsonSchema from 'zod-to-json-schema';

export function zodToJsonSchema<T extends ZodSchema | any>(zodSchema: T) {
  if (!(zodSchema instanceof ZodSchema)) {
    return zodSchema;
  }

  return originalZodToJsonSchema(zodSchema, { $refStrategy: 'none' });
}
