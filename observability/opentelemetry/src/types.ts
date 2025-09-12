/**
 * OpenTelemetry Exporter Types
 */

import type { AnyExportedAISpan } from '@mastra/core/ai-tracing';

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
  teamId?: string; // Optional, for backwards compatibility
  endpoint?: string;
}

export interface LangSmithConfig {
  apiKey?: string; // Required at runtime
  projectName?: string;
  region?: 'us' | 'eu';
  endpoint?: string; // For self-hosted
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
  | { langsmith: LangSmithConfig }
  | { custom: CustomConfig };

export interface OpenTelemetryExporterConfig {
  // Provider configuration
  provider?: ProviderConfig;

  // Export configuration
  timeout?: number; // milliseconds
  batchSize?: number;

  // Debug
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface SpanData {
  span: AnyExportedAISpan;
  isComplete: boolean;
}

export interface TraceData {
  spans: Map<string, SpanData>;
  rootSpanId: string;
  isRootComplete: boolean;
}
