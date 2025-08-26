import type { FieldErrors } from 'react-hook-form';
import { z } from 'zod';

export const transformToNestObject = (error: z.ZodError): FieldErrors => {
  const fieldErrors: FieldErrors = {};
  error.errors.forEach(err => {
    if (err.path.length > 0) {
      const path = err.path.join('.');
      fieldErrors[path] = {
        type: 'validation',
        message: err.message,
      };
    }
  });
  return fieldErrors;
};

/**
 * Resolve serialized zod output - This function takes the string output ot the `jsonSchemaToZod` function
 * and instantiates the zod object correctly.
 *
 * @param obj - serialized zod object
 * @returns resolved zod object
 */
export function resolveSerializedZodOutput(obj: any) {
  return Function('z', `"use strict";return (${obj});`)(z);
}
