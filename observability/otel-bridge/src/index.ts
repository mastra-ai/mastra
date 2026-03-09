/**
 * @mastra/otel-bridge
 *
 * OpenTelemetry Bridge for Mastra Observability
 *
 * Enables bidirectional integration with OpenTelemetry infrastructure:
 *
 * **From OTEL to Mastra:**
 * - Reads from OTEL ambient context (AsyncLocalStorage) automatically
 * - Inherits trace ID and parent span ID from active OTEL spans
 * - Extracts W3C trace context from headers when needed
 *
 * **From Mastra to OTEL:**
 * - Creates real OTEL spans for Mastra spans
 * - Maintains proper parent-child relationships in distributed traces
 * - Allows OTEL-instrumented code (HTTP clients, DB calls) to nest under Mastra spans
 */

export * from './bridge.js';
