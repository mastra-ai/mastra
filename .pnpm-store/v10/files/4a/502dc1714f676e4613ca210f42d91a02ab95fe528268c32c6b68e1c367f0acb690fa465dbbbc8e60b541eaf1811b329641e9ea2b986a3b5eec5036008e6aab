/**
 * Observability Registry for Mastra
 *
 * Provides registry for Observability instances.
 */
import type { ObservabilityInstance, ConfigSelectorOptions, ConfigSelector } from '@mastra/core/observability';
/**
 * Registry for Observability instances.
 */
export declare class ObservabilityRegistry {
    #private;
    /**
     * Register a tracing instance
     */
    register(name: string, instance: ObservabilityInstance, isDefault?: boolean): void;
    /**
     * Get a tracing instance by name
     */
    get(name: string): ObservabilityInstance | undefined;
    /**
     * Get the default tracing instance
     */
    getDefault(): ObservabilityInstance | undefined;
    /**
     * Set the tracing selector function
     */
    setSelector(selector: ConfigSelector): void;
    /**
     * Get the selected tracing instance based on context
     */
    getSelected(options: ConfigSelectorOptions): ObservabilityInstance | undefined;
    /**
     * Unregister a tracing instance
     */
    unregister(name: string): boolean;
    /**
     * Shutdown all instances and clear the registry
     */
    shutdown(): Promise<void>;
    /**
     * Clear all instances without shutdown
     */
    clear(): void;
    /**
     * list all registered instances
     */
    list(): ReadonlyMap<string, ObservabilityInstance>;
}
//# sourceMappingURL=registry.d.ts.map