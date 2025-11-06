/**
 * Configuration types for Mastra Observability
 *
 * These types define the configuration structure for observability,
 * including tracing configs, sampling strategies, and registry setup.
 */

import { z } from 'zod';
import type { RequestContext } from '@mastra/core/di';
import type {
  ObservabilityInstance,
  ObservabilityExporter,
  SpanOutputProcessor,
  ConfigSelector,
} from '@mastra/core/observability';

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
  /** Custom span output processors */
  spanOutputProcessors?: SpanOutputProcessor[];
  /** Set to `true` if you want to see spans internal to the operation of mastra */
  includeInternalSpans?: boolean;
  /**
   * RequestContext keys to automatically extract as metadata for all spans
   * created with this tracing configuration.
   * Supports dot notation for nested values.
   */
  requestContextKeys?: string[];
}

/**
 * Complete Observability registry configuration
 */
export interface ObservabilityRegistryConfig {
  /** Enables default exporters, with sampling: always, and sensitive data filtering */
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
    sampler: z.function().args(z.any().optional()).returns(z.boolean()),
  }),
]);

/**
 * Zod schema for ObservabilityInstanceConfig
 * Note: exporters, spanOutputProcessors, and configSelector are validated as any
 * since they're complex runtime objects
 */
export const observabilityInstanceConfigSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  serviceName: z.string().min(1, 'Service name is required'),
  sampling: samplingStrategySchema.optional(),
  exporters: z.array(z.any()).optional(),
  spanOutputProcessors: z.array(z.any()).optional(),
  includeInternalSpans: z.boolean().optional(),
  requestContextKeys: z.array(z.string()).optional(),
});

/**
 * Zod schema for config values in the configs map
 * This is the config object without the name field
 */
export const observabilityConfigValueSchema = z.object({
  serviceName: z.string().min(1, 'Service name is required'),
  sampling: samplingStrategySchema.optional(),
  exporters: z.array(z.any()).optional(),
  spanOutputProcessors: z.array(z.any()).optional(),
  includeInternalSpans: z.boolean().optional(),
  requestContextKeys: z.array(z.string()).optional(),
});

/**
 * Zod schema for ObservabilityRegistryConfig
 * Validates that either 'default' OR 'configs' is set, but not both
 * Note: Individual configs are validated separately in the constructor to allow for
 * both plain config objects and pre-instantiated ObservabilityInstance objects
 */
export const observabilityRegistryConfigSchema = z
  .object({
    default: z
      .object({
        enabled: z.boolean().optional(),
      })
      .optional(),
    configs: z.record(z.string(), z.any()).optional(),
    configSelector: z.function().optional(),
  })
  .refine(
    data => {
      // Either default or configs can be set, but not both
      const hasDefault = data.default !== undefined;
      const hasConfigs = data.configs !== undefined && Object.keys(data.configs).length > 0;

      // It's ok to have neither, or just one, but not both
      return !(hasDefault && hasConfigs);
    },
    {
      message:
        'Cannot specify both "default" and "configs". Use either default configuration or custom configs, but not both.',
    },
  );
