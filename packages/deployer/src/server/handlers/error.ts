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
  // An HTTPException (Hono's or @mastra/server's own class) may carry a
  // deliberately structured public response, such as the stable version-label
  // error envelope. Serve it verbatim so typed error contracts survive the
  // HTTP layer instead of being collapsed into `{ error: message }`.
  const structured = (err as { res?: unknown; getResponse?: () => Response }).res;
  if (structured instanceof Response) {
    const getResponse = (err as { getResponse?: () => Response }).getResponse;
    return typeof getResponse === 'function' ? getResponse.call(err) : structured;
  }
  if (err instanceof HTTPException) {
    if (isDev) {
      return c.json({ error: err.message, cause: err.cause, stack: err.stack }, err.status);
    }
    return c.json({ error: err.message }, err.status);
  }

  c.get('mastra').getLogger().error(err);
  return c.json({ error: 'Internal Server Error' }, 500);
}
