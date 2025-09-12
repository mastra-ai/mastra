/**
 * Provider-specific configurations for OpenTelemetry exporters
 */

import type {
  ProviderConfig,
  ExportProtocol,
  Dash0Config,
  SignozConfig,
  NewRelicConfig,
  TraceloopConfig,
  LaminarConfig,
  LangSmithConfig,
  CustomConfig,
} from './types.js';

export interface ResolvedProviderConfig {
  endpoint: string;
  headers: Record<string, string>;
  protocol: ExportProtocol;
}

export function resolveProviderConfig(config: ProviderConfig): ResolvedProviderConfig | null {
  if ('dash0' in config) {
    return resolveDash0Config(config.dash0);
  } else if ('signoz' in config) {
    return resolveSignozConfig(config.signoz);
  } else if ('newrelic' in config) {
    return resolveNewRelicConfig(config.newrelic);
  } else if ('traceloop' in config) {
    return resolveTraceloopConfig(config.traceloop);
  } else if ('laminar' in config) {
    return resolveLaminarConfig(config.laminar);
  } else if ('langsmith' in config) {
    return resolveLangSmithConfig(config.langsmith);
  } else if ('custom' in config) {
    return resolveCustomConfig(config.custom);
  } else {
    // TypeScript exhaustiveness check
    const _exhaustive: never = config;
    return _exhaustive;
  }
}

function resolveDash0Config(config: Dash0Config): ResolvedProviderConfig | null {
  if (!config.apiKey) {
    console.error('[OpenTelemetry Exporter] Dash0 configuration requires apiKey. Tracing will be disabled.');
    return null;
  }

  if (!config.endpoint) {
    console.error('[OpenTelemetry Exporter] Dash0 configuration requires endpoint. Tracing will be disabled.');
    return null;
  }

  // Dash0 uses gRPC by default
  // Endpoint should be like: ingress.us-west-2.aws.dash0.com:4317
  // gRPC endpoints also need /v1/traces suffix
  // Requires: npm install @opentelemetry/exporter-trace-otlp-grpc @grpc/grpc-js
  let endpoint = config.endpoint;
  if (!endpoint.includes('/v1/traces')) {
    endpoint = `${endpoint}/v1/traces`;
  }

  const headers: Record<string, string> = {
    authorization: `Bearer ${config.apiKey}`, // lowercase for gRPC metadata
  };

  if (config.dataset) {
    headers['dash0-dataset'] = config.dataset; // lowercase for gRPC metadata
  }

  return {
    endpoint,
    headers,
    protocol: 'grpc', // Use gRPC for Dash0
  };
}

function resolveSignozConfig(config: SignozConfig): ResolvedProviderConfig | null {
  if (!config.apiKey) {
    console.error('[OpenTelemetry Exporter] SigNoz configuration requires apiKey. Tracing will be disabled.');
    return null;
  }

  // SigNoz uses OTLP endpoint with /v1/traces suffix
  const endpoint = config.endpoint || `https://ingest.${config.region || 'us'}.signoz.cloud:443/v1/traces`;

  return {
    endpoint,
    headers: {
      'signoz-ingestion-key': config.apiKey,
    },
    protocol: 'http/protobuf',
  };
}

function resolveNewRelicConfig(config: NewRelicConfig): ResolvedProviderConfig | null {
  if (!config.apiKey) {
    console.error(
      '[OpenTelemetry Exporter] New Relic configuration requires apiKey (license key). Tracing will be disabled.',
    );
    return null;
  }

  // New Relic recommends HTTP/protobuf over gRPC
  // New Relic uses OTLP endpoint with /v1/traces suffix
  const endpoint = config.endpoint || 'https://otlp.nr-data.net:443/v1/traces';

  return {
    endpoint,
    headers: {
      'api-key': config.apiKey,
    },
    protocol: 'http/protobuf',
  };
}

function resolveTraceloopConfig(config: TraceloopConfig): ResolvedProviderConfig | null {
  if (!config.apiKey) {
    console.error('[OpenTelemetry Exporter] Traceloop configuration requires apiKey. Tracing will be disabled.');
    return null;
  }

  // Traceloop uses OTLP endpoint with /v1/traces suffix
  const endpoint = config.endpoint || 'https://api.traceloop.com/v1/traces';

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
  };

  if (config.destinationId) {
    headers['x-traceloop-destination-id'] = config.destinationId;
  }

  return {
    endpoint,
    headers,
    protocol: 'http/json',
  };
}

function resolveLaminarConfig(config: LaminarConfig): ResolvedProviderConfig | null {
  if (!config.apiKey) {
    console.error('[OpenTelemetry Exporter] Laminar configuration requires apiKey. Tracing will be disabled.');
    return null;
  }

  // Laminar uses OTLP endpoint with /v1/traces suffix for HTTP
  // They support both gRPC and HTTP, but we'll use HTTP for consistency
  const endpoint = config.endpoint || 'https://api.lmnr.ai/v1/traces';

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
  };

  // Only add team ID header if provided (for backwards compatibility)
  if (config.teamId) {
    headers['x-laminar-team-id'] = config.teamId;
  }

  return {
    endpoint,
    headers,
    protocol: 'http/protobuf', // Use HTTP/protobuf instead of gRPC for better compatibility
  };
}

function resolveLangSmithConfig(config: LangSmithConfig): ResolvedProviderConfig | null {
  if (!config.apiKey) {
    console.error('[OpenTelemetry Exporter] LangSmith configuration requires apiKey. Tracing will be disabled.');
    return null;
  }

  // Support EU region and self-hosted instances
  let endpoint: string;
  if (config.endpoint) {
    // Custom endpoint (e.g., self-hosted)
    endpoint = config.endpoint;
  } else if (config.region === 'eu') {
    endpoint = 'https://eu.api.smith.langchain.com/otel';
  } else {
    endpoint = 'https://api.smith.langchain.com/otel';
  }

  const headers: Record<string, string> = {
    'x-api-key': config.apiKey,
  };

  // Add project name if specified
  if (config.projectName) {
    headers['Langsmith-Project'] = config.projectName;
  }

  return {
    endpoint,
    headers,
    protocol: 'http/protobuf', // LangSmith supports both JSON and protobuf
  };
}

function resolveCustomConfig(config: CustomConfig): ResolvedProviderConfig | null {
  if (!config.endpoint) {
    console.error('[OpenTelemetry Exporter] Custom configuration requires endpoint. Tracing will be disabled.');
    return null;
  }

  return {
    endpoint: config.endpoint,
    headers: config.headers || {},
    protocol: config.protocol || 'http/json',
  };
}
