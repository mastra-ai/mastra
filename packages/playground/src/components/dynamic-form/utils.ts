import { z } from 'zod';

/**
 * Resolve serialized zod output - This function takes the string output of the `jsonSchemaToZod` function
 * and instantiates the zod object correctly.
 *
 * @param obj - serialized zod object
 * @returns resolved zod object
 */
export function resolveSerializedZodOutput(obj: any) {
  const result = obj.replace(/(['"])zod(['"])/g, '$1zod/v4$2').replace(/\.record\(/g, '.record(z.string(),');
  return Function('z', `"use strict";return (${result});`)(z);
}
