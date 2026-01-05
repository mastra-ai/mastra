import type { z } from 'zod';
import { isStandardSchema, type StandardSchemaV1 } from '../types/standard-schema';
import type { ZodLikeSchema } from '../types/zod-compat';
import { isZodArray, isZodObject } from '../utils/zod-utils';

/**
 * Generic validation error interface that works with both Zod and Standard Schema.
 */
export interface ValidationError<T = any> {
  error: true;
  message: string;
  /** Zod-formatted errors for backward compatibility, or Standard Schema issues */
  validationErrors: z.ZodFormattedError<T> | ReadonlyArray<StandardSchemaV1.Issue>;
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
 * Helper function to check if a schema has Zod's safeParse method.
 */
function hasZodSafeParse(schema: unknown): schema is { safeParse: (data: unknown) => any } {
  return (
    typeof schema === 'object' &&
    schema !== null &&
    'safeParse' in schema &&
    typeof (schema as any).safeParse === 'function'
  );
}

/**
 * Formats Standard Schema issues into a human-readable error message.
 */
function formatStandardSchemaIssues(issues: ReadonlyArray<StandardSchemaV1.Issue>): string {
  return issues
    .map(issue => {
      const path =
        issue.path
          ?.map(segment => (typeof segment === 'object' && 'key' in segment ? String(segment.key) : String(segment)))
          .join('.') || 'root';
      return `- ${path}: ${issue.message}`;
    })
    .join('\n');
}

/**
 * Validates raw suspend data against a schema (Zod or Standard Schema).
 *
 * @param schema The schema to validate against (Zod or Standard Schema)
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
  if (!schema) {
    return { data: suspendData };
  }

  // Check for Zod's safeParse first (Zod v3.25+ also implements Standard Schema,
  // but we prefer Zod's safeParse for better error handling)
  if (hasZodSafeParse(schema)) {
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

  // Check if it's a Standard Schema (has ~standard.validate) without Zod's safeParse
  if (isStandardSchema(schema)) {
    // Standard Schema validate can be async, but we need sync here
    // Most implementations return sync results, but we handle async just in case
    const result = schema['~standard'].validate(suspendData);

    // Handle both sync and async results
    if (result instanceof Promise) {
      // For async validation, we can't handle it synchronously
      // This is a limitation - callers should use async version if needed
      console.warn('Standard Schema async validation not supported in sync context, skipping validation');
      return { data: suspendData };
    }

    if (!result.issues) {
      return { data: result.value as T };
    }

    const errorMessages = formatStandardSchemaIssues(result.issues);
    const error: ValidationError<T> = {
      error: true,
      message: `Tool suspension data validation failed${toolId ? ` for ${toolId}` : ''}. Please fix the following errors and try again:\n${errorMessages}\n\nProvided arguments: ${truncateForLogging(suspendData)}`,
      validationErrors: result.issues,
    };

    return { data: suspendData, error };
  }

  // No recognizable schema validation method - return data as-is
  return { data: suspendData };
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
 * Recursively converts undefined values to null in an object.
 * This is needed for OpenAI compat layers which convert .optional() to .nullable()
 * for strict mode compliance. When fields are omitted (undefined), we convert them
 * to null so the schema validation passes, and the transform then converts null back
 * to undefined. (GitHub #11457)
 *
 * @param input The input to process
 * @returns The processed input with undefined values converted to null
 */
function convertUndefinedToNull(input: unknown): unknown {
  if (input === undefined) {
    return null;
  }

  if (input === null || typeof input !== 'object') {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(convertUndefinedToNull);
  }

  // It's an object - recursively process all properties
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    result[key] = convertUndefinedToNull(value);
  }
  return result;
}

