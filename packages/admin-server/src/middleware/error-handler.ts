import { MastraAdminError, AdminErrorDomain } from '@mastra/admin';
import type { Context } from 'hono';

import type { ErrorResponse } from '../types';

/**
 * Map AdminErrorDomain to HTTP status codes.
 */
const ERROR_STATUS_MAP: Record<string, number> = {
  [AdminErrorDomain.LICENSE]: 402,
  [AdminErrorDomain.RBAC]: 403,
  [AdminErrorDomain.STORAGE]: 500,
  [AdminErrorDomain.RUNNER]: 500,
  [AdminErrorDomain.ROUTER]: 500,
  [AdminErrorDomain.SOURCE]: 500,
  [AdminErrorDomain.BILLING]: 402,
  [AdminErrorDomain.ADMIN]: 500,
  [AdminErrorDomain.BUILD]: 500,
  [AdminErrorDomain.DEPLOYMENT]: 400,
  [AdminErrorDomain.PROJECT]: 400,
  [AdminErrorDomain.TEAM]: 400,
};

/**
 * Format Zod validation error.
 */
function formatZodError(error: unknown): {
  error: string;
  details: { issues: Array<{ path: string; message: string }> };
} {
  const zodError = error as { issues?: Array<{ path: (string | number)[]; message: string }> };
  const issues = (zodError.issues ?? []).map(issue => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));

  return {
    error: 'Validation error',
    details: { issues },
  };
}

/**
 * Global error handler for AdminServer.
 */
export function errorHandler(err: Error, c: Context): Response {
  const requestId = c.get('requestId') as string | undefined;

  // Handle MastraAdminError
  if (err instanceof MastraAdminError) {
    const status = ERROR_STATUS_MAP[err.domain] || 500;
    const response: ErrorResponse = {
      error: err.message,
      code: err.id,
      details: err.details,
      requestId,
    };
    return c.json(response, status as Parameters<typeof c.json>[1]);
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    const formatted = formatZodError(err);
    return c.json(
      {
        ...formatted,
        code: 'VALIDATION_ERROR',
        requestId,
      },
      400,
    );
  }

  // Handle generic errors
  console.error('Unhandled error:', err);
  return c.json(
    {
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      requestId,
    },
    500,
  );
}
