/**
 * Configuration types for Mastra Observability
 *
 * These types define the configuration structure for observability,
 * including tracing configs, sampling strategies, and registry setup.
 */

import type { RequestContext } from '@mastra/core/di';
import type {
  ObservabilityInstance,
  ObservabilityExporter,
  ObservabilityBridge,
  SpanOutputProcessor,
  ConfigSelector,
  SerializationOptions,
  CardinalityConfig,
  LogLevel,
  AnyExportedSpan,
} from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import { z } from 'zod/v4';

// ============================================================================
// Sampling Strategy Types
// ============================================================================

/**
 * Sampling strategy types
 */
export enum SamplingStrategyType {
  ALWAYS = 'always',
  NEVER = 'never',
  RATIO = 'ratio',
  CUSTOM = 'custom',
}

/**
 * Options passed when using a custom sampler strategy
 */
export interface CustomSamplerOptions {
  requestContext?: RequestContext;
  metadata?: Record<string, any>;
}

/**
 * Sampling strategy configuration
 */
export type SamplingStrategy =
  | { type: SamplingStrategyType.ALWAYS }
  | { type: SamplingStrategyType.NEVER }
  | { type: SamplingStrategyType.RATIO; probability: number }
  | { type: SamplingStrategyType.CUSTOM; sampler: (options?: CustomSamplerOptions) => boolean };

// ============================================================================
// Observability Configuration Types
// ============================================================================

/**
 * Configuration for a single observability instance
 */
export interface ObservabilityInstanceConfig {
  /** Unique identifier for this config in the tracing registry */
  name: string;
  /** Service name for tracing */
  serviceName: string;
  /** Sampling strategy - controls whether tracing is collected (defaults to ALWAYS) */
  sampling?: SamplingStrategy;
  /** Custom exporters */
  exporters?: ObservabilityExporter[];
  /** Observability bridge (e.g., OpenTelemetry bridge for context extraction) */
  bridge?: ObservabilityBridge;
  /** Custom span output processors */
  spanOutputProcessors?: SpanOutputProcessor[];
  /** Set to `true` if you want to see spans internal to the operation of mastra */
  includeInternalSpans?: boolean;
  /**
   * Span types to exclude from export. Spans of these types are silently dropped
   * before reaching exporters. This is useful for reducing noise and costs in
   * observability platforms that charge per-span (e.g., Langfuse).
   *
   * @example
   * ```typescript
   * excludeSpanTypes: [SpanType.MODEL_CHUNK, SpanType.MODEL_STEP]
   * ```
   */
  excludeSpanTypes?: SpanType[];
  /**
   * Filter function to control which spans are exported. Return `true` to keep
   * the span, `false` to drop it. This runs after `excludeSpanTypes` and
   * `spanOutputProcessors`, giving you access to the final exported span data
   * for fine-grained filtering by type, attributes, entity, metadata, or any
   * combination.
   *
   * @example
   * ```typescript
   * spanFilter: (span) => {
   *   // Drop all model chunks
   *   if (span.type === SpanType.MODEL_CHUNK) return false;
   *   // Only keep tool calls that failed
   *   if (span.type === SpanType.TOOL_CALL && span.attributes?.success) return false;
   *   return true;
   * }
   * ```
   */
  spanFilter?: (span: AnyExportedSpan) => boolean;
  /**
   * RequestContext keys to automatically extract as metadata for all spans
   * created with this tracing configuration.
   * Supports dot notation for nested values.
   */
  requestContextKeys?: string[];
  /**
   * Options for controlling serialization of span data (input/output/attributes).
   * Use these to customize truncation limits for large payloads.
   */
  serializationOptions?: SerializationOptions;
  /**
   * Cardinality protection settings for metrics.
   * Controls which labels are blocked and whether UUID-like values are filtered.
   * Applied to all metrics (auto-extracted and user-defined).
   */
  cardinality?: CardinalityConfig;
  /**
   * Configuration for the observability logger (loggerVNext).
   * Controls log level filtering and whether dual-write logging is enabled.
   */
  logging?: {
    /** Set to `false` to disable dual-write logging to observability storage. Defaults to `true`. */
    enabled?: boolean;
    /** Minimum log level to write to observability storage. Defaults to `'warn'`. */
    level?: LogLevel;
  };
}

/**
 * Complete Observability registry configuration
 */
export interface ObservabilityRegistryConfig {
  /**
   * Enables default exporters, with sampling: always, and sensitive data filtering
   * @deprecated Use explicit `configs` with DefaultExporter, CloudExporter, and SensitiveDataFilter instead.
   * This option will be removed in a future version.
   */
  default?: {
    enabled?: boolean;
  };
  /** Map of tracing instance names to their configurations or pre-instantiated instances */
  configs?: Record<string, Omit<ObservabilityInstanceConfig, 'name'> | ObservabilityInstance>;
  /** Optional selector function to choose which tracing instance to use */
  configSelector?: ConfigSelector;
}

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

/**
 * Zod schema for SamplingStrategy
 */
