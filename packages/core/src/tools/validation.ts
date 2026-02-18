import type { RequestContext } from '../request-context';
import { toStandardSchema } from '../schema/schema';
import type { PublicSchema, StandardSchemaWithJSON } from '../schema/schema';
import { standardSchemaToJSONSchema } from '../schema/standard-schema';
import type { StandardSchemaIssue } from '../schema/standard-schema';
import { getZodTypeName, isZodArray, isZodObject, unwrapZodType } from '../utils/zod-utils';

/**
 * Safely validates data against a Standard Schema.
 * Catches internal Zod errors (like undefined union options) and provides better error messages.
 *
 * @param schema The Standard Schema to validate against
 * @param data The data to validate
 * @returns The validation result or throws with a descriptive error
 */
function safeValidate<T>(
  schema: StandardSchemaWithJSON<T>,
  data: unknown,
): { value: T } | { issues: readonly StandardSchemaIssue[] } {
  try {
    const result = schema['~standard'].validate(data);
    if (result instanceof Promise) {
      throw new Error('Your schema is async, which is not supported. Please use a sync schema.');
    }
    return result as { value: T } | { issues: readonly StandardSchemaIssue[] };
  } catch (err) {
    // Catch Zod internal errors like "Cannot read properties of undefined (reading 'run')"
    // This happens when a union schema has undefined options
    if (err instanceof TypeError && err.message.includes('Cannot read properties of undefined')) {
      throw new Error(
        `Schema validation failed due to an invalid schema definition. ` +
          `This often happens when a union schema (z.union or z.or) has undefined options. ` +
          `Please check that all schema options are properly defined. Original error: ${err.message}`,
      );
    }
    throw err;
  }
}

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
  // If no schema, or schema is not a Standard Schema, return suspend data as-is
  if (!schema || !('~standard' in schema)) {
    return { data: suspendData as T };
  }

  // Validate the input using standard schema interface
  const validation = safeValidate(schema, suspendData);

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

  const jsonSchema = standardSchemaToJSONSchema(schema, { io: 'input' });

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
 * Recursively strips null/undefined values from object properties.
 * This handles LLMs (e.g. Gemini) that send null for .optional() fields,
 * where Zod expects undefined, not null. By stripping nullish values,
 * we let Zod treat them as "not provided" which matches .optional() semantics.
 * (GitHub #12362)
 *
 * @param input The input to process
 * @returns The processed input with null/undefined values stripped from objects
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
 * Coerces stringified JSON values in object properties when the schema expects
 * an array or object but the LLM returned a JSON string.
 *
 * Some LLMs (e.g., GLM4.7) return stringified JSON for array/object parameters:
 *   { "args": "[\"parse_excel.py\"]" }
 * instead of:
 *   { "args": ["parse_excel.py"] }
 *
 * This function walks the top-level properties of a plain object and attempts
 * to JSON.parse string values when the schema expects a non-string type.
 * (GitHub #12757)
 *
 * @param schema The Zod schema to check field types against
 * @param input The input to process
 * @returns The input with stringified JSON values coerced, or the original input
 */
function coerceStringifiedJsonValues(schema: StandardSchemaWithJSON<unknown>, input: unknown): unknown {
  // Only process plain objects with object schemas
  if (!isPlainObject(input)) {
    return input;
  }

  const unwrapped = unwrapZodType(schema as any);
  if (!isZodObject(unwrapped)) {
    return input;
  }

  const shape = (unwrapped as any).shape;
  if (!shape || typeof shape !== 'object') {
    return input;
  }

  let changed = false;
  const result: Record<string, unknown> = { ...input };

  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== 'string') {
      continue;
    }

    const fieldSchema = shape[key];
    if (!fieldSchema) {
      continue;
    }

    // Unwrap the field schema to find the base type
    const baseFieldSchema = unwrapZodType(fieldSchema);

    // Only attempt coercion if the schema expects a non-string type
    // and the string looks like it could be JSON (starts with [ or {)
    if (getZodTypeName(baseFieldSchema) === 'ZodString') {
      continue;
    }

    const trimmed = value.trim();
    if (
      (isZodArray(baseFieldSchema) && trimmed.startsWith('[')) ||
      (isZodObject(baseFieldSchema) && trimmed.startsWith('{'))
    ) {
      try {
        const parsed = JSON.parse(value);
        if (
          (isZodArray(baseFieldSchema) && Array.isArray(parsed)) ||
          (isZodObject(baseFieldSchema) && isPlainObject(parsed))
        ) {
          result[key] = parsed;
          changed = true;
        }
      } catch {
        // Not valid JSON, leave as-is
      }
    }
  }

  return changed ? result : input;
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
  // If no schema, or schema is not a Standard Schema (e.g. plain JSON Schema from Vercel tools),
  // return input as-is. Only validate when we have a proper Standard Schema with ~standard.validate.
  if (!schema || !('~standard' in schema)) {
    return { data: input as T };
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
  // 4. If validation fails, retry with stringified JSON values coerced to their
  //    proper types. Some LLMs (e.g. GLM4.7) return JSON arrays/objects as strings.
  //    (GitHub #12757)
  //
  // 5. If validation still fails, retry with null values stripped from object properties.
  //    This handles LLMs (e.g. Gemini) that send null for .optional() fields, where
  //    Zod expects undefined, not null. (GitHub #12362)

  // Step 1: Normalize top-level null/undefined to appropriate default
  let normalizedInput = normalizeNullishInput(schema, input);

  // Step 2: Convert undefined values to null recursively (GitHub #11457)
  normalizedInput = convertUndefinedToNull(normalizedInput);

  // Step 3: Validate the normalized input
  const validation = safeValidate(schema, normalizedInput);

  if ('value' in validation) {
    return { data: validation.value };
  }

  // Step 4: Retry with stringified JSON values coerced (GitHub #12757)
  // LLMs like GLM4.7 send stringified JSON for array/object parameters, e.g.
  // { "args": "[\"file.py\"]" } instead of { "args": ["file.py"] }.
  const coercedInput = coerceStringifiedJsonValues(schema, normalizedInput);
  if (coercedInput !== normalizedInput) {
    const coercedValidation = safeValidate(schema, coercedInput);
    if ('value' in coercedValidation) {
      return { data: coercedValidation.value };
    }
  }

  // Step 5: Retry with null values stripped (GitHub #12362)
  // LLMs like Gemini send null for optional fields, but Zod's .optional() only
  // accepts undefined, not null. By stripping nullish values and retrying, we
  // handle this case without breaking .nullable() schemas that passed in step 3.
  const strippedInput = stripNullishValues(input);
  const normalizedStripped = normalizeNullishInput(schema, strippedInput);
  const retryValidation = safeValidate(schema, normalizedStripped);

  if ('value' in retryValidation) {
    return { data: retryValidation.value };
  }

  // All attempts failed - return the original (non-stripped) error since it's
  // more informative about what the schema actually expects
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
  // If no schema, not a Standard Schema, or suspend was called, return output as-is
  if (!schema || !('~standard' in schema) || suspendCalled) {
    return { data: output as T };
  }

  // Validate the output using standard schema interface
  const validation = safeValidate(schema, output);

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

/**
 * Keys that are considered sensitive and should be redacted in error messages.
 */
const SENSITIVE_KEYS = ['password', 'secret', 'token', 'apiKey', 'api_key', 'auth', 'credential'];

/**
 * Redacts sensitive keys from an object for safe logging.
 * @param obj The object to redact
 * @returns A new object with sensitive values replaced with '[REDACTED]'
 */
function redactSensitiveKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveKeys);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some(sensitive => key.toLowerCase().includes(sensitive.toLowerCase()))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactSensitiveKeys(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Validates request context data against a schema.
 * This is used to validate the request context before tool execution.
 *
 * @param schema The schema to validate against (PublicSchema which accepts Zod v3/v4, JSONSchema, etc.)
 * @param requestContext The request context to validate
 * @param identifier Optional identifier (tool/step ID) for better error messages
 * @returns The validated data or a validation error
 */
export function validateRequestContext<T = any>(
  schema: PublicSchema<T> | undefined,
  requestContext: RequestContext | undefined,
  identifier?: string,
): { data: T | Record<string, any>; error?: ValidationError<T> } {
  // If no schema, return request context values as-is
  if (!schema) {
    return { data: (requestContext?.all ?? {}) as T };
  }

  // Get the values from request context
  const contextValues = requestContext?.all ?? {};

  // Convert PublicSchema to StandardSchemaWithJSON for validation
  const standardSchema = toStandardSchema(schema);

  // Validate using standard schema interface
  const validation = standardSchema['~standard'].validate(contextValues);

  if (validation instanceof Promise) {
    throw new Error('Your schema is async, which is not supported. Please use a sync schema.');
  }

  if ('value' in validation) {
    return { data: validation.value };
  }

  // Validation failed, return error
  const errorMessages = validation.issues.map(e => `- ${e.path?.join('.') || 'root'}: ${e.message}`).join('\n');

  // Redact sensitive keys before including in error message
  const redactedContext = redactSensitiveKeys(contextValues);

  const error: ValidationError<T> = {
    error: true,
    message: `Request context validation failed${identifier ? ` for ${identifier}` : ''}. Please fix the following errors and try again:\n${errorMessages}\n\nProvided request context: ${truncateForLogging(redactedContext)}`,
    validationErrors: buildFormattedErrors<T>(validation.issues),
  };

  return { data: contextValues as T, error };
}
