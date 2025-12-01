import { isZodType } from '@mastra/core/utils';
import { zodToJsonSchema as schemaCompatZodToJsonSchema } from '@mastra/core/utils/zod-to-json';
import type { ZodType } from 'zod';

/**
 * Converts a Zod schema to JSON Schema, or passes through non-Zod values unchanged.
 *
 * Uses the schema-compat implementation which includes:
 * - Zod v4 z.record() bug fix
 * - Date to date-time format conversion
 * - Handling of unrepresentable types
 */
export function zodToJsonSchema<T extends ZodType | any>(zodSchema: T) {
  if (!isZodType(zodSchema)) {
    return zodSchema;
  }

  return schemaCompatZodToJsonSchema(zodSchema);
}
