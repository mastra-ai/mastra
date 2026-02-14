import type { BaseExporterConfig } from '@mastra/observability';

/**
 * Configuration for the GrafanaCloudExporter.
 *
 * Grafana Cloud provides three backends:
 * - **Tempo** for traces (accepts OTLP/HTTP JSON)
 * - **Mimir** for metrics (accepts OTLP/HTTP JSON)
 * - **Loki** for logs (accepts JSON push API)
 *
 * Authentication uses Basic auth with `instanceId:apiKey` for all endpoints.
 */
export interface GrafanaCloudExporterConfig extends BaseExporterConfig {
  /**
   * Grafana Cloud instance ID (numeric).
   * Found in Grafana Cloud portal under your stack details.
   * Falls back to `GRAFANA_CLOUD_INSTANCE_ID` env var.
   */
  instanceId?: string;

  /**
   * Grafana Cloud API key (or service account token).
   * Must have write permissions for traces, metrics, and logs.
   * Falls back to `GRAFANA_CLOUD_API_KEY` env var.
   */
  apiKey?: string;

  /**
   * Tempo OTLP endpoint for traces.
   * Defaults to `https://tempo-{zone}.grafana.net`
   * Falls back to `GRAFANA_CLOUD_TEMPO_ENDPOINT` env var.
   */
  tempoEndpoint?: string;

  /**
   * Mimir OTLP endpoint for metrics.
   * Defaults to `https://mimir-{zone}.grafana.net`
   * Falls back to `GRAFANA_CLOUD_MIMIR_ENDPOINT` env var.
   */
  mimirEndpoint?: string;

  /**
   * Loki endpoint for logs.
   * Defaults to `https://logs-{zone}.grafana.net`
   * Falls back to `GRAFANA_CLOUD_LOKI_ENDPOINT` env var.
   */
  lokiEndpoint?: string;

  /**
   * Grafana Cloud zone (e.g., 'prod-us-central-0', 'prod-eu-west-0').
   * Used to construct default endpoints when explicit endpoints are not provided.
   * Falls back to `GRAFANA_CLOUD_ZONE` env var.
   * @default 'prod-us-central-0'
   */
  zone?: string;

  /**
   * Maximum number of items to buffer before flushing for each signal.
   * @default 100
   */
  batchSize?: number;

  /**
   * Maximum time in ms between automatic flushes.
   * @default 5000
   */
  flushIntervalMs?: number;

  /**
   * Service name attached to all telemetry data.
   * Falls back to 'mastra-service'.
   */
  serviceName?: string;
}

/** Default configuration values */
export const DEFAULTS = {
  zone: 'prod-us-central-0',
  batchSize: 100,
  flushIntervalMs: 5000,
  serviceName: 'mastra-service',
} as const;
