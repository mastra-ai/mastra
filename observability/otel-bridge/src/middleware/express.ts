/**
 * Express middleware for automatic OTEL context extraction
 */

import { RequestContext } from '@mastra/core/di';
import type { Request, Response, NextFunction } from 'express';
import { extractOtelHeaders } from '../helpers.js';

declare global {
  namespace Express {
    interface Request {
      /**
       * Request context with OTEL headers for passing to Mastra
       */
      requestContext?: RequestContext;
    }
  }
}

/**
 * Express middleware to automatically extract OTEL trace context headers
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { otelMiddleware } from '@mastra/otel-bridge/middleware/express';
 *
 * const app = express();
 *
 * // Add middleware globally
 * app.use(otelMiddleware());
 *
 * app.post('/api/chat', async (req, res) => {
 *   // Pass request context to Mastra
 *   const result = await agent.generate({
 *     messages: [{ role: 'user', content: 'Hello' }],
 *     requestContext: req.requestContext,
 *   });
 *   res.json(result);
 * });
 * ```
 */
export function otelMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Extract OTEL headers from request
    const otelHeaders = extractOtelHeaders({
      traceparent: req.headers.traceparent as string | undefined,
      tracestate: req.headers.tracestate as string | undefined,
    });

    // Store context on request if we have trace headers
    if (otelHeaders.traceparent) {
      req.requestContext = new RequestContext([['otel.headers', otelHeaders]]);
    }

    next();
  };
}
