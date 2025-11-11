/**
 * Hono middleware for automatic OTEL context extraction
 *
 * This middleware works universally across all Hono environments:
 * - Node.js, Bun, Deno
 * - Cloudflare Workers, Vercel Edge, Netlify Edge
 * - Any platform that supports Hono
 */

import { createMiddleware } from 'hono/factory';
import { RequestContext } from '@mastra/core/di';
import { extractOtelHeaders } from '../helpers.js';

/**
 * Hono middleware to automatically extract OTEL trace context headers
 * and make them available to Mastra agents/workflows
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import { otelMiddleware } from '@mastra/otel-bridge/middleware/hono';
 *
 * const app = new Hono();
 *
 * // Add middleware globally
 * app.use('*', otelMiddleware());
 *
 * app.post('/api/chat', async (c) => {
 *   // Get request context and pass to Mastra
 *   const requestContext = c.get('requestContext');
 *   const result = await agent.generate({
 *     messages: [{ role: 'user', content: 'Hello' }],
 *     requestContext,
 *   });
 *   return c.json(result);
 * });
 * ```
 */
export function otelMiddleware() {
  return createMiddleware(async (c, next) => {
    // Extract OTEL headers from request
    const otelHeaders = extractOtelHeaders({
      traceparent: c.req.header('traceparent'),
      tracestate: c.req.header('tracestate'),
    });

    // Store context in Hono context if we have trace headers
    if (otelHeaders.traceparent) {
      c.set('requestContext', new RequestContext([['otel.headers', otelHeaders]]));
    }

    await next();
  });
}
