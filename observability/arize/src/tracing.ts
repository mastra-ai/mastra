import { SEMRESATTRS_PROJECT_NAME } from '@arizeai/openinference-semantic-conventions';
import { ConsoleLogger } from '@mastra/core/logger';
import { OtelExporter } from '@mastra/otel-exporter';
import type { OtelExporterConfig } from '@mastra/otel-exporter';

import { OpenInferenceOTLPTraceExporter } from './openInferenceOTLPExporter.js';

const LOG_PREFIX = '[ArizeExporter]';

export const ARIZE_AX_ENDPOINT = 'https://otlp.arize.com/v1/traces';

export type ArizeExporterConfig = Omit<OtelExporterConfig, 'provider'> & {
  /**
   * Required if sending traces to Arize AX
   */
  spaceId?: string;
  /**
   * Required if sending traces to Arize AX, or to any other collector that
   * requires an Authorization header
   */
  apiKey?: string;
  /**
   * Collector endpoint destination for trace exports.
   * Required when sending traces to Phoenix, Phoenix Cloud, or other collectors.
   * Optional when sending traces to Arize AX.
   */
  endpoint?: string;
  /**
   * Optional project name to be added as a resource attribute using
   * OpenInference Semantic Conventions
   */
  projectName?: string;
  /**
   * Optional headers to be added to each OTLP request
   */
  headers?: Record<string, string>;
};

export class ArizeExporter extends OtelExporter {
  name = 'arize';

  constructor(config: ArizeExporterConfig = {}) {
    const logger = new ConsoleLogger({ level: config.logLevel ?? 'warn' });

    // Read configuration from config or environment variables
    // Priority: config > ARIZE_* env vars > PHOENIX_* env vars
    const spaceId = config.spaceId ?? process.env.ARIZE_SPACE_ID;
    const apiKey = config.apiKey ?? process.env.ARIZE_API_KEY ?? process.env.PHOENIX_API_KEY;
    const projectName = config.projectName ?? process.env.ARIZE_PROJECT_NAME ?? process.env.PHOENIX_PROJECT_NAME;

    // Determine endpoint: config > PHOENIX_ENDPOINT > ARIZE_AX_ENDPOINT (if spaceId is set)
    let endpoint: string | undefined = config.endpoint ?? process.env.PHOENIX_ENDPOINT;

    const headers: Record<string, string> = {
      ...config.headers,
    };
    if (spaceId) {
      // arize ax header configuration
      headers['space_id'] = spaceId;
      headers['api_key'] = apiKey ?? '';
      endpoint = endpoint || ARIZE_AX_ENDPOINT;
    } else if (apiKey) {
      // standard otel header configuration
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    if (!endpoint) {
      logger.error(
        `${LOG_PREFIX} Endpoint is required in configuration. ` +
          `Set PHOENIX_ENDPOINT environment variable, or ARIZE_SPACE_ID for Arize AX, or pass endpoint in config.`,
      );
      return;
    }
    super({
      exporter: new OpenInferenceOTLPTraceExporter({
        url: endpoint,
        headers,
      }),
      ...config,
      resourceAttributes: {
        [SEMRESATTRS_PROJECT_NAME]: projectName,
        ...config.resourceAttributes,
      },
      provider: {
        custom: {
          endpoint,
          headers,
          protocol: 'http/protobuf',
        },
      } satisfies OtelExporterConfig['provider'],
    } satisfies OtelExporterConfig);
  }
}
