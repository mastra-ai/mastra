/**
 * AI Tracing Registry for Mastra
 *
 * Provides a global registry for AI tracing instances.
 */

import { MastraAITracing } from './base';
import { DefaultAITracing, SensitiveDataFilter } from './default';
import { CloudExporter, DefaultExporter } from './exporters';
import { SamplingStrategyType } from './types';
import type { TracingSelector, AITracingSelectorContext, AITracingConfig, AITracingInstanceConfig } from './types';

// ============================================================================
// Global AI Tracing Registry
// ============================================================================

/**
 * Global registry for AI Tracing instances.
 */
class AITracingRegistry {
  private instances = new Map<string, MastraAITracing>();
  private defaultInstance?: MastraAITracing;
  private selector?: TracingSelector;

  /**
   * Register a tracing instance
   */
  register(name: string, instance: MastraAITracing, isDefault = false): void {
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
  get(name: string): MastraAITracing | undefined {
    return this.instances.get(name);
  }

  /**
   * Get the default tracing instance
   */
  getDefault(): MastraAITracing | undefined {
    return this.defaultInstance;
  }

  /**
   * Set the tracing selector function
   */
  setSelector(selector: TracingSelector): void {
    this.selector = selector;
  }

  /**
   * Get the selected tracing instance based on context
   */
  getSelected(context: AITracingSelectorContext): MastraAITracing | undefined {
    // 1. Try selector function if provided
    if (this.selector) {
      const selected = this.selector(context, this.instances);
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
    this.selector = undefined;
  }

  /**
   * Get all registered instances
   */
  getAll(): ReadonlyMap<string, MastraAITracing> {
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
export function registerAITracing(name: string, instance: MastraAITracing, isDefault = false): void {
  aiTracingRegistry.register(name, instance, isDefault);
}

/**
 * Get an AI tracing instance from the registry
 */
export function getAITracing(name: string): MastraAITracing | undefined {
  return aiTracingRegistry.get(name);
}

/**
 * Get the default AI tracing instance
 */
export function getDefaultAITracing(): MastraAITracing | undefined {
  return aiTracingRegistry.getDefault();
}

/**
 * Set the AI tracing selector function
 */
export function setAITracingSelector(selector: TracingSelector): void {
  aiTracingRegistry.setSelector(selector);
}

/**
 * Get the selected AI tracing instance based on context
 */
export function getSelectedAITracing(context: AITracingSelectorContext): MastraAITracing | undefined {
  return aiTracingRegistry.getSelected(context);
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
export function getAllAITracing(): ReadonlyMap<string, MastraAITracing> {
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
 * Type guard to check if an object is a MastraAITracing instance
 */
function isAITracingInstance(obj: Omit<AITracingInstanceConfig, 'name'> | MastraAITracing): obj is MastraAITracing {
  return obj instanceof MastraAITracing;
}

/**
 * Setup AI tracing from the AITracingConfig
 */
export function setupAITracing(config: AITracingConfig): void {
  // Check for naming conflict if default is enabled
  if (config.default?.enabled && config.configs['default']) {
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

  // Set selector function if provided
  if (config.configSelector) {
    setAITracingSelector(config.configSelector);
  }
}
