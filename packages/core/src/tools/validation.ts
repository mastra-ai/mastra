import type { z } from 'zod';
import type { ZodLikeSchema } from '../types/zod-compat';

export interface ValidationError<T = any> {
  error: true;
  message: string;
  validationErrors: z.ZodFormattedError<T>;
}

/**
 * Validates raw input data against a Zod schema.
 *
 * @param schema The Zod schema to validate against
 * @param input The raw input data to validate
 * @param toolId Optional tool ID for better error messages
 * @returns The validated data or a validation error
 */
export function validateToolInput<T = any>(
  schema: ZodLikeSchema | undefined,
  input: unknown,
  toolId?: string,
): { data: T | unknown; error?: ValidationError<T> } {
  // If no schema, return input as-is
  if (!schema || !('safeParse' in schema)) {
    return { data: input };
  }

  // Validate the input directly - no unwrapping needed in v1.0
  const validation = schema.safeParse(input);

  if (validation.success) {
    return { data: validation.data };
  }

  // Validation failed, return error
  const errorMessages = validation.error.issues
    .map((e: z.ZodIssue) => `- ${e.path?.join('.') || 'root'}: ${e.message}`)
    .join('\n');

  const error: ValidationError<T> = {
    error: true,
    message: `Tool validation failed${toolId ? ` for ${toolId}` : ''}. Please fix the following errors and try again:\n${errorMessages}\n\nProvided arguments: ${JSON.stringify(input, null, 2)}`,
    validationErrors: validation.error.format() as z.ZodFormattedError<T>,
  };

  return { data: input, error };
}
