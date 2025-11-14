import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { ApiError } from '../types';

// Helper to handle errors consistently
export function handleError(error: unknown, defaultMessage: string): Promise<Response> {
  const apiError = error as ApiError;
  throw new HTTPException((apiError.status || 500) as ContentfulStatusCode, {
    message: apiError.message || defaultMessage,
    cause: apiError.cause,
  });
}
export function errorHandler(err: Error, c: Context, isDev?: boolean): Response {
  if (err instanceof HTTPException) {
    if (isDev) {
      return c.json({ error: err.message, cause: err.cause, stack: err.stack }, err.status);
    }
    return c.json({ error: err.message }, err.status);
  }

  c.get('mastra').getLogger().error(err);
  return c.json({ error: 'Internal Server Error' }, 500);
}
