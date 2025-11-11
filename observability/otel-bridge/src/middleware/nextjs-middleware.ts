/**
 * Next.js middleware for automatic OTEL context extraction
 *
 * THIS FILE MUST NOT IMPORT FROM @mastra/core TO BE EDGE-COMPATIBLE
 *
 * Works with both App Router and Pages Router
 * Compatible with Edge runtime (no Node.js APIs)
 */

import { NextRequest, NextResponse } from 'next/server';

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
 * export { nextjsMiddleware as middleware } from '@mastra/otel-bridge/nextjs-middleware';
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
