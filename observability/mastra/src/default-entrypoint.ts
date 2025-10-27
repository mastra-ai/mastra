import { MastraBase } from '@mastra/core';
import type { Mastra } from '@mastra/core';
import { RegisteredLogger } from '@mastra/core/logger';
import type { IMastraLogger } from '@mastra/core/logger';
import type {
  AISpan,
  AISpanType,
  GetOrCreateSpanOptions,
  IModelSpanTracker,
  ObservabilityEntrypoint,
  ObservabilityRegistryConfig,
} from '@mastra/core/observability';
import { ModelSpanTracker } from './model-tracing';
import { getAllAITracing, getSelectedAITracing, setupAITracingRegistry, shutdownAITracingRegistry } from './registry';

export class DefaultEntrypoint extends MastraBase implements ObservabilityEntrypoint {
  constructor(config: ObservabilityRegistryConfig) {
    super({
      component: RegisteredLogger.AI_TRACING,
      name: 'DefaultObservabilityEntrypoint',
    });
    setupAITracingRegistry(config);
  }

  registerMastra(options: { mastra: Mastra }): void {
    const allTracingInstances = getAllAITracing();
    const { mastra } = options;

    allTracingInstances.forEach(tracing => {
      const config = tracing.getConfig();
      const exporters = tracing.getExporters();
      exporters.forEach(exporter => {
        // Initialize exporter if it has an init method
        if ('init' in exporter && typeof exporter.init === 'function') {
          try {
            exporter.init({ mastra, config });
          } catch (error) {
            this.logger?.warn('Failed to initialize observability exporter', {
              exporterName: exporter.name,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      });
    });
  }

  setLogger(options: { logger: IMastraLogger }): void {
    const allTracingInstances = getAllAITracing();
    allTracingInstances.forEach(instance => {
      instance.__setLogger(options.logger);
    });
    return;
  }

  /**
   * Creates or gets a child span from existing tracing context or starts a new trace.
   * This helper consolidates the common pattern of creating spans that can either be:
   * 1. Children of an existing span (when tracingContext.currentSpan exists)
   * 2. New root spans (when no current span exists)
   *
   * @param options - Configuration object for span creation
   * @returns The created AI span or undefined if tracing is disabled
   */
  getOrCreateSpan<T extends AISpanType>(options: GetOrCreateSpanOptions<T>): AISpan<T> | undefined {
    const { type, attributes, tracingContext, runtimeContext, tracingOptions, ...rest } = options;

    const metadata = {
      ...(rest.metadata ?? {}),
      ...(tracingOptions?.metadata ?? {}),
    };

    // If we have a current span, create a child span
    if (tracingContext?.currentSpan) {
      return tracingContext.currentSpan.createChildSpan({
        type,
        attributes,
        ...rest,
        metadata,
      });
    }

    // Otherwise, try to create a new root span
    const aiTracing = getSelectedAITracing({
      runtimeContext: runtimeContext,
    });

    return aiTracing?.startSpan<T>({
      type,
      attributes,
      ...rest,
      metadata,
      runtimeContext,
      tracingOptions,
      traceId: tracingOptions?.traceId,
      parentSpanId: tracingOptions?.parentSpanId,
      customSamplerOptions: {
        runtimeContext,
        metadata,
      },
    });
  }

  getModelSpanTracker(modelSpan?: AISpan<AISpanType.MODEL_GENERATION>): IModelSpanTracker | undefined {
    return new ModelSpanTracker(modelSpan);
  }

  async shutdown(): Promise<void> {
    await shutdownAITracingRegistry();
  }
}
