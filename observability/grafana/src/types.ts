import type { BaseExporterConfig } from '@mastra/observability';

/**
 * Authentication configuration for Grafana endpoints.
 */
export type GrafanaAuth =
  | {
      /** Basic auth with username:password (Grafana Cloud uses instanceId:apiKey) */
      type: 'basic';
      username: string;
      password: string;
    }
  | {
      /** Bearer token auth */
      type: 'bearer';
      token: string;
    }
  | {
      /** Custom headers for auth (e.g., behind a reverse proxy) */
      type: 'custom';
      headers: Record<string, string>;
    }
  | {
      /** No authentication (e.g., local development) */
      type: 'none';
    };

/**
 * Configuration for the GrafanaExporter.
 *
 * Supports both Grafana Cloud and self-hosted Grafana stack (Tempo + Mimir + Loki).
 *
 * Use the `grafanaCloud()` or `grafana()` config helpers for easy setup.
 */
export interface GrafanaExporterConfig extends BaseExporterConfig {
  /**
   * Tempo endpoint for traces (OTLP/HTTP JSON).
   * Exporter appends `/v1/traces`.
   * - Cloud default: `https://otlp-gateway-{zone}.grafana.net/otlp`
   * - Self-hosted example: `http://localhost:4318`
   * Falls back to `GRAFANA_TEMPO_ENDPOINT` env var.
   */
  tempoEndpoint?: string;

  /**
   * Mimir endpoint for metrics (OTLP/HTTP JSON).
   * Exporter appends `/v1/metrics`.
   * - Cloud default: `https://otlp-gateway-{zone}.grafana.net/otlp`
   * - Self-hosted example: `http://localhost:9090/otlp`
   * Falls back to `GRAFANA_MIMIR_ENDPOINT` env var.
   */
  mimirEndpoint?: string;

  /**
   * Loki endpoint for logs (JSON push API).
   * - Cloud default: `https://logs-{zone}.grafana.net`
   * - Self-hosted example: `http://localhost:3100`
   * Falls back to `GRAFANA_LOKI_ENDPOINT` env var.
   */
  lokiEndpoint?: string;

  /**
   * Default authentication configuration, used for all services unless overridden.
   * Use the `grafanaCloud()` or `grafana()` helpers to construct this.
   */
  auth?: GrafanaAuth;

  /**
   * Per-service auth override for Tempo (traces).
   * Falls back to `auth` if not set.
   */
  tempoAuth?: GrafanaAuth;

  /**
   * Per-service auth override for Mimir (metrics).
   * Falls back to `auth` if not set.
   */
  mimirAuth?: GrafanaAuth;

  /**
   * Per-service auth override for Loki (logs).
   * Falls back to `auth` if not set.
   */
  lokiAuth?: GrafanaAuth;

  /**
   * Default tenant ID for multi-tenant Grafana deployments.
   * Sent as `X-Scope-OrgID` header.
   * For Grafana Cloud, this is the instance ID.
   */
  tenantId?: string;

  /**
   * Per-service tenant ID override for Tempo (traces).
   * Falls back to `tenantId` if not set.
   */
  tempoTenantId?: string;

  /**
   * Per-service tenant ID override for Mimir (metrics).
   * Falls back to `tenantId` if not set.
   */
  mimirTenantId?: string;

  /**
   * Per-service tenant ID override for Loki (logs).
   * Falls back to `tenantId` if not set.
   */
  lokiTenantId?: string;

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
   * Overridden by ObservabilityInstanceConfig.serviceName if available.
   * @default 'mastra-service'
   */
  serviceName?: string;
}

/**
 * Grafana Cloud-specific configuration used by the `grafanaCloud()` helper.
 *
 * Grafana Cloud assigns a unique instance ID per service (Tempo, Mimir, Loki).
 * You can specify per-service instance IDs, or use a single `instanceId` as a fallback.
 */
export interface GrafanaCloudConfig {
  /**
   * Default Grafana Cloud instance ID (numeric).
   * Used as fallback when per-service instance IDs are not set.
   * Found in Grafana Cloud portal under your stack details.
   * Falls back to `GRAFANA_CLOUD_INSTANCE_ID` env var.
   */
  instanceId?: string;

  /**
   * Tempo (traces) instance ID.
   * Falls back to `GRAFANA_CLOUD_TEMPO_INSTANCE_ID` env var, then `instanceId`.
   */
  tempoInstanceId?: string;

  /**
   * Mimir (metrics) instance ID.
   * Falls back to `GRAFANA_CLOUD_MIMIR_INSTANCE_ID` env var, then `instanceId`.
   */
  mimirInstanceId?: string;

  /**
   * Loki (logs) instance ID.
   * Falls back to `GRAFANA_CLOUD_LOKI_INSTANCE_ID` env var, then `instanceId`.
   */
  lokiInstanceId?: string;

  /**
   * Grafana Cloud API key (or service account token).
   * Must have write permissions for traces, metrics, and logs.
   * Falls back to `GRAFANA_CLOUD_API_KEY` env var.
   */
  apiKey?: string;

  /**
   * Grafana Cloud zone (e.g., 'prod-us-central-0', 'prod-eu-west-0').
   * Used to construct default endpoints.
   * Falls back to `GRAFANA_CLOUD_ZONE` env var.
   * @default 'prod-us-central-0'
   */
  zone?: string;

  /** Override the default Tempo endpoint. */
  tempoEndpoint?: string;

  /** Override the default Mimir endpoint. */
  mimirEndpoint?: string;

  /** Override the default Loki endpoint. */
  lokiEndpoint?: string;
}

/**
 * Self-hosted Grafana stack configuration used by the `grafana()` helper.
 */
export interface GrafanaSelfHostedConfig {
  /**
   * Tempo endpoint for traces (OTLP/HTTP JSON).
   * Falls back to `GRAFANA_TEMPO_ENDPOINT` env var.
   * @example 'http://localhost:4318'
   */
  tempoEndpoint?: string;

  /**
   * Mimir endpoint for metrics (OTLP/HTTP JSON).
   * Falls back to `GRAFANA_MIMIR_ENDPOINT` env var.
   * @example 'http://localhost:9090/otlp'
   */
  mimirEndpoint?: string;

  /**
   * Loki endpoint for logs (JSON push API).
   * Falls back to `GRAFANA_LOKI_ENDPOINT` env var.
   * @example 'http://localhost:3100'
   */
  lokiEndpoint?: string;

  /**
   * Authentication. Defaults to no auth for local development.
   */
  auth?: GrafanaAuth;

  /**
   * Tenant ID for multi-tenant deployments.
   * Sent as `X-Scope-OrgID` header.
   */
  tenantId?: string;
}

/** Default configuration values */
export const DEFAULTS = {
  zone: 'prod-us-central-0',
  batchSize: 100,
  flushIntervalMs: 5000,
  serviceName: 'mastra-service',
} as const;
