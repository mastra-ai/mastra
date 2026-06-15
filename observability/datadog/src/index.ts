/**
 * Datadog integration for Mastra Observability
 *
 * Provides two integration modes:
 *
 * - DatadogBridge: Recommended for most users. Creates native dd-trace spans
 *   in real-time for proper APM context propagation, and emits LLMObs data
 *   through dd-trace's own pipeline. Use as an observability bridge.
 *
 * - DatadogExporter: Legacy exporter-only mode. Emits LLMObs spans
 *   retroactively after execution completes. Does not participate in
 *   dd-trace's live scope, so auto-instrumented APM spans (HTTP, DB)
 *   will not be parented under Mastra spans.
 */

export { DatadogBridge } from './bridge';
export type { DatadogBridgeConfig } from './bridge';

export { DatadogExporter } from './tracing';
export type { DatadogExporterConfig } from './tracing';
