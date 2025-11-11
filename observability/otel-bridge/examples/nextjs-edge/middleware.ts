/**
 * Next.js middleware to extract OTEL trace context
 *
 * This runs before all requests and extracts traceparent/tracestate headers
 */

export { nextjsMiddleware as middleware } from '@mastra/otel-bridge/nextjs-middleware';
