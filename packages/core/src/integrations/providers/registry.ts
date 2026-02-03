/**
 * Provider registry and factory
 *
 * Manages tool provider instances and provides factory methods for
 * accessing providers by name.
 */

import { ArcadeProvider } from './arcade';
import { ComposioProvider } from './composio';
import { MCPPlaceholderProvider } from './mcp';
import { SmitheryPlaceholderProvider } from './smithery';
import type { IntegrationProviderType, ProviderStatus, ToolProvider } from './types';

/**
 * Registry of available tool providers
 */
class ProviderRegistry {
  private providers: Map<IntegrationProviderType, ToolProvider> = new Map();

  constructor() {
    // Register default providers
    this.register('composio', new ComposioProvider());
    this.register('arcade', new ArcadeProvider());
    this.register('mcp', new MCPPlaceholderProvider());
    this.register('smithery', new SmitheryPlaceholderProvider());
  }

  /**
   * Register a tool provider
   */
  register(name: IntegrationProviderType, provider: ToolProvider): void {
    this.providers.set(name, provider);
  }

  /**
   * Get a provider by name
   *
   * @param name - The provider name
   * @returns The provider instance
   * @throws Error if provider is not found
   */
  get(name: IntegrationProviderType): ToolProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider not found: ${name}`);
    }
    return provider;
  }

  /**
   * Get all registered provider names
   */
  getProviderNames(): IntegrationProviderType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get status for all registered providers
   */
  async getAllProviderStatuses(): Promise<ProviderStatus[]> {
    const statuses = Array.from(this.providers.values()).map(provider => provider.getStatus());
    return Promise.all(statuses);
  }

  /**
   * Check if a provider is registered
   */
  has(name: IntegrationProviderType): boolean {
    return this.providers.has(name);
  }
}

/**
 * Global provider registry instance
 */
const registry = new ProviderRegistry();

/**
 * Get a tool provider by name
 *
 * @param name - The provider name ('composio' | 'arcade')
 * @returns The provider instance
 * @throws Error if provider is not found
 *
 * @example
 * ```typescript
 * const composio = getProvider('composio');
 * const toolkits = await composio.listToolkits();
 * ```
 */
export function getProvider(name: IntegrationProviderType): ToolProvider {
  return registry.get(name);
}

/**
 * List all available providers with their connection status
 *
 * @returns Array of provider status objects
 *
 * @example
 * ```typescript
 * const providers = await listProviders();
 * const connected = providers.filter(p => p.connected);
 * ```
 */
export async function listProviders(): Promise<ProviderStatus[]> {
  return registry.getAllProviderStatuses();
}

/**
 * Register a custom tool provider
 *
 * @param name - The provider name
 * @param provider - The provider instance
 *
 * @example
 * ```typescript
 * class CustomProvider implements ToolProvider {
 *   // ... implementation
 * }
 *
 * registerProvider('custom', new CustomProvider());
 * ```
 */
export function registerProvider(name: IntegrationProviderType, provider: ToolProvider): void {
  registry.register(name, provider);
}

/**
 * Check if a provider is registered
 *
 * @param name - The provider name
 * @returns True if the provider is registered
 */
export function hasProvider(name: IntegrationProviderType): boolean {
  return registry.has(name);
}

/**
 * Get all registered provider names
 *
 * @returns Array of provider names
 */
export function getProviderNames(): IntegrationProviderType[] {
  return registry.getProviderNames();
}
