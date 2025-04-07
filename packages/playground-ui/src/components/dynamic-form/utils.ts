import { z } from 'zod';

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
