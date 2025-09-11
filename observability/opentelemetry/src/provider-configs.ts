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

  const region = config.region || 'us';
  const endpoint = `https://ingress.${region}.dash0.com`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
  };

  if (config.dataset) {
    headers['Dash0-Dataset'] = config.dataset;
  }

  return {
    endpoint,
    headers,
    protocol: 'http/protobuf',
  };
}

function resolveSignozConfig(config: SignozConfig): ResolvedProviderConfig | null {
  if (!config.apiKey) {
    console.error('[OpenTelemetry Exporter] SigNoz configuration requires apiKey. Tracing will be disabled.');
    return null;
  }

  const endpoint = config.endpoint || `https://ingest.${config.region || 'us'}.signoz.cloud:443`;

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
  const endpoint = config.endpoint || 'https://otlp.nr-data.net:443';

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

  const endpoint = config.endpoint || 'https://api.traceloop.com';

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

  if (!config.teamId) {
    console.error('[OpenTelemetry Exporter] Laminar configuration requires teamId. Tracing will be disabled.');
    return null;
  }

  const endpoint = config.endpoint || 'https://api.lmnr.ai:8443';

  return {
    endpoint,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'x-laminar-team-id': config.teamId,
    },
    protocol: 'grpc', // Laminar prefers gRPC
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
    // For self-hosted, ensure /api/v1 is appended if not present
    if (!endpoint.includes('api.smith.langchain.com') && !endpoint.endsWith('/api/v1')) {
      endpoint = endpoint + '/api/v1';
    }
  } else if (config.region === 'eu') {
    endpoint = 'https://eu.api.smith.langchain.com/otel';
  } else {
    endpoint = 'https://api.smith.langchain.com/otel';
  }

  // Add /v1/traces suffix if not present (for OTLP compatibility)
  if (!endpoint.endsWith('/v1/traces') && !endpoint.endsWith('/otel')) {
    endpoint = endpoint + '/v1/traces';
  } else if (endpoint.endsWith('/otel')) {
    // Replace /otel with /v1/traces for standard OTLP endpoint
    endpoint = endpoint.replace('/otel', '/v1/traces');
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
    protocol: 'http/json', // LangSmith uses HTTP/JSON by default
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
