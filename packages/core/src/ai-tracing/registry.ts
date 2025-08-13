/**
 * AI Tracing Registry for Mastra
 *
 * Provides a global registry for AI tracing instances.
 */

import type { MastraAITracing } from './base';
import { SamplingStrategyType } from './types';

// ============================================================================
// Global AI Tracing Registry
// ============================================================================

/**
 * Global registry for AI Tracing instances.
 */
class AITracingRegistry {
  private instances = new Map<string, MastraAITracing>();
  private defaultInstance?: MastraAITracing;

  /**
   * Register a tracing instance
   */
  register(name: string, instance: MastraAITracing, isDefault = false): void {
    this.instances.set(name, instance);
    if (isDefault || !this.defaultInstance) {
      this.defaultInstance = instance;
    }
  }

  /**
   * Get a tracing instance by name
   */
  get(name?: string): MastraAITracing | undefined {
    if (name) {
      return this.instances.get(name);
    }
    return this.defaultInstance;
  }

  /**
   * Unregister a tracing instance
   */
  unregister(name: string): boolean {
    const instance = this.instances.get(name);
    if (instance && instance === this.defaultInstance) {
      // Find another instance to be the default
      const remaining = Array.from(this.instances.values()).filter(i => i !== instance);
      this.defaultInstance = remaining[0];
    }
    return this.instances.delete(name);
  }

  /**
   * Clear all instances
   */
  clear(): void {
    this.instances.clear();
    this.defaultInstance = undefined;
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
export function getAITracing(name?: string): MastraAITracing | undefined {
  return aiTracingRegistry.get(name);
}

/**
 * Unregister an AI tracing instance
 */
export function unregisterAITracing(name: string): boolean {
  return aiTracingRegistry.unregister(name);
}

/**
 * Clear all AI tracing instances
 */
export function clearAITracingRegistry(): void {
  aiTracingRegistry.clear();
}

/**
 * Check if AI tracing is available and enabled
 */
export function hasAITracing(name?: string): boolean {
  const tracing = getAITracing(name);
  if (!tracing) return false;

  const config = tracing.getConfig();
  const sampling = config.sampling;

  // Check if sampling allows tracing
  return sampling.type !== SamplingStrategyType.NEVER;
}
