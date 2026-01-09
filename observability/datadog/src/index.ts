/**
 * Datadog LLM Observability Exporter for Mastra
 *
 * Exports Mastra observability data to Datadog's LLM Observability product.
 * Uses a completion-only pattern where spans are emitted on span_ended events.
 */

export { DatadogExporter } from './tracing';
export type { DatadogExporterConfig } from './tracing';
