/**
 * Runtime provider registry loader
 * Loads provider data from JSON file and exports typed interfaces
 */
import type { ProviderConfig, MastraModelGateway } from './gateways/base.js';
import type { Provider, ModelForProvider, ModelRouterModelId, ProviderModels } from './provider-types.generated.js';
export type { Provider, ModelForProvider, ModelRouterModelId, ProviderModels };
export declare const PROVIDER_REGISTRY: Record<Provider, ProviderConfig>;
export declare const PROVIDER_MODELS: ProviderModels;
/**
 * Parse a model string to extract provider and model ID
 * Examples:
 *   "openai/gpt-4o" -> { provider: "openai", modelId: "gpt-4o" }
 *   "fireworks/accounts/etc/model" -> { provider: "fireworks", modelId: "accounts/etc/model" }
 *   "gpt-4o" -> { provider: null, modelId: "gpt-4o" }
 */
export declare function parseModelString(modelString: string): {
    provider: string | null;
    modelId: string;
};
/**
 * Get provider configuration by provider ID
 */
export declare function getProviderConfig(providerId: string): ProviderConfig | undefined;
/**
 * Check if a provider is registered
 */
export declare function isProviderRegistered(providerId: string): boolean;
/**
 * Get all registered provider IDs
 */
export declare function getRegisteredProviders(): string[];
/**
 * Type guard to check if a string is a valid OpenAI-compatible model ID
 */
export declare function isValidModelId(modelId: string): modelId is ModelRouterModelId;
export interface GatewayRegistryOptions {
    /**
     * Enable dynamic loading from file system instead of using static bundled registry.
     * Required for syncGateways() and auto-refresh to work.
     * Defaults to true when MASTRA_DEV=true, false otherwise.
     */
    useDynamicLoading?: boolean;
}
/**
 * GatewayRegistry - Manages dynamic loading and refreshing of provider data from gateways
 * Singleton class that handles runtime updates to the provider registry
 */
export declare class GatewayRegistry {
    private static instance;
    private lastRefreshTime;
    private refreshInterval;
    private isRefreshing;
    private useDynamicLoading;
    private customGateways;
    private constructor();
    /**
     * Get the singleton instance
     */
    static getInstance(options?: GatewayRegistryOptions): GatewayRegistry;
    /**
     * Register custom gateways for type generation
     * @param gateways - Array of custom gateway instances
     */
    registerCustomGateways(gateways: MastraModelGateway[]): void;
    /**
     * Get all registered custom gateways
     */
    getCustomGateways(): MastraModelGateway[];
    /**
     * Sync providers from all gateways
     * Requires dynamic loading to be enabled (useDynamicLoading=true).
     * @param forceRefresh - Force refresh even if recently synced
     * @param writeToSrc - Write to src/ directory in addition to dist/ (useful for manual generation in repo)
     */
    syncGateways(forceRefresh?: boolean, writeToSrc?: boolean): Promise<void>;
    /**
     * Get the last refresh time (from memory or disk cache)
     */
    getLastRefreshTime(): Date | null;
    /**
     * Start auto-refresh on an interval
     * Requires dynamic loading to be enabled (useDynamicLoading=true).
     * @param intervalMs - Interval in milliseconds (default: 1 hour)
     */
    startAutoRefresh(intervalMs?: number): void;
    /**
     * Stop auto-refresh
     */
    stopAutoRefresh(): void;
    /**
     * Get provider configuration by ID
     */
    getProviderConfig(providerId: string): ProviderConfig | undefined;
    /**
     * Check if a provider is registered
     */
    isProviderRegistered(providerId: string): boolean;
    /**
     * Get all registered providers
     */
    getProviders(): Record<string, ProviderConfig>;
    /**
     * Get all models
     */
    getModels(): Record<string, string[]>;
}
//# sourceMappingURL=provider-registry.d.ts.map