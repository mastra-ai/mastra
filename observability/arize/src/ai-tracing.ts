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

  constructor(config: ArizeExporterConfig) {
    const logger = new ConsoleLogger({ level: config.logLevel ?? 'warn' });
    let endpoint: string | undefined = config.endpoint;
    const headers: Record<string, string> = {
      ...config.headers,
    };
    if (config.spaceId) {
      // arize ax header configuration
      headers['space_id'] = config.spaceId;
      headers['api_key'] = config.apiKey ?? '';
      endpoint = config.endpoint || ARIZE_AX_ENDPOINT;
    } else if (config.apiKey) {
      // standard otel header configuration
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }
    if (!endpoint) {
      logger.error(`${LOG_PREFIX} Endpoint is required in configuration. Disabling exporter.`);
      return;
    }
    super({
      exporter: new OpenInferenceOTLPTraceExporter({
        url: endpoint,
        headers,
      }),
      ...config,
      resourceAttributes: {
        [SEMRESATTRS_PROJECT_NAME]: config.projectName,
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