export const samplingStrategySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(SamplingStrategyType.ALWAYS),
  }),
  z.object({
    type: z.literal(SamplingStrategyType.NEVER),
  }),
  z.object({
    type: z.literal(SamplingStrategyType.RATIO),
    probability: z.number().min(0, 'Probability must be between 0 and 1').max(1, 'Probability must be between 0 and 1'),
  }),
  z.object({
    type: z.literal(SamplingStrategyType.CUSTOM),
    sampler: z.function({ input: z.tuple([z.any().optional()]), output: z.boolean() }),
  }),
]);

/**
 * Zod schema for SerializationOptions
 */
export const serializationOptionsSchema = z
  .object({
    maxStringLength: z.number().int().positive().optional(),
    maxDepth: z.number().int().positive().optional(),
    maxArrayLength: z.number().int().positive().optional(),
    maxObjectKeys: z.number().int().positive().optional(),
  })
  .optional();

const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'] as const;

const cardinalityConfigSchema = z
  .object({
    blockedLabels: z.array(z.string()).optional(),
    blockUUIDs: z.boolean().optional(),
  })
  .optional();

const loggingConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    level: z.enum(LOG_LEVELS).optional(),
  })
  .optional();

const spanFilterSchema = z
  .function({
    input: z.tuple([z.any()]),
    output: z.boolean(),
  })
  .optional();

const observabilityInstanceConfigFields = {
  serviceName: z.string().min(1, 'Service name is required'),
  sampling: samplingStrategySchema.optional(),
  exporters: z.array(z.any()).optional(),
  bridge: z.any().optional(),
  spanOutputProcessors: z.array(z.any()).optional(),
  includeInternalSpans: z.boolean().optional(),
  excludeSpanTypes: z.array(z.nativeEnum(SpanType)).optional(),
  spanFilter: spanFilterSchema,
  requestContextKeys: z.array(z.string()).optional(),
  serializationOptions: serializationOptionsSchema,
  cardinality: cardinalityConfigSchema,
  logging: loggingConfigSchema,
};

/**
 * Zod schema for ObservabilityInstanceConfig
 * Note: exporters, spanOutputProcessors, bridge, and configSelector are validated as any
 * since they're complex runtime objects
 */
export const observabilityInstanceConfigSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    ...observabilityInstanceConfigFields,
  })
  .refine(
    data => {
      // At least one exporter or a bridge must be provided
      const hasExporters = data.exporters && data.exporters.length > 0;
      const hasBridge = !!data.bridge;
      return hasExporters || hasBridge;
    },
    {
      message: 'At least one exporter or a bridge is required',
    },
  );

/**
 * Zod schema for config values in the configs map
 * This is the config object without the name field
 */
export const observabilityConfigValueSchema = z.object(observabilityInstanceConfigFields).refine(
  data => {
    // At least one exporter or a bridge must be provided
    const hasExporters = data.exporters && data.exporters.length > 0;
    const hasBridge = !!data.bridge;
    return hasExporters || hasBridge;
  },
  {
    message: 'At least one exporter or a bridge is required',
  },
);

/**
 * Zod schema for ObservabilityRegistryConfig
 * Note: Individual configs are validated separately in the constructor to allow for
 * both plain config objects and pre-instantiated ObservabilityInstance objects.
 * The schema is permissive to handle edge cases gracefully (arrays, null values).
 */
export const observabilityRegistryConfigSchema = z
  .object({
    default: z
      .object({
        enabled: z.boolean().optional(),
      })
      .optional()
      .nullable(),
    configs: z.union([z.record(z.string(), z.any()), z.array(z.any()), z.null()]).optional(),
    configSelector: z.function().optional(),
  })
  .passthrough() // Allow additional properties
  .refine(
    data => {
      // Validate that default (when enabled) and configs are mutually exclusive
      const isDefaultEnabled = data.default?.enabled === true;
      // Check if configs has any entries (only if it's actually an object)
      const hasConfigs =
        data.configs && typeof data.configs === 'object' && !Array.isArray(data.configs)
          ? Object.keys(data.configs).length > 0
          : false;

      // Cannot have both default enabled and any configs
      return !(isDefaultEnabled && hasConfigs);
    },
    {
      message:
        'Cannot specify both "default" (when enabled) and "configs". Use either default observability or custom configs, but not both.',
    },
  )
  .refine(
    data => {
      // Validate that configSelector is required when there are multiple configs
      const configCount =
        data.configs && typeof data.configs === 'object' && !Array.isArray(data.configs)
          ? Object.keys(data.configs).length
          : 0;

      // If there are 2 or more configs, configSelector must be provided
      if (configCount > 1 && !data.configSelector) {
        return false;
      }

      return true;
    },
    {
      message:
        'A "configSelector" function is required when multiple configs are specified to determine which config to use.',
    },
  )
  .refine(
    data => {
      // Validate that if configSelector is provided, there must be configs or default
      if (data.configSelector) {
        const isDefaultEnabled = data.default?.enabled === true;
        const hasConfigs =
          data.configs && typeof data.configs === 'object' && !Array.isArray(data.configs)
            ? Object.keys(data.configs).length > 0
            : false;

        // If configSelector is provided, must have either default enabled or configs
        return isDefaultEnabled || hasConfigs;
      }

      return true;
    },
    {
      message: 'A "configSelector" requires at least one config or default observability to be configured.',
    },
  );
