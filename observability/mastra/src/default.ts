import type { Mastra } from '@mastra/core';
import { MastraBase } from '@mastra/core/base';
import { RegisteredLogger } from '@mastra/core/logger';
import type { IMastraLogger } from '@mastra/core/logger';
import type {
  ConfigSelector,
  ConfigSelectorOptions,
  Observability,
  ObservabilityInstance,
} from '@mastra/core/observability';
import { SamplingStrategyType } from './config';
import type { ObservabilityInstanceConfig, ObservabilityRegistryConfig } from './config';
import { CloudExporter, DefaultExporter } from './exporters';
import { BaseObservabilityInstance, DefaultObservabilityInstance } from './instances';
import { ObservabilityRegistry } from './registry';
import { SensitiveDataFilter } from './span_processors';

/**
 * Type guard to check if an object is a BaseObservability instance
 */
function isInstance(
  obj: Omit<ObservabilityInstanceConfig, 'name'> | ObservabilityInstance,
): obj is ObservabilityInstance {
  return obj instanceof BaseObservabilityInstance;
}

export class DefaultObservability extends MastraBase implements Observability {
  #registry = new ObservabilityRegistry();

  constructor(config: ObservabilityRegistryConfig) {
    super({
      component: RegisteredLogger.OBSERVABILITY,
      name: 'DefaultObservability',
    });

    if (config === undefined) {
      config = {};
    }

    // Check for naming conflict if default is enabled
    if (config.default?.enabled && config.configs?.['default']) {
      throw new Error(
        "Cannot use 'default' as a custom config name when default tracing is enabled. " +
          'Please rename your custom config to avoid conflicts.',
      );
    }

    // Setup default config if enabled
    if (config.default?.enabled) {
      const defaultInstance = new DefaultObservabilityInstance({
        serviceName: 'mastra',
        name: 'default',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [new DefaultExporter(), new CloudExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      });

      // Register as default with high priority
      this.#registry.register('default', defaultInstance, true);
    }

    if (config.configs) {
      // Process user-provided configs
      const instances = Object.entries(config.configs);

      instances.forEach(([name, tracingDef], index) => {
        const instance = isInstance(tracingDef)
          ? tracingDef // Pre-instantiated custom implementation
          : new DefaultObservabilityInstance({ ...tracingDef, name }); // Config -> DefaultObservability with instance name

        // First user-provided instance becomes default only if no default config
        const isDefault = !config.default?.enabled && index === 0;
        this.#registry.register(name, instance, isDefault);
      });
    }

    // Set selector function if provided
    if (config.configSelector) {
      this.#registry.setSelector(config.configSelector);
    }
  }

  setMastraContext(options: { mastra: Mastra }): void {
    const instances = this.listInstances();
    const { mastra } = options;

    instances.forEach(instance => {
      const config = instance.getConfig();
      const exporters = instance.getExporters();
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
    this.listInstances().forEach(instance => {
      instance.__setLogger(options.logger);
    });
    return;
  }

  getSelectedInstance(options: ConfigSelectorOptions): ObservabilityInstance | undefined {
    return this.#registry.getSelected(options);
  }

  /**
   * Registry management methods
   */

  registerInstance(name: string, instance: ObservabilityInstance, isDefault = false): void {
    this.#registry.register(name, instance, isDefault);
  }

  getInstance(name: string): ObservabilityInstance | undefined {
    return this.#registry.get(name);
  }

  getDefaultInstance(): ObservabilityInstance | undefined {
    return this.#registry.getDefault();
  }

  listInstances(): ReadonlyMap<string, ObservabilityInstance> {
    return this.#registry.list();
  }

  unregisterInstance(name: string): boolean {
    return this.#registry.unregister(name);
  }

  hasInstance(name: string): boolean {
    return !!this.#registry.get(name);
  }

  setConfigSelector(selector: ConfigSelector): void {
    this.#registry.setSelector(selector);
  }

  clear(): void {
    this.#registry.clear();
  }

  async shutdown(): Promise<void> {
    await this.#registry.shutdown();
  }
}
