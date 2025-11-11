/**
 * Helper functions for extracting and creating OTEL context
 */

/**
 * Extract OTEL trace context headers from HTTP headers
 *
 * @param headers - HTTP headers object
 * @returns Object with traceparent and tracestate if present
 *
 * @example
 * ```typescript
 * const otelHeaders = extractOtelHeaders({
 *   traceparent: req.header('traceparent'),
 *   tracestate: req.header('tracestate'),
 * });
 * ```
 */
export function extractOtelHeaders(headers: Record<string, string | undefined>): {
  traceparent?: string;
  tracestate?: string;
} {
  return {
    traceparent: headers['traceparent'],
    tracestate: headers['tracestate'],
  };
}

/**
 * Create a RequestContext Map with OTEL headers
 *
 * @param headers - HTTP headers object
 * @returns Map suitable for RequestContext.with()
 *
 * @example
 * ```typescript
 * import { RequestContext } from '@mastra/core/di';
 *
 * const context = createOtelContext({
 *   traceparent: req.header('traceparent'),
 *   tracestate: req.header('tracestate'),
 * });
 *
 * await RequestContext.with(context, async () => {
 *   await agent.generate(...);
 * });
 * ```
 */
export function createOtelContext(headers: Record<string, string | undefined>): Map<string, any> {
  return new Map([['otel.headers', extractOtelHeaders(headers)]]);
}
