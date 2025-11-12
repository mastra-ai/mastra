/**
 * Next.js middleware for automatic OTEL context extraction
 *
 * Works with both App Router and Pages Router
 * Compatible with both Node.js and Edge runtimes
 */

import type { RequestContext } from '@mastra/core/di';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { extractOtelHeaders } from '../helpers.js';
// Dynamic import to avoid loading @mastra/core in Edge runtime

// Custom header names to pass OTEL context through Next.js middleware
const INTERNAL_TRACEPARENT_HEADER = 'x-mastra-otel-traceparent';
const INTERNAL_TRACESTATE_HEADER = 'x-mastra-otel-tracestate';

/**
 * Next.js middleware to automatically extract OTEL trace context headers
 * and forward them via internal headers
 *
 * @example
 * ```typescript
 * // middleware.ts (at app root)
 * export { nextjsMiddleware as middleware } from '@mastra/otel-bridge';
 * ```
 */
export function nextjsMiddleware(request: NextRequest) {
  // Extract OTEL headers from incoming request
  const traceparent = request.headers.get('traceparent');
  const tracestate = request.headers.get('tracestate');

  // If no OTEL headers present, pass through unchanged
  if (!traceparent) {
    return NextResponse.next();
  }

  // Clone the request headers and add internal headers
  const requestHeaders = new Headers(request.headers);

  if (traceparent) {
    requestHeaders.set(INTERNAL_TRACEPARENT_HEADER, traceparent);
  }

  if (tracestate) {
    requestHeaders.set(INTERNAL_TRACESTATE_HEADER, tracestate);
  }

  // Return response with modified headers
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

/**
 * Helper to extract OTEL context from Next.js request
 *
 * Use this in your API routes to get the RequestContext for Mastra
 *
 * @example
 * ```typescript
 * // app/api/chat/route.ts
 * import { getNextOtelContext } from '@mastra/otel-bridge';
 *
 * export async function POST(request: Request) {
 *   const requestContext = getNextOtelContext(request);
 *
 *   const result = await agent.generate({
 *     messages: [{ role: 'user', content: 'Hello' }],
 *     requestContext,
 *   });
 *
 *   return Response.json(result);
 * }
 * ```
 */
export function getNextOtelContext(request: Request): RequestContext | undefined {
  // Dynamically import RequestContext to avoid Edge runtime issues
  // This function is only called in API routes (Node.js runtime)
  const { RequestContext } = require('@mastra/core/di');

  const headers = request.headers;

  // Read internal headers set by middleware
  const traceparent = headers.get(INTERNAL_TRACEPARENT_HEADER);
  const tracestate = headers.get(INTERNAL_TRACESTATE_HEADER);

  // Extract and validate OTEL headers
  const otelHeaders = extractOtelHeaders({
    traceparent: traceparent || undefined,
    tracestate: tracestate || undefined,
  });

  // Only create context if we have valid trace headers
  if (otelHeaders.traceparent) {
    return new RequestContext([['otel.headers', otelHeaders]]);
  }

  return undefined;
}
