/**
 * OtelExporter Types
 */

import type { AnyExportedSpan } from '@mastra/core/observability';
import type { BaseExporterConfig } from '@mastra/observability';
import type { DetectedResourceAttributes } from '@opentelemetry/resources';
import type { SpanExporter } from '@opentelemetry/sdk-trace-base';

export type ExportProtocol = 'http/json' | 'http/protobuf' | 'grpc' | 'zipkin';

// Provider-specific configurations WITHOUT redundant provider field
// All fields are optional to allow direct env var usage
// Required fields are validated at runtime

export interface Dash0Config {
  apiKey?: string; // Required at runtime
  endpoint?: string; // Required at runtime (e.g., 'ingress.us-west-2.aws.dash0.com:4317')
  dataset?: string;
}

export interface SignozConfig {
  apiKey?: string; // Required at runtime
  region?: 'us' | 'eu' | 'in';
  endpoint?: string; // For self-hosted
}

export interface NewRelicConfig {
  apiKey?: string; // Required at runtime
  endpoint?: string; // For EU or custom endpoints
}

export interface TraceloopConfig {
  apiKey?: string; // Required at runtime
  destinationId?: string;
  endpoint?: string;
}

export interface LaminarConfig {
  apiKey?: string; // Required at runtime (LMNR_PROJECT_API_KEY)
  endpoint?: string;
}

export interface GrafanaCloudConfig {
  instanceId?: string; // Required at runtime (GRAFANA_CLOUD_INSTANCE_ID)
  apiToken?: string; // Required at runtime (GRAFANA_CLOUD_API_TOKEN)
  endpoint?: string; // Required at runtime (GRAFANA_CLOUD_OTLP_ENDPOINT), e.g. 'https://otlp-gateway-prod-us-east-3.grafana.net/otlp'
}

export interface CustomConfig {
  endpoint?: string; // Required at runtime
  headers?: Record<string, string>;
  protocol?: ExportProtocol;
}

// Provider configuration that infers the provider type from the key
export type ProviderConfig =
  | { dash0: Dash0Config }
  | { signoz: SignozConfig }
  | { newrelic: NewRelicConfig }
  | { traceloop: TraceloopConfig }
  | { laminar: LaminarConfig }
  | { grafanaCloud: GrafanaCloudConfig }
  | { custom: CustomConfig };

export interface OtelExporterConfig extends BaseExporterConfig {
  // Provider configuration
  provider?: ProviderConfig;

  // Export configuration
  timeout?: number; // milliseconds
  batchSize?: number;

  // Debug
  logLevel?: 'debug' | 'info' | 'warn' | 'error';

  // Override or provide additional resource attributes
  resourceAttributes?: DetectedResourceAttributes;

  // Override or provide a custom span exporter
  exporter?: SpanExporter;

  /**
   * Signal enablement. All signals are enabled by default when their
   * required OTEL packages are installed. Set to false to disable.
   */
  signals?: {
    /** Enable trace export (default: true) */
    traces?: boolean;
    /** Enable log export (default: true) */
    logs?: boolean;
    /** Enable metric export (default: true) */
    metrics?: boolean;
  };
}

export interface SpanData {
  span: AnyExportedSpan;
  isComplete: boolean;
}

export interface TraceData {
  spans: Map<string, SpanData>;
  rootSpanId: string;
  isRootComplete: boolean;
}
