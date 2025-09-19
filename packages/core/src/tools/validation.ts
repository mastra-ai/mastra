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

  // Store validation results to avoid duplicate validation
  type ValidationAttempt = {
    result: z.SafeParseReturnType<any, T>;
    data: unknown;
    structure: 'direct' | 'context' | 'inputData';
  };

  const validationAttempts: ValidationAttempt[] = [];

  // Try validating the input directly first
  const directValidation = schema.safeParse(input);
  validationAttempts.push({
    result: directValidation,
    data: input,
    structure: 'direct',
  });

  if (directValidation.success) {
    return { data: input };
  }

  // Handle ToolExecutionContext format { context: data, ... }
  if (input && typeof input === 'object' && 'context' in input) {
    const contextData = (input as any).context;
    const contextValidation = schema.safeParse(contextData);
    validationAttempts.push({
      result: contextValidation,
      data: contextData,
      structure: 'context',
    });

    if (contextValidation.success) {
      return { data: { ...(input as object), context: contextValidation.data } };
    }

    // Handle StepExecutionContext format { context: { inputData: data, ... }, ... }
    if (contextData && typeof contextData === 'object' && 'inputData' in contextData) {
      const inputDataValue = (contextData as any).inputData;
      const inputDataValidation = schema.safeParse(inputDataValue);
      validationAttempts.push({
        result: inputDataValidation,
        data: inputDataValue,
        structure: 'inputData',
      });

      if (inputDataValidation.success) {
        // For inputData unwrapping, preserve the structure if the original context had additional properties
        // but return just the validated data if it was a pure inputData wrapper
        const contextKeys = Object.keys(contextData);

        // If context only has inputData, return the full structure with the validated data
        // Otherwise, return just the validated inputData
        if (contextKeys.length === 1 && contextKeys[0] === 'inputData') {
          return { data: { ...(input as object), context: { inputData: inputDataValidation.data } } };
        } else {
          // Multiple keys in context, return just the validated data
          return { data: inputDataValidation.data };
        }
      }
    }
  }

  // All validations failed, find the best error to return
  // Prefer the most specific error (deepest unwrapping level that has meaningful errors)
  let bestAttempt = validationAttempts[0]; // Start with direct validation

  for (const attempt of validationAttempts) {
    if (!attempt.result.success && attempt.result.error.issues.length > 0) {
      bestAttempt = attempt;
    }
  }

  // Use the best validation attempt for error reporting
  if (bestAttempt && !bestAttempt.result.success) {
    const errorMessages = bestAttempt.result.error.issues
      .map((e: z.ZodIssue) => `- ${e.path?.join('.') || 'root'}: ${e.message}`)
      .join('\n');

    const error: ValidationError<T> = {
      error: true,
      message: `Tool validation failed${toolId ? ` for ${toolId}` : ''}. Please fix the following errors and try again:\n${errorMessages}\n\nProvided arguments: ${JSON.stringify(bestAttempt.data, null, 2)}`,
      validationErrors: bestAttempt.result.error.format() as z.ZodFormattedError<T>,
    };

    return { data: input, error };
  }

  // This should not happen since we handle all valid cases above
  return { data: input };
}
