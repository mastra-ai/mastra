/**
 * Observability Registry for Mastra
 *
 * Provides registry for Observability instances.
 */

import type { ObservabilityInstance, ConfigSelectorOptions, ConfigSelector } from '@mastra/core/observability';

// ============================================================================
// Observability Registry
// ============================================================================

/**
 * Registry for Observability instances.
 */
export class ObservabilityRegistry {
  #instances = new Map<string, ObservabilityInstance>();
  #defaultInstance?: ObservabilityInstance;
  #configSelector?: ConfigSelector;

  /**
   * Register a tracing instance
   */
  register(name: string, instance: ObservabilityInstance, isDefault = false): void {
    if (this.#instances.has(name)) {
      throw new Error(`Tracing instance '${name}' already registered`);
    }

    this.#instances.set(name, instance);

    // Set as default if explicitly marked or if it's the first instance
    if (isDefault || !this.#defaultInstance) {
      this.#defaultInstance = instance;
    }
  }

  /**
   * Get a tracing instance by name
   */
  get(name: string): ObservabilityInstance | undefined {
    return this.#instances.get(name);
  }

  /**
   * Get the default tracing instance
   */
  getDefault(): ObservabilityInstance | undefined {
    return this.#defaultInstance;
  }

  /**
   * Set the tracing selector function
   */
  setSelector(selector: ConfigSelector): void {
    this.#configSelector = selector;
  }

  /**
   * Get the selected tracing instance based on context
   */
  getSelected(options: ConfigSelectorOptions): ObservabilityInstance | undefined {
    // 1. Try selector function if provided
    if (this.#configSelector) {
      const selected = this.#configSelector(options, this.#instances);
      if (selected && this.#instances.has(selected)) {
        return this.#instances.get(selected);
      }
    }

    // 2. Fall back to default
    return this.#defaultInstance;
  }

  /**
   * Unregister a tracing instance
   */
  unregister(name: string): boolean {
    const instance = this.#instances.get(name);
    const deleted = this.#instances.delete(name);

    if (deleted && instance === this.#defaultInstance) {
      const next = this.#instances.values().next();
      this.#defaultInstance = next.done ? undefined : next.value;
    }

    return deleted;
  }

  /**
   * Shutdown all instances and clear the registry
   */
  async shutdown(): Promise<void> {
    const shutdownPromises = Array.from(this.#instances.values()).map(instance => instance.shutdown());

    await Promise.allSettled(shutdownPromises);
    this.#instances.clear();
    this.#instances.clear();
    this.#defaultInstance = undefined;
    this.#configSelector = undefined;
  }

  /**
   * Clear all instances without shutdown
   */
  clear(): void {
    this.#instances.clear();
    this.#defaultInstance = undefined;
    this.#configSelector = undefined;
  }

  /**
   * list all registered instances
   */
  list(): ReadonlyMap<string, ObservabilityInstance> {
    return new Map(this.#instances);
  }
}
