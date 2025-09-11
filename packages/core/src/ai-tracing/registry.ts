/**
 * AI Tracing Registry for Mastra
 *
 * Provides a global registry for AI tracing instances.
 */

import { CloudExporter, DefaultExporter } from './exporters';
import { SensitiveDataFilter } from './span_processors';
import { BaseAITracing, DefaultAITracing } from './tracers';
import { SamplingStrategyType } from './types';
import type {
  AITracing,
  ConfigSelectorOptions,
  ConfigSelector,
  TracingConfig,
  ObservabilityRegistryConfig,
} from './types';

// ============================================================================
// Global AI Tracing Registry
// ============================================================================

/**
 * Global registry for AI Tracing instances.
 */
class AITracingRegistry {
  private instances = new Map<string, AITracing>();
  private defaultInstance?: AITracing;
  private configSelector?: ConfigSelector;

  /**
   * Register a tracing instance
   */
  register(name: string, instance: AITracing, isDefault = false): void {
    if (this.instances.has(name)) {
      throw new Error(`AI Tracing instance '${name}' already registered`);
    }

    this.instances.set(name, instance);

    // Set as default if explicitly marked or if it's the first instance
    if (isDefault || !this.defaultInstance) {
      this.defaultInstance = instance;
    }
  }

  /**
   * Get a tracing instance by name
   */
  get(name: string): AITracing | undefined {
    return this.instances.get(name);
  }

  /**
   * Get the default tracing instance
   */
  getDefault(): AITracing | undefined {
    return this.defaultInstance;
  }

  /**
   * Set the tracing selector function
   */
  setSelector(selector: ConfigSelector): void {
    this.configSelector = selector;
  }

  /**
   * Get the selected tracing instance based on context
   */
  getSelected(options: ConfigSelectorOptions): AITracing | undefined {
    // 1. Try selector function if provided
    if (this.configSelector) {
      const selected = this.configSelector(options, this.instances);
      if (selected && this.instances.has(selected)) {
        return this.instances.get(selected);
      }
    }

    // 2. Fall back to default
    return this.defaultInstance;
  }

  /**
   * Unregister a tracing instance
   */
  unregister(name: string): boolean {
    return this.instances.delete(name);
  }

  /**
   * Shutdown all instances and clear the registry
   */
  async shutdown(): Promise<void> {
    const shutdownPromises = Array.from(this.instances.values()).map(instance => instance.shutdown());

    await Promise.allSettled(shutdownPromises);
    this.instances.clear();
  }

  /**
   * Clear all instances without shutdown
   */
  clear(): void {
    this.instances.clear();
    this.defaultInstance = undefined;
    this.configSelector = undefined;
  }

  /**
   * Get all registered instances
   */
  getAll(): ReadonlyMap<string, AITracing> {
    return new Map(this.instances);
  }
}

const aiTracingRegistry = new AITracingRegistry();

// ============================================================================
// Registry Management Functions
// ============================================================================

/**
 * Register an AI tracing instance globally
 */
export function registerAITracing(name: string, instance: AITracing, isDefault = false): void {
  aiTracingRegistry.register(name, instance, isDefault);
}

/**
 * Get an AI tracing instance from the registry
 */
export function getAITracing(name: string): AITracing | undefined {
  return aiTracingRegistry.get(name);
}

/**
 * Get the default AI tracing instance
 */
export function getDefaultAITracing(): AITracing | undefined {
  return aiTracingRegistry.getDefault();
}

/**
 * Set the AI tracing config selector
 */
export function setSelector(selector: ConfigSelector): void {
  aiTracingRegistry.setSelector(selector);
}

/**
 * Get the selected AI tracing instance based on options
 */
export function getSelectedAITracing(options: ConfigSelectorOptions): AITracing | undefined {
  return aiTracingRegistry.getSelected(options);
}

/**
 * Unregister an AI tracing instance
 */
export function unregisterAITracing(name: string): boolean {
  return aiTracingRegistry.unregister(name);
}

/**
 * Shutdown all AI tracing instances and clear the registry
 */
export async function shutdownAITracingRegistry(): Promise<void> {
  await aiTracingRegistry.shutdown();
}

/**
 * Clear all AI tracing instances without shutdown
 */
export function clearAITracingRegistry(): void {
  aiTracingRegistry.clear();
}

/**
 * Get all registered AI tracing instances
 */
export function getAllAITracing(): ReadonlyMap<string, AITracing> {
  return aiTracingRegistry.getAll();
}

/**
 * Check if AI tracing is available and enabled
 */
export function hasAITracing(name: string): boolean {
  const tracing = getAITracing(name);
  if (!tracing) return false;

  const config = tracing.getConfig();
  const sampling = config.sampling;

  // Check if sampling allows tracing
  return sampling.type !== SamplingStrategyType.NEVER;
}

/**
 * Type guard to check if an object is a BaseAITracing instance
 */
function isAITracingInstance(obj: Omit<TracingConfig, 'name'> | AITracing): obj is AITracing {
  return obj instanceof BaseAITracing;
}

/**
 * Setup AI tracing from the ObservabilityRegistryConfig
 */
export function setupAITracing(config: ObservabilityRegistryConfig): void {
  // Handle undefined/null config
  if (!config) {
    return;
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
    const defaultInstance = new DefaultAITracing({
      serviceName: 'mastra',
      name: 'default',
      sampling: { type: SamplingStrategyType.ALWAYS },
      exporters: [new DefaultExporter(), new CloudExporter()],
      processors: [new SensitiveDataFilter()],
    });

    // Register as default with high priority
    registerAITracing('default', defaultInstance, true);
  }

  if (config.configs) {
    // Process user-provided configs
    const instances = Object.entries(config.configs);

    instances.forEach(([name, tracingDef], index) => {
      const instance = isAITracingInstance(tracingDef)
        ? tracingDef // Pre-instantiated custom implementation
        : new DefaultAITracing({ ...tracingDef, name }); // Config -> DefaultAITracing with instance name

      // First user-provided instance becomes default only if no default config
      const isDefault = !config.default?.enabled && index === 0;
      registerAITracing(name, instance, isDefault);
    });
  }

  // Set selector function if provided
  if (config.configSelector) {
    setSelector(config.configSelector);
  }
}
