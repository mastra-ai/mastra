import { SEMRESATTRS_PROJECT_NAME } from '@arizeai/openinference-semantic-conventions';
import { OtelExporter } from '@mastra/otel-exporter';
import type { OtelExporterConfig } from '@mastra/otel-exporter';
import {
  SpanType,
  type SpanOutputProcessor,
  type SerializationOptions,
  type ObservabilityInstanceConfig,
  type AnySpan,
} from '@mastra/core/observability';

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

console.log("UPDATED");
export class ArizeExporter extends OtelExporter {
  name = 'arize';

  constructor(config: ArizeExporterConfig = {}) {
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

    // Validate credentials based on mode
    let disabledReason: string | undefined;

    if (spaceId) {
      // Arize AX mode requires an API key
      if (!apiKey) {
        disabledReason =
          `${LOG_PREFIX} API key is required for Arize AX. ` +
          `Set ARIZE_API_KEY environment variable or pass apiKey in config.`;
      } else {
        // arize ax header configuration
        headers['space_id'] = spaceId;
        headers['api_key'] = apiKey;
        endpoint = endpoint || ARIZE_AX_ENDPOINT;
      }
    } else if (apiKey) {
      // standard otel header configuration
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    if (!disabledReason && !endpoint) {
      disabledReason =
        `${LOG_PREFIX} Endpoint is required in configuration. ` +
        `Set PHOENIX_ENDPOINT environment variable, or ARIZE_SPACE_ID for Arize AX, or pass endpoint in config.`;
    }

    // If disabled, create with minimal config and disable
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
        url: endpoint!,
        headers,
      }),
      ...config,
      resourceAttributes: {
        ...(projectName ? { [SEMRESATTRS_PROJECT_NAME]: projectName } : {}),
        ...config.resourceAttributes,
      },
      provider: {
        custom: {
          endpoint: endpoint!,
          headers,
          protocol: 'http/protobuf',
        },
      } satisfies OtelExporterConfig['provider'],
    } satisfies OtelExporterConfig);
  }
}

/**
 * Default serialization options for Arize config
 */
const DEFAULT_SERIALIZATION_OPTIONS: SerializationOptions = {
  maxStringLength: 9999999,
  maxDepth: 10,
  maxArrayLength: 1000,
  maxObjectKeys: 1000,
};

/**
 * Span types that should be filtered out by the workflow loop filter
 */
const FILTERED_WORKFLOW_SPAN_TYPES: readonly SpanType[] = [
  SpanType.WORKFLOW_LOOP,
  SpanType.WORKFLOW_PARALLEL,
  SpanType.WORKFLOW_CONDITIONAL,
  SpanType.WORKFLOW_CONDITIONAL_EVAL,
];

/**
 * Default workflow loop filter span processor
 */
const DEFAULT_WORKFLOW_LOOP_FILTER: SpanOutputProcessor = {
  name: 'workflow-loop-filter',
  process: (span) =>
    span && FILTERED_WORKFLOW_SPAN_TYPES.includes((span as AnySpan).type as SpanType)
      ? undefined
      : span,
  shutdown: () => Promise.resolve(),
};

/**
 * Configuration options for creating an Arize observability config
 */
export interface CreateArizeConfigOptions {
  /**
   * Exporter configuration using ArizeExporterConfig
   * At minimum, endpoint should be provided (or spaceId for Arize AX)
   */
  exporters: ArizeExporterConfig;
  serviceName?: string;
  serializationOptions?: SerializationOptions;
  spanProcessors?: SpanOutputProcessor[];
}

export function createArizeConfig(
  options: CreateArizeConfigOptions,
): Omit<ObservabilityInstanceConfig, 'name'> {
  const {
    exporters,
    serviceName = process.env.PHOENIX_PROJECT_NAME ||
      process.env.ARIZE_PROJECT_NAME ||
      'mastra-tracing',
    serializationOptions,
    spanProcessors = [],
  } = options;

  return {
    serviceName,
    exporters: [new ArizeExporter(exporters)],
    serializationOptions: {
      ...DEFAULT_SERIALIZATION_OPTIONS,
      ...serializationOptions,
    },
    spanOutputProcessors: [DEFAULT_WORKFLOW_LOOP_FILTER, ...spanProcessors],
  };
}