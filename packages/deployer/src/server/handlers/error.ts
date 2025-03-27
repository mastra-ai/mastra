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
