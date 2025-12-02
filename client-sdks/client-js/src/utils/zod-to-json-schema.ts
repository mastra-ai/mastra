import { zodToJsonSchema as schemaCompatZodToJsonSchema } from '@mastra/schema-compat/zod-to-json';
import type { ZodType } from 'zod';

/**
 * Check if a value is a Zod schema type.
 * This is a simple check that doesn't require any Node.js dependencies.
 */
function isZodType(value: unknown): value is ZodType {
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
