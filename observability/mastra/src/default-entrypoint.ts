import type { Mastra } from '@mastra/core';
import { MastraBase } from '@mastra/core/base';
import { RegisteredLogger } from '@mastra/core/logger';
import type { IMastraLogger } from '@mastra/core/logger';
import type {
  ConfigSelectorOptions,
  ObservabilityEntrypoint,
  ObservabilityRegistryConfig,
} from '@mastra/core/observability';
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

  getSelectedObservability(options: ConfigSelectorOptions) {
    return getSelectedAITracing(options);
  }

  async shutdown(): Promise<void> {
    await shutdownAITracingRegistry();
  }
}
