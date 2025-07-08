/**
 * Telemetry Registry for Mastra
 * 
 * Provides a global registry for telemetry instances, replacing the singleton
 * pattern with a more flexible multi-instance approach.
 */

import type { MastraTelemetry } from './base';

// ============================================================================
// Global Telemetry Registry
// ============================================================================

/**
 * Global registry for telemetry instances.
 * This replaces the singleton pattern with a more flexible registry approach.
 */
class TelemetryRegistry {
  private instances = new Map<string, MastraTelemetry>();
  private defaultInstance?: MastraTelemetry;

  /**
   * Register a telemetry instance
   */
  register(name: string, instance: MastraTelemetry, isDefault = false): void {
    this.instances.set(name, instance);
    if (isDefault || !this.defaultInstance) {
      this.defaultInstance = instance;
    }
  }

  /**
   * Get a telemetry instance by name
   */
  get(name?: string): MastraTelemetry | undefined {
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
  getAll(): ReadonlyMap<string, MastraTelemetry> {
    return new Map(this.instances);
  }
}

const telemetryRegistry = new TelemetryRegistry();

// ============================================================================
// Registry Management Functions
// ============================================================================

/**
 * Register a telemetry instance globally
 */
export function registerTelemetry(name: string, instance: MastraTelemetry, isDefault = false): void {
  telemetryRegistry.register(name, instance, isDefault);
}

/**
 * Get a telemetry instance from the registry
 */
export function getTelemetry(name?: string): MastraTelemetry | undefined {
  return telemetryRegistry.get(name);
}

/**
 * Unregister a telemetry instance
 */
export function unregisterTelemetry(name: string): boolean {
  return telemetryRegistry.unregister(name);
}

/**
 * Clear all telemetry instances
 */
export function clearTelemetryRegistry(): void {
  telemetryRegistry.clear();
}

/**
 * Check if telemetry is available and enabled
 */
export function hasTelemetry(name?: string): boolean {
  const telemetry = getTelemetry(name);
  return telemetry?.isEnabled() ?? false;
}