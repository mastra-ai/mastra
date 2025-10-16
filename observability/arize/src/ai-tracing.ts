import { SEMRESATTRS_PROJECT_NAME } from '@arizeai/openinference-semantic-conventions';
import { OtelExporter } from '@mastra/otel-exporter';
import type { OtelExporterConfig } from '@mastra/otel-exporter';
import { OpenInferenceOTLPTraceExporter } from './openInferenceOTLPExporter.js';

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
   * Required collector endpoint destination for trace exports
   */
  endpoint: string;
  /**
   * Optional project name to be added as a resource attribute using
   * OpenInference Semantic Conventions
   */
  projectName?: string;
};

export class ArizeExporter extends OtelExporter {
  name = 'arize';

  constructor(config: ArizeExporterConfig) {
    const headers: Record<string, string> = {};
    if (config.spaceId) {
      // arize ax header configuration
      headers['space_id'] = config.spaceId;
      headers['api_key'] = config.apiKey ?? '';
    } else if (config.apiKey) {
      // standard otel header configuration
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }
    super({
      exporter: new OpenInferenceOTLPTraceExporter({
        url: config.endpoint,
        headers,
      }),
      ...config,
      resourceAttributes: {
        [SEMRESATTRS_PROJECT_NAME]: config.projectName,
        ...config.resourceAttributes,
      },
      provider: {
        custom: {
          endpoint: config.endpoint,
          headers,
          protocol: 'http/protobuf',
        },
      } satisfies OtelExporterConfig['provider'],
    } satisfies OtelExporterConfig);
  }
}
