/**
 * Provider-specific configurations for OtelExporters
 */

import type {
  ProviderConfig,
  ExportProtocol,
  Dash0Config,
  SignozConfig,
  NewRelicConfig,
  TraceloopConfig,
  LaminarConfig,
  GrafanaCloudConfig,
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
  } else if ('grafanaCloud' in config) {
    return resolveGrafanaCloudConfig(config.grafanaCloud);
  } else if ('custom' in config) {
    return resolveCustomConfig(config.custom);
  } else {
    // TypeScript exhaustiveness check
    const _exhaustive: never = config;
    return _exhaustive;
  }
}

function resolveDash0Config(config: Dash0Config): ResolvedProviderConfig | null {
  // Read from config or environment variables
  const apiKey = config.apiKey ?? process.env.DASH0_API_KEY;
  const configEndpoint = config.endpoint ?? process.env.DASH0_ENDPOINT;
  const dataset = config.dataset ?? process.env.DASH0_DATASET;

  if (!apiKey) {
    console.error(
      '[OtelExporter] Dash0 configuration requires apiKey. ' +
        'Set DASH0_API_KEY environment variable or pass it in config. Tracing will be disabled.',
    );
    return null;
  }

  if (!configEndpoint) {
    console.error(
      '[OtelExporter] Dash0 configuration requires endpoint. ' +
        'Set DASH0_ENDPOINT environment variable or pass it in config. Tracing will be disabled.',
    );
    return null;
  }

  // Dash0 uses gRPC by default
  // Endpoint should be like: ingress.us-west-2.aws.dash0.com:4317
  // gRPC endpoints also need /v1/traces suffix
  // Requires: npm install @opentelemetry/exporter-trace-otlp-grpc @grpc/grpc-js
  let endpoint = configEndpoint;
  if (!endpoint.includes('/v1/traces')) {
    endpoint = `${endpoint}/v1/traces`;
  }

  const headers: Record<string, string> = {
    authorization: `Bearer ${apiKey}`, // lowercase for gRPC metadata
  };

  if (dataset) {
    headers['dash0-dataset'] = dataset; // lowercase for gRPC metadata
  }

  return {
    endpoint,
    headers,
    protocol: 'grpc', // Use gRPC for Dash0
  };
}

function resolveSignozConfig(config: SignozConfig): ResolvedProviderConfig | null {
  // Read from config or environment variables
  const apiKey = config.apiKey ?? process.env.SIGNOZ_API_KEY;
  const region = config.region ?? (process.env.SIGNOZ_REGION as 'us' | 'eu' | 'in' | undefined);
  const configEndpoint = config.endpoint ?? process.env.SIGNOZ_ENDPOINT;

  if (!apiKey) {
    console.error(
      '[OtelExporter] SigNoz configuration requires apiKey. ' +
        'Set SIGNOZ_API_KEY environment variable or pass it in config. Tracing will be disabled.',
    );
    return null;
  }

  // SigNoz uses OTLP endpoint with /v1/traces suffix
  const endpoint = configEndpoint || `https://ingest.${region || 'us'}.signoz.cloud:443/v1/traces`;

  return {
    endpoint,
    headers: {
      'signoz-ingestion-key': apiKey,
    },
    protocol: 'http/protobuf',
  };
}

function resolveNewRelicConfig(config: NewRelicConfig): ResolvedProviderConfig | null {
  // Read from config or environment variables
  const apiKey = config.apiKey ?? process.env.NEW_RELIC_LICENSE_KEY;
  const configEndpoint = config.endpoint ?? process.env.NEW_RELIC_ENDPOINT;

  if (!apiKey) {
    console.error(
      '[OtelExporter] New Relic configuration requires apiKey (license key). ' +
        'Set NEW_RELIC_LICENSE_KEY environment variable or pass it in config. Tracing will be disabled.',
    );
    return null;
  }

  // New Relic recommends HTTP/protobuf over gRPC
  // New Relic uses OTLP endpoint with /v1/traces suffix
  const endpoint = configEndpoint || 'https://otlp.nr-data.net:443/v1/traces';

  return {
    endpoint,
    headers: {
      'api-key': apiKey,
    },
    protocol: 'http/protobuf',
  };
}