/**
 * Validates raw input data against a schema (Zod or Standard Schema).
 *
 * @param schema The schema to validate against (Zod or Standard Schema)
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
  if (!schema) {
    return { data: input };
  }

  // Check for Zod's safeParse first (Zod v3.25+ also implements Standard Schema,
  // but we prefer Zod's safeParse for better normalization handling)
  if (hasZodSafeParse(schema)) {
    // Normalize undefined/null input to appropriate default for the schema type
    // This handles LLMs that send undefined instead of {} or [] for optional parameters
    let normalizedInput = normalizeNullishInput(schema, input);

    // Convert undefined values to null recursively (GitHub #11457)
    // This is needed because OpenAI compat layers convert .optional() to .nullable()
    // for strict mode compliance. When fields are omitted (undefined), we convert them
    // to null so the schema validation passes. The schema's transform will then convert
    // null back to undefined to match the original .optional() semantics.
    normalizedInput = convertUndefinedToNull(normalizedInput);

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

  // Check if it's a Standard Schema (has ~standard.validate) without Zod's safeParse
  // This handles non-Zod Standard Schema implementations like Valibot, ArkType, etc.
  if (isStandardSchema(schema)) {
    // For Standard Schema, we still need to handle undefined -> {} normalization
    // This is needed for LLMs that send undefined for optional parameters
    let normalizedInput = input;
    if (input === undefined || input === null) {
      normalizedInput = {};
    }

    // Convert undefined values to null recursively (GitHub #11457)
    normalizedInput = convertUndefinedToNull(normalizedInput);

    // Standard Schema validate can be async, but we need sync here
    const result = schema['~standard'].validate(normalizedInput);

    // Handle both sync and async results
    if (result instanceof Promise) {
      // For async validation, we can't handle it synchronously
      console.warn('Standard Schema async validation not supported in sync context, skipping validation');
      return { data: normalizedInput };
    }

    if (!result.issues) {
      return { data: result.value as T };
    }

    const errorMessages = formatStandardSchemaIssues(result.issues);
    const error: ValidationError<T> = {
      error: true,
      message: `Tool input validation failed${toolId ? ` for ${toolId}` : ''}. Please fix the following errors and try again:\n${errorMessages}\n\nProvided arguments: ${truncateForLogging(input)}`,
      validationErrors: result.issues,
    };

    return { data: input, error };
  }

  // No recognizable schema validation method - return input as-is
  return { data: input };
}

/**
 * Validates tool output data against a schema (Zod or Standard Schema).
 *
 * @param schema The schema to validate against (Zod or Standard Schema)
 * @param output The output data to validate
 * @param toolId Optional tool ID for better error messages
 * @param suspendCalled Whether suspend was called (skips validation if true)
 * @returns The validated data or a validation error
 */
export function validateToolOutput<T = any>(
  schema: ZodLikeSchema | undefined,
  output: unknown,
  toolId?: string,
  suspendCalled?: boolean,
): { data: T | unknown; error?: ValidationError<T> } {
  // If no schema or suspend was called, return output as-is
  if (!schema || suspendCalled) {
    return { data: output };
  }

  // Check for Zod's safeParse first (Zod v3.25+ also implements Standard Schema,
  // but we prefer Zod's safeParse for better error handling)
  if (hasZodSafeParse(schema)) {
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

  // Check if it's a Standard Schema (has ~standard.validate) without Zod's safeParse
  if (isStandardSchema(schema)) {
    // Standard Schema validate can be async, but we need sync here
    const result = schema['~standard'].validate(output);

    // Handle both sync and async results
    if (result instanceof Promise) {
      // For async validation, we can't handle it synchronously
      console.warn('Standard Schema async validation not supported in sync context, skipping validation');
      return { data: output };
    }

    if (!result.issues) {
      return { data: result.value as T };
    }

    const errorMessages = formatStandardSchemaIssues(result.issues);
    const error: ValidationError<T> = {
      error: true,
      message: `Tool output validation failed${toolId ? ` for ${toolId}` : ''}. The tool returned invalid output:\n${errorMessages}\n\nReturned output: ${truncateForLogging(output)}`,
      validationErrors: result.issues,
    };

    return { data: output, error };
  }

  // No recognizable schema validation method - return output as-is
  return { data: output };
}
