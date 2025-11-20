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
 *
 * @example Standard OTEL Setup
 * ```typescript
 * // instrumentation.js (import FIRST, before other code)
 * import { NodeSDK } from '@opentelemetry/sdk-node';
 * import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
 * import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
 *
 * const sdk = new NodeSDK({
 *   serviceName: 'my-service',
 *   traceExporter: new OTLPTraceExporter(),
 *   instrumentations: [getNodeAutoInstrumentations()],
 * });
 * sdk.start();
 * ```
 *
 * @example Mastra Configuration
 * ```typescript
 * import { OtelBridge } from '@mastra/otel-bridge';
 * import { Mastra } from '@mastra/core';
 * import { Observability } from '@mastra/observability';
 *
 * const mastra = new Mastra({
 *   observability: new Observability({
 *     configs: {
 *       default: {
 *         serviceName: 'my-service',
 *         bridge: new OtelBridge(),
 *       }
 *     }
 *   })
 * });
 * ```
 *
 */

// Core bridge
export { OtelBridge } from './bridge.js';
export type { OtelBridgeConfig } from './bridge.js';
