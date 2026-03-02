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

export function resolveProviderConfig(config: ProviderConfig, debug?: boolean): ResolvedProviderConfig | null {
  const providerName = Object.keys(config)[0];

  if (debug) {
    console.info(`[OtelExporter:debug] Resolving provider config for: ${providerName}`);
  }

  let resolved: ResolvedProviderConfig | null;

  if ('dash0' in config) {
    resolved = resolveDash0Config(config.dash0);
  } else if ('signoz' in config) {
    resolved = resolveSignozConfig(config.signoz);
  } else if ('newrelic' in config) {
    resolved = resolveNewRelicConfig(config.newrelic);
  } else if ('traceloop' in config) {
    resolved = resolveTraceloopConfig(config.traceloop);
  } else if ('laminar' in config) {
    resolved = resolveLaminarConfig(config.laminar);
  } else if ('grafanaCloud' in config) {
    resolved = resolveGrafanaCloudConfig(config.grafanaCloud, debug);
  } else if ('custom' in config) {
    resolved = resolveCustomConfig(config.custom);
  } else {
    // TypeScript exhaustiveness check
    const _exhaustive: never = config;
    return _exhaustive;
  }

  if (debug && resolved) {
    const maskedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(resolved.headers)) {
      maskedHeaders[key] = value.length > 12 ? value.slice(0, 8) + '...' + value.slice(-4) : '***';
    }
    console.info(`[OtelExporter:debug] Provider "${providerName}" resolved:`, {
      endpoint: resolved.endpoint,
      protocol: resolved.protocol,
      headers: maskedHeaders,
    });
  } else if (debug && !resolved) {
    console.info(`[OtelExporter:debug] Provider "${providerName}" resolution returned null (disabled)`);
  }

  return resolved;
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

function resolveGrafanaCloudConfig(config: GrafanaCloudConfig, debug?: boolean): ResolvedProviderConfig | null {
  // Read from config or environment variables
  const instanceId = config.instanceId ?? process.env.GRAFANA_CLOUD_INSTANCE_ID;
  const apiToken = config.apiToken ?? process.env.GRAFANA_CLOUD_API_TOKEN;
  const configEndpoint = config.endpoint ?? process.env.GRAFANA_CLOUD_OTLP_ENDPOINT;

  if (debug) {
    console.info('[OtelExporter:debug] Grafana Cloud config sources:', {
      instanceId: instanceId ? `${instanceId.slice(0, 4)}...` : '(missing)',
      instanceIdSource: config.instanceId ? 'config' : process.env.GRAFANA_CLOUD_INSTANCE_ID ? 'env' : 'none',
      apiToken: apiToken ? `${apiToken.slice(0, 8)}...` : '(missing)',
      apiTokenSource: config.apiToken ? 'config' : process.env.GRAFANA_CLOUD_API_TOKEN ? 'env' : 'none',
      endpoint: configEndpoint ?? '(missing)',
      endpointSource: config.endpoint ? 'config' : process.env.GRAFANA_CLOUD_OTLP_ENDPOINT ? 'env' : 'none',
    });
  }

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
      '[OtelExporter] Grafana Cloud configuration requires endpoint (e.g. https://otlp-gateway-prod-us-east-3.grafana.net/otlp). ' +
        'Set GRAFANA_CLOUD_OTLP_ENDPOINT environment variable or pass it in config. Tracing will be disabled.',
    );
    return null;
  }

  // Grafana Cloud OTLP uses HTTP Basic Auth: username = instanceId, password = apiToken
  const basicAuth = Buffer.from(`${instanceId}:${apiToken}`).toString('base64');

  if (debug) {
    console.info('[OtelExporter:debug] Grafana Cloud Basic Auth constructed:', {
      format: '<instanceId>:<apiToken> -> base64',
      authHeaderPrefix: `Basic ${basicAuth.slice(0, 12)}...`,
    });
  }

  // Append /v1/traces if the endpoint doesn't already have a signal path
  let endpoint = configEndpoint;
  if (!endpoint.endsWith('/v1/traces') && !endpoint.endsWith('/v1/logs') && !endpoint.endsWith('/v1/metrics')) {
    endpoint = endpoint.replace(/\/$/, '') + '/v1/traces';
  }

  if (debug) {
    console.info(`[OtelExporter:debug] Grafana Cloud endpoint: ${configEndpoint} -> ${endpoint}`);
  }

  return {
    endpoint,
    headers: {
      Authorization: `Basic ${basicAuth}`,
    },
    protocol: 'http/json',
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
