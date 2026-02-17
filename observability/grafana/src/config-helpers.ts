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
 * Resolves instance IDs, API key, and zone from config or environment variables,
 * then constructs the appropriate endpoints and Basic auth headers.
 *
 * Grafana Cloud assigns a unique instance ID per service (Tempo, Mimir, Loki).
 * You can provide per-service instance IDs, or use a single `instanceId` as fallback.
 *
 * By default, traces and metrics use the OTLP gateway, and logs use the Loki push API.
 * Each endpoint can be overridden with a direct URL from your Grafana Cloud settings.
 *
 * Endpoint resolution order (per service):
 * 1. Explicit endpoint in config (e.g., `tempoEndpoint`)
 * 2. Environment variable (e.g., `GRAFANA_CLOUD_TEMPO_ENDPOINT`)
 * 3. Zone-based default
 *
 * The exporter automatically normalizes URLs (adds `https://` if missing,
 * strips trailing slashes, and avoids double-pathing if the URL already
 * includes the API path).
 *
 * @example Using direct endpoints from Grafana Cloud settings
 * ```typescript
 * new GrafanaExporter(grafanaCloud({
 *   tempoEndpoint: 'https://tempo-prod-30-prod-us-east-3.grafana.net:443',
 *   mimirEndpoint: 'https://otlp-gateway-prod-us-east-3.grafana.net/otlp',
 *   lokiEndpoint: 'https://logs-prod-042.grafana.net',
 *   instanceId: '123456',
 *   apiKey: 'glc_...',
 * }))
 * ```
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
 * @example Per-service instance IDs
 * ```typescript
 * new GrafanaExporter(grafanaCloud({
 *   tempoInstanceId: '111111',
 *   mimirInstanceId: '222222',
 *   lokiInstanceId: '333333',
 *   apiKey: 'glc_...',
 *   zone: 'prod-eu-west-0',
 * }))
 * ```
 */
export function grafanaCloud(config: GrafanaCloudConfig = {}): GrafanaExporterConfig {
  const defaultInstanceId = config.instanceId ?? process.env['GRAFANA_CLOUD_INSTANCE_ID'];
  const apiKey = config.apiKey ?? process.env['GRAFANA_CLOUD_API_KEY'];
  const zone = config.zone ?? process.env['GRAFANA_CLOUD_ZONE'] ?? DEFAULTS.zone;

  // Resolve per-service instance IDs, falling back to the default
  const tempoInstanceId =
    config.tempoInstanceId ?? process.env['GRAFANA_CLOUD_TEMPO_INSTANCE_ID'] ?? defaultInstanceId;
  const mimirInstanceId =
    config.mimirInstanceId ?? process.env['GRAFANA_CLOUD_MIMIR_INSTANCE_ID'] ?? defaultInstanceId;
  const lokiInstanceId =
    config.lokiInstanceId ?? process.env['GRAFANA_CLOUD_LOKI_INSTANCE_ID'] ?? defaultInstanceId;

  // Grafana Cloud endpoint defaults:
  // - Traces: OTLP gateway (Tempo's native ingestion format)
  // - Metrics: Prometheus endpoint (Remote Write — native protocol)
  // - Logs: Loki endpoint (JSON push API — native protocol)
  //
  // These are zone-based defaults — override with explicit endpoints if your
  // Grafana Cloud hostnames differ (e.g., logs-prod-042.grafana.net).
  const otlpGateway = `https://otlp-gateway-${zone}.grafana.net/otlp`;

  const result: GrafanaExporterConfig = {
    tempoEndpoint:
      config.tempoEndpoint ??
      process.env['GRAFANA_CLOUD_TEMPO_ENDPOINT'] ??
      otlpGateway,

    mimirEndpoint:
      config.mimirEndpoint ??
      process.env['GRAFANA_CLOUD_MIMIR_ENDPOINT'] ??
      `https://prometheus-${zone}.grafana.net`,

    lokiEndpoint:
      config.lokiEndpoint ??
      process.env['GRAFANA_CLOUD_LOKI_ENDPOINT'] ??
      `https://logs-${zone}.grafana.net`,
  };

  if (apiKey) {
    // Check if any per-service IDs differ from each other
    const allSame = tempoInstanceId === mimirInstanceId && mimirInstanceId === lokiInstanceId;

    if (allSame && tempoInstanceId) {
      // All services share the same instance ID — use a single auth
      result.auth = { type: 'basic', username: tempoInstanceId, password: apiKey };
      result.tenantId = tempoInstanceId;
    } else {
      // Per-service instance IDs differ — set per-service auth
      if (tempoInstanceId) {
        result.tempoAuth = { type: 'basic', username: tempoInstanceId, password: apiKey };
        result.tempoTenantId = tempoInstanceId;
      }
      if (mimirInstanceId) {
        result.mimirAuth = { type: 'basic', username: mimirInstanceId, password: apiKey };
        result.mimirTenantId = mimirInstanceId;
      }
      if (lokiInstanceId) {
        result.lokiAuth = { type: 'basic', username: lokiInstanceId, password: apiKey };
        result.lokiTenantId = lokiInstanceId;
      }
    }
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
