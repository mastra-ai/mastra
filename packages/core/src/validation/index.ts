/**
 * Unified Schema Validation
 *
 * This module provides validation utilities that work with both:
 * - Zod schemas (native, preferred)
 * - Standard Schema compatible libraries (Valibot, ArkType, etc.)
 *
 * Usage:
 * - Use `validateSync` for synchronous validation (tools, etc.)
 * - Use `validateAsync` for async validation (workflows, etc.)
 */

import type { z } from 'zod';
import { isStandardSchema, type StandardSchemaV1 } from '../types/standard-schema';
import type { ZodLikeSchema } from '../types/zod-compat';

/**
 * Result of a successful validation.
 */
export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

/**
 * Result of a failed validation.
 */
export interface ValidationFailure {
  success: false;
  error: Error;
  issues: ValidationIssue[];
  /** The original error from the validation library (e.g., ZodError) */
  cause?: unknown;
}

/**
 * A single validation issue.
 */
export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Checks if a schema has Zod's safeParse method.
 */
export function hasZodSafeParse(
  schema: unknown,
): schema is { safeParse: (data: unknown) => { success: boolean; data?: any; error?: any } } {
  return (
    typeof schema === 'object' &&
    schema !== null &&
    'safeParse' in schema &&
    typeof (schema as any).safeParse === 'function'
  );
}

/**
 * Checks if a schema has Zod's safeParseAsync method.
 */
export function hasZodSafeParseAsync(
  schema: unknown,
): schema is { safeParseAsync: (data: unknown) => Promise<{ success: boolean; data?: any; error?: any }> } {
  return (
    typeof schema === 'object' &&
    schema !== null &&
    'safeParseAsync' in schema &&
    typeof (schema as any).safeParseAsync === 'function'
  );
}

/**
 * Converts Zod issues to ValidationIssue format.
 */
function zodIssuesToValidationIssues(zodError: z.ZodError): ValidationIssue[] {
  return zodError.issues.map((issue: z.ZodIssue) => ({
    // Use empty string for root-level errors to match Zod's original formatting
    path: issue.path?.join('.') || '',
    message: issue.message,
  }));
}

/**
 * Converts Standard Schema issues to ValidationIssue format.
 */
function standardSchemaIssuesToValidationIssues(issues: ReadonlyArray<StandardSchemaV1.Issue>): ValidationIssue[] {
  return issues.map(issue => ({
    path:
      issue.path
        ?.map(segment => (typeof segment === 'object' && 'key' in segment ? String(segment.key) : String(segment)))
        .join('.') || 'root',
    message: issue.message,
  }));
}

/**
 * Formats validation issues into a human-readable error message.
 */
export function formatValidationIssues(issues: ValidationIssue[]): string {
  return issues.map(issue => `- ${issue.path}: ${issue.message}`).join('\n');
}

/**
 * Validates data synchronously using either Zod or Standard Schema.
 *
 * Priority:
 * 1. Zod's safeParse (native, preferred)
 * 2. Standard Schema's ~standard.validate (fallback)
 *
 * @param schema The schema to validate against
 * @param data The data to validate
 * @returns ValidationResult with success/failure and data/issues
 */
export function validateSync<T = unknown>(schema: ZodLikeSchema, data: unknown): ValidationResult<T> {
  // Priority 1: Zod's safeParse (native, preferred)
  if (hasZodSafeParse(schema)) {
    const result = schema.safeParse(data);

    if (result.success) {
      return { success: true, data: result.data as T };
    }

    const issues = zodIssuesToValidationIssues(result.error);
    return {
      success: false,
      error: new Error(formatValidationIssues(issues)),
      issues,
      cause: result.error, // Preserve original ZodError
    };
  }

  // Priority 2: Standard Schema's ~standard.validate
  if (isStandardSchema(schema)) {
    const result = schema['~standard'].validate(data);

    // Handle async validation (shouldn't happen in sync context, but be safe)
    if (result instanceof Promise) {
      console.warn('Standard Schema async validation not supported in sync context, returning data as-is');
      return { success: true, data: data as T };
    }

    if (!result.issues) {
      return { success: true, data: result.value as T };
    }

    const issues = standardSchemaIssuesToValidationIssues(result.issues);
    return {
      success: false,
      error: new Error(formatValidationIssues(issues)),
      issues,
      cause: result.issues, // Preserve original issues
    };
  }

  // No recognized schema - return data as-is
  return { success: true, data: data as T };
}

/**
 * Validates data asynchronously using either Zod or Standard Schema.
 *
 * Priority:
 * 1. Zod's safeParseAsync (native, preferred)
 * 2. Standard Schema's ~standard.validate (may be async)
 *
 * @param schema The schema to validate against
 * @param data The data to validate
 * @returns Promise<ValidationResult> with success/failure and data/issues
 */
export async function validateAsync<T = unknown>(schema: ZodLikeSchema, data: unknown): Promise<ValidationResult<T>> {
  // Priority 1: Zod's safeParseAsync (native, preferred)
  if (hasZodSafeParseAsync(schema)) {
    const result = await schema.safeParseAsync(data);

    if (result.success) {
      return { success: true, data: result.data as T };
    }

    const issues = zodIssuesToValidationIssues(result.error);
    return {
      success: false,
      error: new Error(formatValidationIssues(issues)),
      issues,
      cause: result.error, // Preserve original ZodError
    };
  }

  // Priority 2: Standard Schema's ~standard.validate (may be async)
  if (isStandardSchema(schema)) {
    const result = await schema['~standard'].validate(data);

    if (!result.issues) {
      return { success: true, data: result.value as T };
    }

    const issues = standardSchemaIssuesToValidationIssues(result.issues);
    return {
      success: false,
      error: new Error(formatValidationIssues(issues)),
      issues,
      cause: result.issues, // Preserve original issues
    };
  }

  // No recognized schema - return data as-is
  return { success: true, data: data as T };
}

/**
 * Creates an error message for validation failure.
 */
export function createValidationErrorMessage(context: string, issues: ValidationIssue[], data?: unknown): string {
  let message = `${context}:\n${formatValidationIssues(issues)}`;

  if (data !== undefined) {
    try {
      const truncated = JSON.stringify(data, null, 2);
      const maxLength = 200;
      const dataStr = truncated.length > maxLength ? truncated.slice(0, maxLength) + '... (truncated)' : truncated;
      message += `\n\nProvided data: ${dataStr}`;
    } catch {
      // Ignore serialization errors
    }
  }

  return message;
}
