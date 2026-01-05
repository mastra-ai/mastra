/**
 * @mastra/prometheus
 *
 * Prometheus metrics collector for Mastra agentic applications.
 * Exports all agentic metrics in Prometheus format for scraping.
 */

export { PrometheusMetricsCollector, type PrometheusCollectorOptions } from './collector';

// Re-export the interface for type checking
export type { IExposableMetricsCollector } from '@mastra/core/observability';
