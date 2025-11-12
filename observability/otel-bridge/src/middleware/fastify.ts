/**
 * Fastify plugin for automatic OTEL context extraction
 */

import { RequestContext } from '@mastra/core/di';
import type { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import { extractOtelHeaders } from '../helpers.js';

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Request context with OTEL headers for passing to Mastra
     */
    requestContext?: RequestContext;
  }
}

/**
 * Fastify plugin to automatically extract OTEL trace context headers
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import { otelPlugin } from '@mastra/otel-bridge/middleware/fastify';
 *
 * const fastify = Fastify();
 *
 * // Register plugin
 * await fastify.register(otelPlugin);
 *
 * fastify.post('/api/chat', async (request, reply) => {
 *   // Pass request context to Mastra
 *   const result = await agent.generate({
 *     messages: [{ role: 'user', content: 'Hello' }],
 *     requestContext: request.requestContext,
 *   });
 *   return result;
 * });
 * ```
 */
const pluginCallback: FastifyPluginCallback = (fastify, opts, done) => {
  // Extract OTEL headers during request processing
  // Use preHandler instead of onRequest to ensure headers are fully parsed
  fastify.addHook('preHandler', async request => {
    const otelHeaders = extractOtelHeaders({
      traceparent: request.headers.traceparent as string | undefined,
      tracestate: request.headers.tracestate as string | undefined,
    });

    // Store context on request if we have trace headers
    if (otelHeaders.traceparent) {
      request.requestContext = new RequestContext([['otel.headers', otelHeaders]]);
    }
  });

  done();
};

// Wrap with fastify-plugin to avoid encapsulation
export const otelPlugin = fp(pluginCallback, {
  name: '@mastra/otel-bridge',
  fastify: '>=4.0.0',
});