function resolveTraceloopConfig(config: TraceloopConfig): ResolvedProviderConfig | null {
  // Read from config or environment variables
  const apiKey = config.apiKey ?? process.env.TRACELOOP_API_KEY;
  const destinationId = config.destinationId ?? process.env.TRACELOOP_DESTINATION_ID;
  const configEndpoint = config.endpoint ?? process.env.TRACELOOP_ENDPOINT;

  if (!apiKey) {
    console.error(
      '[OtelExporter] Traceloop configuration requires apiKey. ' +
        'Set TRACELOOP_API_KEY environment variable or pass it in config. Tracing will be disabled.',
    );
    return null;
  }

  // Traceloop uses OTLP endpoint with /v1/traces suffix
  const endpoint = configEndpoint || 'https://api.traceloop.com/v1/traces';

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };

  if (destinationId) {
    headers['x-traceloop-destination-id'] = destinationId;
  }

  return {
    endpoint,
    headers,
    protocol: 'http/json',
  };
}

function resolveLaminarConfig(config: LaminarConfig): ResolvedProviderConfig | null {
  // Read from config or environment variables
  // LMNR_PROJECT_API_KEY is the standard Laminar environment variable
  const apiKey = config.apiKey ?? process.env.LMNR_PROJECT_API_KEY;
  const configEndpoint = config.endpoint ?? process.env.LAMINAR_ENDPOINT;

  if (!apiKey) {
    console.error(
      '[OtelExporter] Laminar configuration requires apiKey. ' +
        'Set LMNR_PROJECT_API_KEY environment variable or pass it in config. Tracing will be disabled.',
    );
    return null;
  }

  // Laminar uses OTLP endpoint with /v1/traces suffix for HTTP
  // They support both gRPC and HTTP, but we'll use HTTP for consistency
  const endpoint = configEndpoint || 'https://api.lmnr.ai/v1/traces';

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };

  return {
    endpoint,
    headers,
    protocol: 'http/protobuf', // Use HTTP/protobuf instead of gRPC for better compatibility
  };
}

function resolveGrafanaCloudConfig(config: GrafanaCloudConfig): ResolvedProviderConfig | null {
  // Read from config or environment variables
  const instanceId = config.instanceId ?? process.env.GRAFANA_CLOUD_INSTANCE_ID;
  const apiToken = config.apiToken ?? process.env.GRAFANA_CLOUD_API_TOKEN;
  const configEndpoint = config.endpoint ?? process.env.GRAFANA_CLOUD_OTLP_ENDPOINT;

  if (!instanceId) {
    console.error(
      '[OtelExporter] Grafana Cloud configuration requires instanceId. ' +
        'Set GRAFANA_CLOUD_INSTANCE_ID environment variable or pass it in config. Tracing will be disabled.',
    );
    return null;
  }

  if (!apiToken) {
    console.error(
      '[OtelExporter] Grafana Cloud configuration requires apiToken. ' +
        'Set GRAFANA_CLOUD_API_TOKEN environment variable or pass it in config. Tracing will be disabled.',
    );
    return null;
  }

  if (!configEndpoint) {
    console.error(
      '[OtelExporter] Grafana Cloud configuration requires endpoint. ' +
        'Set GRAFANA_CLOUD_OTLP_ENDPOINT environment variable or pass it in config ' +
        "(e.g. 'https://otlp-gateway-prod-us-east-3.grafana.net/otlp'). Tracing will be disabled.",
    );
    return null;
  }

  // Grafana Cloud uses Basic Auth: base64(instanceId:apiToken)
  const credentials = Buffer.from(`${instanceId}:${apiToken}`).toString('base64');

  // Append /v1/traces if the endpoint doesn't already include it
  let endpoint = configEndpoint;
  if (!endpoint.endsWith('/v1/traces')) {
    endpoint = `${endpoint.replace(/\/$/, '')}/v1/traces`;
  }

  return {
    endpoint,
    headers: {
      Authorization: `Basic ${credentials}`,
    },
    protocol: 'http/protobuf',
  };
}

function resolveCustomConfig(config: CustomConfig): ResolvedProviderConfig | null {
  if (!config.endpoint) {
    console.error('[OtelExporter] Custom configuration requires endpoint. Tracing will be disabled.');
    return null;
  }

  return {
    endpoint: config.endpoint,
    headers: config.headers || {},
    protocol: config.protocol || 'http/json',
  };
}
