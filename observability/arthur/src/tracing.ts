import { OtelExporter } from '@mastra/otel-exporter';
import type { OtelExporterConfig } from '@mastra/otel-exporter';

import { OpenInferenceOTLPTraceExporter } from '@mastra/openinference';

const LOG_PREFIX = '[ArthurExporter]';

export type ArthurExporterConfig = Omit<OtelExporterConfig, 'provider'> & {
  /**
   * Arthur API key for authentication.
   * Falls back to ARTHUR_API_KEY environment variable.
   */
  apiKey?: string;
  /**
   * Arthur platform endpoint (e.g. https://app.arthur.ai).
   * Falls back to ARTHUR_BASE_URL environment variable.
   */
  endpoint?: string;
  /**
   * Optional headers to be added to each OTLP request
   */
  headers?: Record<string, string>;
};

export class ArthurExporter extends OtelExporter {
  name = 'arthur';

  constructor(config: ArthurExporterConfig = {}) {
    const apiKey = config.apiKey ?? process.env.ARTHUR_API_KEY;
    const endpoint = config.endpoint ?? process.env.ARTHUR_BASE_URL;

    const headers: Record<string, string> = {
      ...config.headers,
    };

    let disabledReason: string | undefined;

    if (!apiKey) {
      disabledReason =
        `${LOG_PREFIX} API key is required. ` +
        `Set ARTHUR_API_KEY environment variable or pass apiKey in config.`;
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    if (!disabledReason && !endpoint) {
      disabledReason =
        `${LOG_PREFIX} Endpoint is required. ` +
        `Set ARTHUR_BASE_URL environment variable or pass endpoint in config.`;
    }

    // Ensure the endpoint ends with /api/v1/traces
    const tracesEndpoint = endpoint ? `${endpoint.replace(/\/+$/, '')}/api/v1/traces` : 'http://disabled';

    if (disabledReason) {
      super({
        ...config,
        provider: {
          custom: {
            endpoint: 'http://disabled',
            headers: {},
            protocol: 'http/protobuf',
          },
        },
      });
      this.setDisabled(disabledReason);
      return;
    }

    super({
      exporter: new OpenInferenceOTLPTraceExporter({
        url: tracesEndpoint,
        headers,
      }),
      ...config,
      resourceAttributes: {
        ...config.resourceAttributes,
      },
      provider: {
        custom: {
          endpoint: tracesEndpoint,
          headers,
          protocol: 'http/protobuf',
        },
      } satisfies OtelExporterConfig['provider'],
    } satisfies OtelExporterConfig);
  }
}
