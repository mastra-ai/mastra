import type { z } from 'zod';
import type { ZodLikeSchema } from '../types/zod-compat';
import { isZodArray, isZodObject } from '../utils/zod-utils';

export interface ValidationError<T = any> {
  error: true;
  message: string;
  validationErrors: z.ZodFormattedError<T>;
}

/**
 * Safely truncates data for error messages to avoid exposing sensitive information.
 * @param data The data to truncate
 * @param maxLength Maximum length of the truncated string (default: 200)
 * @returns Truncated string representation
 */
function truncateForLogging(data: unknown, maxLength: number = 200): string {
  try {
    const stringified = JSON.stringify(data, null, 2);
    if (stringified.length <= maxLength) {
      return stringified;
    }
    return stringified.slice(0, maxLength) + '... (truncated)';
  } catch {
    return '[Unable to serialize data]';
  }
}

/**
 * Validates raw suspend data against a Zod schema.
 *
 * @param schema The Zod schema to validate against
 * @param suspendData The raw suspend data to validate
 * @param toolId Optional tool ID for better error messages
 * @returns The validated data or a validation error
 */
export function validateToolSuspendData<T = any>(
  schema: ZodLikeSchema | undefined,
  suspendData: unknown,
  toolId?: string,
): { data: T | unknown; error?: ValidationError<T> } {
  // If no schema, return suspend data as-is
  if (!schema || !('safeParse' in schema)) {
    return { data: suspendData };
  }

  // Validate the input directly - no unwrapping needed in v1.0
  const validation = schema.safeParse(suspendData);

  if (validation.success) {
    return { data: validation.data };
  }

  // Validation failed, return error
  const errorMessages = validation.error.issues
    .map((e: z.ZodIssue) => `- ${e.path?.join('.') || 'root'}: ${e.message}`)
    .join('\n');

  const error: ValidationError<T> = {
    error: true,
    message: `Tool suspension data validation failed${toolId ? ` for ${toolId}` : ''}. Please fix the following errors and try again:\n${errorMessages}\n\nProvided arguments: ${truncateForLogging(suspendData)}`,
    validationErrors: validation.error.format() as z.ZodFormattedError<T>,
  };

  return { data: suspendData, error };
}

/**
 * Normalizes undefined/null input to an appropriate default value based on schema type.
 * This handles LLMs (Claude Sonnet 4.5, Gemini 2.4, etc.) that send undefined/null
 * instead of {} or [] when all parameters are optional.
 *
 * @param schema The Zod schema to check
 * @param input The input to normalize
 * @returns The normalized input (original value, {}, or [])
 */
function normalizeNullishInput(schema: ZodLikeSchema, input: unknown): unknown {
  if (input !== undefined && input !== null) {
    return input;
  }

  // Check if schema is an array type (using typeName to avoid dual-package hazard)
  if (isZodArray(schema as z.ZodTypeAny)) {
    return [];
  }

  // Check if schema is an object type (using typeName to avoid dual-package hazard)
  if (isZodObject(schema as z.ZodTypeAny)) {
    return {};
  }

  // For other schema types, return the original input and let Zod validate
  return input;
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

  // Normalize undefined/null input to appropriate default for the schema type
  // This handles LLMs that send undefined instead of {} or [] for optional parameters
  const normalizedInput = normalizeNullishInput(schema, input);

  // Validate the normalized input
  const validation = schema.safeParse(normalizedInput);

  if (validation.success) {
    return { data: validation.data };
  }

  // Validation failed, return error
  const errorMessages = validation.error.issues
    .map((e: z.ZodIssue) => `- ${e.path?.join('.') || 'root'}: ${e.message}`)
    .join('\n');

  const error: ValidationError<T> = {
    error: true,
    message: `Tool input validation failed${toolId ? ` for ${toolId}` : ''}. Please fix the following errors and try again:\n${errorMessages}\n\nProvided arguments: ${truncateForLogging(input)}`,
    validationErrors: validation.error.format() as z.ZodFormattedError<T>,
  };

  return { data: input, error };
}

/**
 * Validates tool output data against a Zod schema.
 *
 * @param schema The Zod schema to validate against
 * @param output The output data to validate
 * @param toolId Optional tool ID for better error messages
 * @returns The validated data or a validation error
 */
export function validateToolOutput<T = any>(
  schema: ZodLikeSchema | undefined,
  output: unknown,
  toolId?: string,
  suspendCalled?: boolean,
): { data: T | unknown; error?: ValidationError<T> } {
  // If no schema, return output as-is
  if (!schema || !('safeParse' in schema) || suspendCalled) {
    return { data: output };
  }

  // Validate the output
  const validation = schema.safeParse(output);

  if (validation.success) {
    return { data: validation.data };
  }

  // Validation failed, return error
  const errorMessages = validation.error.issues
    .map((e: z.ZodIssue) => `- ${e.path?.join('.') || 'root'}: ${e.message}`)
    .join('\n');

  const error: ValidationError<T> = {
    error: true,
    message: `Tool output validation failed${toolId ? ` for ${toolId}` : ''}. The tool returned invalid output:\n${errorMessages}\n\nReturned output: ${truncateForLogging(output)}`,
    validationErrors: validation.error.format() as z.ZodFormattedError<T>,
  };

  return { data: output, error };
}
