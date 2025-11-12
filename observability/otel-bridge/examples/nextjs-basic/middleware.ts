/**
 * Next.js middleware to extract OTEL trace context
 *
 * NOTE: For Node.js runtime (this example), middleware is OPTIONAL.
 * OTEL auto-instrumentation (via instrumentation.ts) provides context via AsyncLocalStorage.
 *
 * This middleware is primarily needed for:
 * - Edge runtime (where AsyncLocalStorage is not available)
 * - Explicit header-based context extraction
 *
 * For standard Node.js runtime with OTEL auto-instrumentation, you can remove this file.
 */

// Uncomment if you want explicit header extraction or are using Edge runtime:
// export { nextjsMiddleware as middleware } from '@mastra/otel-bridge/nextjs-middleware';
