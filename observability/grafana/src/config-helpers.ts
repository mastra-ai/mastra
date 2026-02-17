/**
 * Configuration helpers for GrafanaExporter.
 *
 * These helpers resolve provider-specific configuration (endpoints, auth)
 * into the unified GrafanaExporterConfig format, following the same pattern
 * as @mastra/otel-exporter's provider configs.
 */

import type { GrafanaCloudConfig, GrafanaExporterConfig, GrafanaSelfHostedConfig } from './types.js';
import { DEFAULTS } from './types.js';

/**
 * Configure GrafanaExporter for **Grafana Cloud**.
 *
 * Resolves instance ID, API key, and zone from config or environment variables,
 * then constructs the appropriate endpoints and Basic auth headers.
 *
 * Grafana Cloud uses a unified OTLP gateway for traces and metrics:
 * - Traces: `https://otlp-gateway-{zone}.grafana.net/otlp/v1/traces`
 * - Metrics: `https://otlp-gateway-{zone}.grafana.net/otlp/v1/metrics`
 * - Logs: `https://logs-{zone}.grafana.net/loki/api/v1/push`
 *
 * @example Zero-config (env vars only)
 * ```bash
 * GRAFANA_CLOUD_INSTANCE_ID=123456
 * GRAFANA_CLOUD_API_KEY=glc_...
 * GRAFANA_CLOUD_ZONE=prod-us-central-0
 * ```
 * ```typescript
 * new GrafanaExporter(grafanaCloud())
 * ```
 *
 * @example Explicit config
 * ```typescript
 * new GrafanaExporter(grafanaCloud({
 *   instanceId: '123456',
 *   apiKey: 'glc_...',
 *   zone: 'prod-eu-west-0',
 * }))
 * ```
 */
export function grafanaCloud(config: GrafanaCloudConfig = {}): GrafanaExporterConfig {
  const instanceId = config.instanceId ?? process.env['GRAFANA_CLOUD_INSTANCE_ID'];
  const apiKey = config.apiKey ?? process.env['GRAFANA_CLOUD_API_KEY'];
  const zone = config.zone ?? process.env['GRAFANA_CLOUD_ZONE'] ?? DEFAULTS.zone;

  // Grafana Cloud uses a unified OTLP gateway for traces and metrics,
  // and the standard Loki endpoint for logs.
  const otlpGateway = `https://otlp-gateway-${zone}.grafana.net/otlp`;

  const result: GrafanaExporterConfig = {
    tempoEndpoint:
      config.tempoEndpoint ??
      process.env['GRAFANA_CLOUD_TEMPO_ENDPOINT'] ??
      otlpGateway,

    mimirEndpoint:
      config.mimirEndpoint ??
      process.env['GRAFANA_CLOUD_MIMIR_ENDPOINT'] ??
      otlpGateway,

    lokiEndpoint:
      config.lokiEndpoint ??
      process.env['GRAFANA_CLOUD_LOKI_ENDPOINT'] ??
      `https://logs-${zone}.grafana.net`,
  };

  // Set up Basic auth if credentials are available
  if (instanceId && apiKey) {
    result.auth = { type: 'basic', username: instanceId, password: apiKey };
    result.tenantId = instanceId;
  }

  return result;
}

/**
 * Configure GrafanaExporter for a **self-hosted Grafana stack** (Tempo + Mimir + Loki).
 *
 * Resolves endpoints from config or environment variables.
 * Auth defaults to none for local development.
 *
 * Endpoint conventions:
 * - `tempoEndpoint`: OTLP base — exporter appends `/v1/traces`
 * - `mimirEndpoint`: OTLP base — exporter appends `/v1/metrics` (include `/otlp` prefix if needed)
 * - `lokiEndpoint`: Loki base — exporter appends `/loki/api/v1/push`
 *
 * @example Local Docker Compose setup (no auth)
 * ```typescript
 * new GrafanaExporter(grafana({
 *   tempoEndpoint: 'http://localhost:4318',
 *   mimirEndpoint: 'http://localhost:9090/otlp',
 *   lokiEndpoint: 'http://localhost:3100',
 * }))
 * ```
 *
 * @example Self-hosted with Bearer token
 * ```typescript
 * new GrafanaExporter(grafana({
 *   tempoEndpoint: 'https://tempo.internal.example.com',
 *   mimirEndpoint: 'https://mimir.internal.example.com/otlp',
 *   lokiEndpoint: 'https://loki.internal.example.com',
 *   auth: { type: 'bearer', token: process.env.GRAFANA_TOKEN },
 * }))
 * ```
 *
 * @example Zero-config with env vars
 * ```bash
 * GRAFANA_TEMPO_ENDPOINT=http://tempo:4318
 * GRAFANA_MIMIR_ENDPOINT=http://mimir:9090/otlp
 * GRAFANA_LOKI_ENDPOINT=http://loki:3100
 * ```
 * ```typescript
 * new GrafanaExporter(grafana())
 * ```
 */
export function grafana(config: GrafanaSelfHostedConfig = {}): GrafanaExporterConfig {
  return {
    tempoEndpoint: config.tempoEndpoint ?? process.env['GRAFANA_TEMPO_ENDPOINT'],
    mimirEndpoint: config.mimirEndpoint ?? process.env['GRAFANA_MIMIR_ENDPOINT'],
    lokiEndpoint: config.lokiEndpoint ?? process.env['GRAFANA_LOKI_ENDPOINT'],
    auth: config.auth ?? { type: 'none' },
    tenantId: config.tenantId,
  };
}
