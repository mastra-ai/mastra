import { z } from 'zod';

export interface ValidationError {
  error: true;
  message: string;
  validationErrors: any;
}

/**
 * Validates input against a Zod schema and returns a structured error if validation fails
 * @param schema The Zod schema to validate against
 * @param input The input to validate
 * @param toolId Optional tool ID for better error messages
 * @returns The validation error object if validation fails, undefined if successful
 */
export function validateToolInput(
  schema: z.ZodSchema | undefined,
  input: any,
  toolId?: string,
): { data: any; error?: ValidationError } {
  if (!schema || !('safeParse' in schema)) {
    return { data: input };
  }

  const validation = schema.safeParse(input);
  if (!validation.success) {
    const errorMessages = validation.error.errors
      .map((e: z.ZodIssue) => `- ${e.path?.join('.') || 'root'}: ${e.message}`)
      .join('\n');

    const error: ValidationError = {
      error: true,
      message: `Tool validation failed${toolId ? ` for ${toolId}` : ''}. Please fix the following errors and try again:\n${errorMessages}\n\nProvided arguments: ${JSON.stringify(input, null, 2)}`,
      validationErrors: validation.error.format(),
    };

    return { data: input, error };
  }

  return { data: validation.data };
}
