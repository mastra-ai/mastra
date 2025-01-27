import type { Context } from 'hono';

import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { ApiError } from '../types';

// Helper to handle errors consistently
export function handleError(error: unknown, defaultMessage: string): Promise<Response> {
  console.error(defaultMessage, error);
  const apiError = error as ApiError;
  throw new HTTPException((apiError.status || 500) as ContentfulStatusCode, {
    message: apiError.message || defaultMessage,
  });
}

// Error handlers
export function notFoundHandler() {
  throw new HTTPException(404, { message: 'Not Found' });
}

export function errorHandler(err: Error, c: Context): Response {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }

  console.error(err);
  return c.json({ error: 'Internal Server Error' }, 500);
}
