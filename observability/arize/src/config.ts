import {
  type SerializationOptions,
  type ObservabilityInstanceConfig,
} from '@mastra/core/observability';


export const ARIZE_RECOMMENDED_SERIALIZATION_OPTIONS: SerializationOptions = {
  maxStringLength: 9999999,
  maxDepth: 9999999,
  maxArrayLength: 9999999,
  maxObjectKeys: 9999999,
};

/**
 * Configuration options for creating an Arize observability config.
 * Extends ObservabilityInstanceConfig to allow pass-through of all properties.
 */
export interface CreateArizeConfigOptions extends Omit<ObservabilityInstanceConfig, 'name' | 'serviceName'> {
  serviceName?: string;
  serializationOptions?: SerializationOptions;
}

/**
 * Creates an Arize observability config with recommended serialization defaults.
 *
 * @example
 * ```typescript
 * createArizeConfig({
 *   exporters: [new ArizeExporter({ endpoint: '...' })],
 * })
 * ```
 *
 * @example Multiple exporters
 * ```typescript
 * createArizeConfig({
 *   exporters: [
 *     new ArizeExporter({ endpoint: '...' }),
 *     new DefaultExporter(),
 *   ],
 * })
 * ```
 */
export function createArizeConfig(
  options: CreateArizeConfigOptions,
): Omit<ObservabilityInstanceConfig, 'name'> {
  const {
    serviceName = process.env.PHOENIX_PROJECT_NAME ||
      process.env.ARIZE_PROJECT_NAME ||
      'mastra-tracing',
    serializationOptions,
    ...rest
  } = options;

  return {
    ...rest,
    serviceName,
    serializationOptions: serializationOptions
      ? { ...ARIZE_RECOMMENDED_SERIALIZATION_OPTIONS, ...serializationOptions }
      : ARIZE_RECOMMENDED_SERIALIZATION_OPTIONS,
  };
}

