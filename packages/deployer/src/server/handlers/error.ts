import { isServerProblem } from '@mastra/server/error-codes';
import type { ServerErrorCode, ServerProblem } from '@mastra/server/error-codes';
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

function getProblem(err: Error): ServerProblem {
  const problem = (err as { problem?: unknown }).problem;
  return isServerProblem(problem) ? problem : { code: 'UNEXPECTED_ERROR' };
}

export function errorHandler(err: Error, c: Context, isDev?: boolean): Response {
  if (err instanceof HTTPException || err instanceof ServerHTTPException) {
    const status = err.status as ContentfulStatusCode;
    const problem = getProblem(err);
    if (isDev) {
      return c.json({ error: err.message, problem, cause: err.cause, stack: err.stack }, status);
    }
    return c.json({ error: err.message, problem }, status);
  }

  c.get('mastra').getLogger().error(err);
  return c.json({ error: 'Internal Server Error', problem: { code: 'UNEXPECTED_ERROR' } satisfies ServerProblem }, 500);
}
