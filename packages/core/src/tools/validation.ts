import type { z } from 'zod';

export interface ValidationError<T = any> {
  error: true;
  message: string;
  validationErrors: z.ZodFormattedError<T>;
}

/**
 * Validates input against a Zod schema and returns a structured error if validation fails
 * @param schema The Zod schema to validate against
 * @param input The input to validate
 * @param toolId Optional tool ID for better error messages
 * @returns The validation error object if validation fails, undefined if successful
 */
export function validateToolInput<T = any>(
  schema: z.ZodSchema<T> | undefined,
  input: unknown,
  toolId?: string,
): { data: T | unknown; error?: ValidationError<T> } {
  if (!schema || !('safeParse' in schema)) {
    return { data: input };
  }

  // Extract the actual input data from various context formats
  let actualInput = input;

  // Handle ToolExecutionContext format { context: data, ... }
  if (input && typeof input === 'object' && 'context' in input) {
    actualInput = (input as any).context;
  }

  // Handle StepExecutionContext format { context: { inputData: data, ... }, ... }
  if (actualInput && typeof actualInput === 'object' && 'inputData' in actualInput) {
    actualInput = (actualInput as any).inputData;
  }

  const validation = schema.safeParse(actualInput);
  if (!validation.success) {
    const errorMessages = validation.error.issues
      .map((e: z.ZodIssue) => `- ${e.path?.join('.') || 'root'}: ${e.message}`)
      .join('\n');

    const error: ValidationError<T> = {
      error: true,
      message: `Tool validation failed${toolId ? ` for ${toolId}` : ''}. Please fix the following errors and try again:\n${errorMessages}\n\nProvided arguments: ${JSON.stringify(actualInput, null, 2)}`,
      validationErrors: validation.error.format(),
    };

    return { data: input, error };
  }

  // Return the original input structure with validated data in the right place
  if (input && typeof input === 'object' && 'context' in input) {
    if ((input as any).context && typeof (input as any).context === 'object' && 'inputData' in (input as any).context) {
      return { data: { ...input, context: { ...(input as any).context, inputData: validation.data } } };
    }
    return { data: { ...input, context: validation.data } };
  }

  return { data: validation.data };
}
