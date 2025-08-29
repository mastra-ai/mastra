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
  let validationResult;
  let returnStructure: 'direct' | 'context' | 'inputData' = 'direct';

  // Try validating the input directly first
  const directValidation = schema.safeParse(input);
  if (directValidation.success) {
    return { data: input };
  }

  // Handle ToolExecutionContext format { context: data, ... }
  if (input && typeof input === 'object' && 'context' in input) {
    actualInput = (input as any).context;

    // Try validating the unwrapped context
    const contextValidation = schema.safeParse(actualInput);
    if (contextValidation.success) {
      validationResult = contextValidation;
      returnStructure = 'context';
    }
  }

  // Handle StepExecutionContext format { context: { inputData: data, ... }, ... }
  if (!validationResult && actualInput && typeof actualInput === 'object' && 'inputData' in actualInput) {
    const inputDataValue = (actualInput as any).inputData;

    // Try validating the unwrapped inputData
    const inputDataValidation = schema.safeParse(inputDataValue);
    if (inputDataValidation.success) {
      validationResult = inputDataValidation;
      returnStructure = 'inputData';
    }
  }

  // If one of the unwrapping attempts worked, return the appropriate structure
  if (validationResult) {
    if (returnStructure === 'context') {
      return { data: { ...(input as object), context: validationResult.data } };
    } else if (returnStructure === 'inputData') {
      // For inputData unwrapping, preserve the structure if the original context had additional properties
      // but return just the validated data if it was a pure inputData wrapper
      if (input && typeof input === 'object' && 'context' in input) {
        const originalContext = (input as any).context;
        const contextKeys = Object.keys(originalContext);

        // If context only has inputData, return the full structure with the validated data
        // Otherwise, return just the validated inputData
        if (contextKeys.length === 1 && contextKeys[0] === 'inputData') {
          return { data: { ...(input as object), context: { inputData: validationResult.data } } };
        } else {
          // Multiple keys in context, return just the validated data
          return { data: validationResult.data };
        }
      }
      return { data: validationResult.data };
    }
  }

  // If none of the unwrapping attempts work, use the best validation error
  // Try to provide the most specific error message possible
  let bestValidation = directValidation;

  if (input && typeof input === 'object' && 'context' in input) {
    const contextValidation = schema.safeParse((input as any).context);
    if (contextValidation.error && contextValidation.error.issues.length > 0) {
      bestValidation = contextValidation;
      actualInput = (input as any).context;
    }

    // Try the nested inputData path
    if (actualInput && typeof actualInput === 'object' && 'inputData' in actualInput) {
      const inputDataValidation = schema.safeParse((actualInput as any).inputData);
      if (inputDataValidation.error && inputDataValidation.error.issues.length > 0) {
        bestValidation = inputDataValidation;
        actualInput = (actualInput as any).inputData;
      }
    }
  }

  if (!bestValidation.success) {
    const errorMessages = bestValidation.error.issues
      .map((e: z.ZodIssue) => `- ${e.path?.join('.') || 'root'}: ${e.message}`)
      .join('\n');

    const error: ValidationError<T> = {
      error: true,
      message: `Tool validation failed${toolId ? ` for ${toolId}` : ''}. Please fix the following errors and try again:\n${errorMessages}\n\nProvided arguments: ${JSON.stringify(actualInput, null, 2)}`,
      validationErrors: bestValidation.error.format(),
    };

    return { data: input, error };
  }

  // This should not happen since we handle all valid cases above
  return { data: input };
}
