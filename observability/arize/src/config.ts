import {
  SpanType,
  type SpanOutputProcessor,
  type SerializationOptions,
  type ObservabilityInstanceConfig,
  type AnySpan,
} from '@mastra/core/observability';

import { ArizeExporter, type ArizeExporterConfig } from './tracing.js';

/**
 * Default serialization options for Arize config
 */
const DEFAULT_SERIALIZATION_OPTIONS: SerializationOptions = {
  maxStringLength: 9999999,
  maxDepth: 9999999,
  maxArrayLength: 9999999,
  maxObjectKeys: 9999999,
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
  exporter: ArizeExporterConfig;
  serviceName?: string;
  serializationOptions?: SerializationOptions;
  spanProcessors?: SpanOutputProcessor[];
}

export function createArizeConfig(
  options: CreateArizeConfigOptions,
): Omit<ObservabilityInstanceConfig, 'name'> {
  const {
    exporter,
    serviceName = process.env.PHOENIX_PROJECT_NAME ||
      process.env.ARIZE_PROJECT_NAME ||
      'mastra-tracing',
    serializationOptions,
    spanProcessors = [],
  } = options;

  return {
    serviceName,
    exporters: [new ArizeExporter(exporter)],
    serializationOptions: {
      ...DEFAULT_SERIALIZATION_OPTIONS,
      ...serializationOptions,
    },
    spanOutputProcessors: [DEFAULT_WORKFLOW_LOOP_FILTER, ...spanProcessors],
  };
}

