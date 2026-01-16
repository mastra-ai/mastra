import type { StandardSchemaWithJSON } from '../schema/schema';
import type { StandardSchemaIssue } from '../schema/standard-schema';

/**
 * Formatted validation errors structure.
 * Contains `errors` array for messages at this level, and `fields` for nested field errors.
 */
export type FormattedValidationErrors<T = unknown> = {
  errors: string[];
  fields: T extends object ? { [K in keyof T]?: FormattedValidationErrors<T[K]> } : unknown;
};

export interface ValidationError<T = unknown> {
  error: true;
  message: string;
  validationErrors: FormattedValidationErrors<T>;
}
/**
 * Extracts a string key from a path segment (handles both PropertyKey and PathSegment objects).
 */
function getPathKey(segment: PropertyKey | { key: PropertyKey }): string {
  if (typeof segment === 'object' && segment !== null && 'key' in segment) {
    return String(segment.key);
  }
  return String(segment);
}

/**
 * Creates an empty FormattedValidationErrors object.
 */
function createEmptyErrors(): { errors: string[]; fields: Record<string, unknown> } {
  return { errors: [], fields: {} };
}

/**
 * Builds a formatted errors object from standard schema validation issues.
 *
 * @param issues Array of validation issues from standard schema validation
 * @returns Formatted errors object with nested structure based on paths
 */
function buildFormattedErrors<T>(issues: readonly StandardSchemaIssue[]): FormattedValidationErrors<T> {
  const result = createEmptyErrors();

  for (const issue of issues) {
    if (!issue.path || issue.path.length === 0) {
      // Root-level error
      result.errors.push(issue.message);
    } else {
      // Nested error - build path through fields
      let current = result;
      for (let i = 0; i < issue.path.length; i++) {
        const key = getPathKey(issue.path[i]!);
        if (i === issue.path.length - 1) {
          // Last segment - add the error message
          if (!current.fields[key]) {
            current.fields[key] = createEmptyErrors();
          }
          (current.fields[key] as { errors: string[]; fields: Record<string, unknown> }).errors.push(issue.message);
        } else {
          // Intermediate segment - ensure object exists
          if (!current.fields[key]) {
            current.fields[key] = createEmptyErrors();
          }
          current = current.fields[key] as { errors: string[]; fields: Record<string, unknown> };
        }
      }
    }
  }

  return result as FormattedValidationErrors<T>;
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
 * Validates raw suspend data against a schema.
 *
 * @param schema The schema to validate against
 * @param suspendData The raw suspend data to validate
 * @param toolId Optional tool ID for better error messages
 * @returns The validated data or a validation error
 */
export function validateToolSuspendData<T = unknown>(
  schema: StandardSchemaWithJSON<T> | undefined,
  suspendData: unknown,
  toolId?: string,
): { data: T; error?: undefined } | { data?: undefined; error: ValidationError<T> } {
  // If no schema, return suspend data as-is
  if (!schema) {
    return { data: suspendData as T };
  }

  // Validate the input using standard schema interface
  const validation = schema['~standard'].validate(suspendData);

  if (validation instanceof Promise) {
    throw new Error('Your schema is async, which is not supported. Please use a sync schema.');
  }

  if ('value' in validation) {
    return { data: validation.value };
  }

  // Validation failed, return error
  const errorMessages = validation.issues.map(e => `- ${e.path?.join('.') || 'root'}: ${e.message}`).join('\n');

  const error: ValidationError<T> = {
    error: true,
    message: `Tool suspension data validation failed${toolId ? ` for ${toolId}` : ''}. Please fix the following errors and try again:\n${errorMessages}\n\nProvided arguments: ${truncateForLogging(suspendData)}`,
    validationErrors: buildFormattedErrors<T>(validation.issues),
  };

  return { error };
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
function normalizeNullishInput(schema: StandardSchemaWithJSON<any>, input: unknown): unknown {
  if (typeof input !== 'undefined' && input !== null) {
    return input;
  }

  const jsonSchema = schema['~standard'].jsonSchema.input({ target: 'draft-07' });

  // Check if schema is an array type (using typeName to avoid dual-package hazard)
  if (jsonSchema.type === 'array') {
    return [];
  }

  // Check if schema is an object type (using typeName to avoid dual-package hazard)
  if (jsonSchema.type === 'object') {
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
 * Validates raw input data against a schema.
 *
 * @param schema The schema to validate against (or undefined to skip validation)
 * @param input The raw input data to validate
 * @param toolId Optional tool ID for better error messages
 * @returns The validated data or a validation error
 */
export function validateToolInput<T = unknown>(
  schema: StandardSchemaWithJSON<T> | undefined,
  input: unknown,
  toolId?: string,
): { data: T; error?: undefined } | { data?: undefined; error: ValidationError<T> } {
  // If no schema, return input as-is
  if (!schema) {
    return { data: input as T };
  }

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
  const validation = schema['~standard'].validate(normalizedInput);

  if (validation instanceof Promise) {
    throw new Error('Your schema is async, which is not supported. Please use a sync schema.');
  }

  if ('value' in validation) {
    return { data: validation.value };
  }

  // Validation failed, return error
  const errorMessages = validation.issues.map(e => `- ${e.path?.join('.') || 'root'}: ${e.message}`).join('\n');

  const error: ValidationError<T> = {
    error: true,
    message: `Tool input validation failed${toolId ? ` for ${toolId}` : ''}. Please fix the following errors and try again:\n${errorMessages}\n\nProvided arguments: ${truncateForLogging(input)}`,
    validationErrors: buildFormattedErrors<T>(validation.issues),
  };

  return { error };
}

/**
 * Validates tool output data against a schema.
 *
 * @param schema The schema to validate against
 * @param output The output data to validate
 * @param toolId Optional tool ID for better error messages
 * @returns The validated data or a validation error
 */
export function validateToolOutput<T = unknown>(
  schema: StandardSchemaWithJSON<T> | undefined,
  output: unknown,
  toolId?: string,
  suspendCalled?: boolean,
): { data: T; error?: undefined } | { data?: undefined; error: ValidationError<T> } {
  // If no schema, return output as-is
  if (!schema || suspendCalled) {
    return { data: output as T };
  }

  // Validate the output using standard schema interface
  const validation = schema['~standard'].validate(output);
  if (validation instanceof Promise) {
    throw new Error('Your schema is async, which is not supported. Please use a sync schema.');
  }

  if ('value' in validation) {
    return { data: validation.value };
  }

  // Validation failed, return error
  const errorMessages = validation.issues.map(e => `- ${e.path?.join('.') || 'root'}: ${e.message}`).join('\n');

  const error: ValidationError<T> = {
    error: true,
    message: `Tool output validation failed${toolId ? ` for ${toolId}` : ''}. The tool returned invalid output:\n${errorMessages}\n\nReturned output: ${truncateForLogging(output)}`,
    validationErrors: buildFormattedErrors<T>(validation.issues),
  };

  return { error };
}
