import { HTTPException } from '../http-exception';
import type { StatusCode } from '../http-exception';
import type { ApiError } from '../types';

/**
 * Duck-typed interface for ZodError-like objects (works with both Zod v3 and v4)
 * Note: Zod v4 uses PropertyKey[] (string | number | symbol) for path
 */
interface ZodErrorLike {
  issues: Array<{
    path: PropertyKey[];
    message: string;
  }>;
}

/**
 * Formats a ZodError into a structured validation error response.
 * Returns an object with an error message and an array of field-specific issues.
 * Accepts both Zod v3 and v4 ZodError objects via duck typing.
 */
export function formatZodError(
  error: ZodErrorLike,
  context: string,
): { error: string; issues: Array<{ field: string; message: string }> } {
  const issues = error.issues.map(e => ({
    field: e.path.length > 0 ? e.path.map(p => String(p)).join('.') : 'root',
    message: e.message,
  }));

  return {
    error: `Invalid ${context}`,
    issues,
  };
}

// Helper to handle errors consistently
export function handleError(error: unknown, defaultMessage: string): never {
  const apiError = error as ApiError;

  const apiErrorStatus = apiError.status || apiError.details?.status || 500;

  throw new HTTPException(apiErrorStatus as StatusCode, {
    message: apiError.message || defaultMessage,
    stack: apiError.stack,
    cause: apiError.cause,
  });
}
