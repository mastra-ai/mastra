import { SERVER_ERROR_CODES, getServerErrorInfo } from '@mastra/server/error-codes';
import type { ServerErrorCode, ServerErrorInfo } from '@mastra/server/error-codes';
import { HTTPException as ServerHTTPException } from '@mastra/server/server-adapter';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { ApiError } from '../types';

// Helper to handle errors consistently
export function handleError(error: unknown, fallback: { message: string; code: ServerErrorCode }): Promise<Response> {
  if (error instanceof ServerHTTPException) {
    throw error;
  }
  const apiError = error as ApiError;
  throw new ServerHTTPException((apiError.status || 500) as ContentfulStatusCode, {
    message: apiError.message || fallback.message,
    code: fallback.code,
    cause: apiError.cause,
  });
}

// An HTTP exception without a business code (for example Hono's, thrown by a custom route)
// was thrown on purpose, so it is uncategorized rather than unexpected.
function getErrorInfo(err: Error): ServerErrorInfo {
  return getServerErrorInfo(err) ?? { code: SERVER_ERROR_CODES.UNCATEGORIZED_ERROR };
}

export function errorHandler(err: Error, c: Context, isDev?: boolean): Response {
  if (err instanceof HTTPException || err instanceof ServerHTTPException) {
    const status = err.status as ContentfulStatusCode;
    const errorInfo = getErrorInfo(err);
    if (isDev) {
      return c.json({ error: err.message, ...errorInfo, cause: err.cause, stack: err.stack }, status);
    }
    return c.json({ error: err.message, ...errorInfo }, status);
  }

  c.get('mastra').getLogger().error(err);
  return c.json({ error: 'Internal Server Error', code: SERVER_ERROR_CODES.UNEXPECTED_ERROR }, 500);
}
