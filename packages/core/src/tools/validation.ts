import type { z } from 'zod';
import type { SchemaWithValidation } from '../stream/base/schema';
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
  schema: SchemaWithValidation<T> | undefined,
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
  const errorMessages = validation.error.issues.map(e => `- ${e.path?.join('.') || 'root'}: ${e.message}`).join('\n');

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
function normalizeNullishInput(schema: SchemaWithValidation<unknown>, input: unknown): unknown {
  if (input !== undefined && input !== null) {
    return input;
  }

  // Check if schema is an array type (using typeName to avoid dual-package hazard)
  if (isZodArray(schema)) {
    return [];
  }

  // Check if schema is an object type (using typeName to avoid dual-package hazard)
  if (isZodObject(schema)) {
    return {};
  }

  // For other schema types, return the original input and let Zod validate
  return input;
}

/**
 * Checks if a value is a plain object (created by {} or new Object()).
 * This excludes class instances, built-in objects like Date/Map/URL, etc.
 *
 * @param value The value to check
 * @returns true if the value is a plain object
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Recursively strips null and undefined values from object properties.
 * This handles LLMs (e.g. Gemini) that send null for optional fields,
 * since Zod's .optional() only accepts undefined, not null. (GitHub #12362)
 *
 * When a property value is null or undefined, it is omitted from the result
 * object entirely, which is equivalent to "not provided" for Zod validation.
 *
 * Only recurses into plain objects to preserve class instances and built-in objects
 * like Date, Map, URL, etc.
 *
 * NOTE: This function should NOT be called unconditionally because it breaks
 * schemas that use .nullable() (where null is a valid value). It is used as
 * a fallback when initial validation fails. See validateToolInput for usage.
 *
 * @param input The input to process
 * @returns The processed input with null/undefined values stripped
 */
function stripNullishValues(input: unknown): unknown {
  // Top-level null/undefined becomes undefined
  if (input === null || input === undefined) {
    return undefined;
  }

  if (typeof input !== 'object') {
    return input;
  }

  if (Array.isArray(input)) {
    // For arrays, recursively process elements but keep nulls in arrays
    // (array elements with null may be intentional)
    return input.map(item => (item === null ? null : stripNullishValues(item)));
  }

  // Only recurse into plain objects - preserve class instances, built-in objects
  if (!isPlainObject(input)) {
    return input;
  }

  // It's a plain object - recursively process all properties, omitting null/undefined values
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined) {
      // Omit null/undefined values - equivalent to "not provided" for optional fields
      continue;
    }
    result[key] = stripNullishValues(value);
  }
  return result;
}

/**
 * Recursively converts undefined values to null in an object.
 * This is needed for OpenAI compat layers which convert .optional() to .nullable()
 * for strict mode compliance. When fields are omitted (undefined), we convert them
 * to null so the schema validation passes, and the transform then converts null back
 * to undefined. (GitHub #11457)
 *
 * Only recurses into plain objects to preserve class instances and built-in objects
 * like Date, Map, URL, etc. (GitHub #11502)
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

  // Only recurse into plain objects - preserve class instances, built-in objects
  // (Date, Map, Set, URL, etc.) and any other non-plain objects
  if (!isPlainObject(input)) {
    return input;
  }

  // It's a plain object - recursively process all properties
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    result[key] = convertUndefinedToNull(value);
  }
  return result;
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
  schema: SchemaWithValidation<T> | undefined,
  input: unknown,
  toolId?: string,
): { data: T | unknown; error?: ValidationError<T> } {
  // If no schema, return input as-is
  if (!schema || !('safeParse' in schema)) {
    return { data: input };
  }

  // Validation pipeline:
  //
  // 1. normalizeNullishInput: Convert top-level null/undefined to {} or [] based on schema type.
  //    Handles LLMs that send undefined instead of {} or [] for all-optional parameters.
  //
  // 2. convertUndefinedToNull: Convert undefined values to null in object properties.
  //    Needed for OpenAI compat layers that convert .optional() to .nullable() for
  //    strict mode compliance. The schema's transform converts null back to undefined.
  //    (GitHub #11457)
  //
  // 3. First validation attempt with null values preserved. This handles .nullable()
  //    schemas correctly (where null is a valid value).
  //
  // 4. If validation fails, retry with null values stripped from object properties.
  //    This handles LLMs (e.g. Gemini) that send null for .optional() fields, where
  //    Zod expects undefined, not null. (GitHub #12362)

  // Step 1: Normalize top-level null/undefined to appropriate default
  let normalizedInput = normalizeNullishInput(schema, input);

  // Step 2: Convert undefined values to null recursively (GitHub #11457)
  normalizedInput = convertUndefinedToNull(normalizedInput);

  // Step 3: Try validation with null values preserved
  const validation = schema.safeParse(normalizedInput);
  if (validation.success) {
    return { data: validation.data };
  }

  // Step 4: Retry with null values stripped (GitHub #12362)
  // LLMs like Gemini send null for optional fields, but Zod's .optional() only
  // accepts undefined, not null. By stripping nullish values and retrying, we
  // handle this case without breaking .nullable() schemas that passed in step 3.
  const strippedInput = stripNullishValues(input);
  const normalizedStripped = normalizeNullishInput(schema, strippedInput);
  const retryValidation = schema.safeParse(normalizedStripped);

  if (retryValidation.success) {
    return { data: retryValidation.data };
  }

  // Both attempts failed - return the original (non-stripped) error since it's
  // more informative about what the schema actually expects
  const errorMessages = validation.error.issues.map(e => `- ${e.path?.join('.') || 'root'}: ${e.message}`).join('\n');

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
  schema: SchemaWithValidation<T> | undefined,
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
  const errorMessages = validation.error.issues.map(e => `- ${e.path?.join('.') || 'root'}: ${e.message}`).join('\n');

  const error: ValidationError<T> = {
    error: true,
    message: `Tool output validation failed${toolId ? ` for ${toolId}` : ''}. The tool returned invalid output:\n${errorMessages}\n\nReturned output: ${truncateForLogging(output)}`,
    validationErrors: validation.error.format() as z.ZodFormattedError<T>,
  };

  return { data: output, error };
}
