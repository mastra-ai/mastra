/**
 * Telemetry Registry for Mastra
 *
 * Provides a global registry for telemetry instances, replacing the singleton
 * pattern with a more flexible multi-instance approach.
 */

import type { MastraAITelemetry } from './base';

// ============================================================================
// Global AI Telemetry Registry
// ============================================================================

/**
 * Global registry for AI Telemetry instances.
 */
class AITelemetryRegistry {
  private instances = new Map<string, MastraAITelemetry>();
  private defaultInstance?: MastraAITelemetry;

  /**
   * Register a telemetry instance
   */
  register(name: string, instance: MastraAITelemetry, isDefault = false): void {
    this.instances.set(name, instance);
    if (isDefault || !this.defaultInstance) {
      this.defaultInstance = instance;
    }
  }

  /**
   * Get a telemetry instance by name
   */
  get(name?: string): MastraAITelemetry | undefined {
    if (name) {
      return this.instances.get(name);
    }
    return this.defaultInstance;
  }

  /**
   * Unregister a telemetry instance
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
  getAll(): ReadonlyMap<string, MastraAITelemetry> {
    return new Map(this.instances);
  }
}

const aiTelemetryRegistry = new AITelemetryRegistry();

// ============================================================================
// Registry Management Functions
// ============================================================================

/**
 * Register a telemetry instance globally
 */
export function registerAITelemetry(name: string, instance: MastraAITelemetry, isDefault = false): void {
  aiTelemetryRegistry.register(name, instance, isDefault);
}

/**
 * Get a telemetry instance from the registry
 */
export function getAITelemetry(name?: string): MastraAITelemetry | undefined {
  return aiTelemetryRegistry.get(name);
}

/**
 * Unregister a telemetry instance
 */
export function unregisterAITelemetry(name: string): boolean {
  return aiTelemetryRegistry.unregister(name);
}

/**
 * Clear all telemetry instances
 */
export function clearAITelemetryRegistry(): void {
  aiTelemetryRegistry.clear();
}

/**
 * Check if telemetry is available and enabled
 */
export function hasAITelemetry(name?: string): boolean {
  const telemetry = getAITelemetry(name);
  return telemetry?.isEnabled() ?? false;
}
