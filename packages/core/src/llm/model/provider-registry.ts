/**
 * Runtime provider registry loader
 * Loads provider data from JSON file and exports typed interfaces
 */

import fs from 'fs';
import { createRequire } from 'module';
import os from 'os';
import path from 'path';
import type { ProviderConfig, MastraModelGateway } from './gateways/base.js';
import staticRegistry from './provider-registry.json';
import type { Provider, ModelForProvider, ModelRouterModelId, ProviderModels } from './provider-types.generated.js';

// Re-export types for convenience
export type { Provider, ModelForProvider, ModelRouterModelId, ProviderModels };

interface RegistryData {
  providers: Record<string, ProviderConfig>;
  models: Record<string, string[]>;
  version: string;
}

// In-memory cache for dynamic loading mode
let registryData: RegistryData | null = null;

// Cache file helpers (dev mode only)
// Use functions so we don't call os.homedir() at top level, which
// causes an error in sandboxed environments when you merely
// import @mastra/core. In those sandboxes, if you just don't use these
// functions then you don't hit these errors.
const CACHE_DIR = () => path.join(os.homedir(), '.cache', 'mastra');
const CACHE_FILE = () => path.join(CACHE_DIR(), 'gateway-refresh-time');
const GLOBAL_PROVIDER_REGISTRY_JSON = () => path.join(CACHE_DIR(), 'provider-registry.json');
const GLOBAL_PROVIDER_TYPES_DTS = () => path.join(CACHE_DIR(), 'provider-types.generated.d.ts');

let modelRouterCacheFailed = false;

/**
 * Syncs provider files from global cache to local dist/ directory if needed.
 * Compares file contents to determine if copy is necessary.
 */
function syncGlobalCacheToLocal(): void {
  try {
    // Check if global cache files exist
    const globalJsonExists = fs.existsSync(GLOBAL_PROVIDER_REGISTRY_JSON());
    const globalDtsExists = fs.existsSync(GLOBAL_PROVIDER_TYPES_DTS());

    if (!globalJsonExists && !globalDtsExists) {
      // No global cache, nothing to sync
      return;
    }

    // Use getPackageRoot() to find the correct location in node_modules or local dev
    const packageRoot = getPackageRoot();
    const localJsonPath = path.join(packageRoot, 'dist', 'provider-registry.json');
    const localDtsPath = path.join(packageRoot, 'dist', 'llm', 'model', 'provider-types.generated.d.ts');

    // Ensure local dist directory exists
    fs.mkdirSync(path.dirname(localJsonPath), { recursive: true });
    fs.mkdirSync(path.dirname(localDtsPath), { recursive: true });

    // Sync JSON file if global exists and differs from local
    if (globalJsonExists) {
      const globalJsonContent = fs.readFileSync(GLOBAL_PROVIDER_REGISTRY_JSON(), 'utf-8');
      let shouldCopyJson = true;

      if (fs.existsSync(localJsonPath)) {
        const localJsonContent = fs.readFileSync(localJsonPath, 'utf-8');
        shouldCopyJson = globalJsonContent !== localJsonContent;
      }

      if (shouldCopyJson) {
        fs.writeFileSync(localJsonPath, globalJsonContent, 'utf-8');
      }
    }

    // Sync .d.ts file if global exists and differs from local
    if (globalDtsExists) {
      const globalDtsContent = fs.readFileSync(GLOBAL_PROVIDER_TYPES_DTS(), 'utf-8');
      let shouldCopyDts = true;

      if (fs.existsSync(localDtsPath)) {
        const localDtsContent = fs.readFileSync(localDtsPath, 'utf-8');
        shouldCopyDts = globalDtsContent !== localDtsContent;
      }

      if (shouldCopyDts) {
        fs.writeFileSync(localDtsPath, globalDtsContent, 'utf-8');
      }
    }
  } catch (error) {
    // Silent fail - fall back to existing files
    console.warn('Failed to sync global cache to local:', error);
  }
}

function getLastRefreshTimeFromDisk(): Date | null {
  try {
    if (!fs.existsSync(CACHE_FILE())) {
      return null;
    }
    const timestamp = fs.readFileSync(CACHE_FILE(), 'utf-8').trim();
    return new Date(parseInt(timestamp, 10));
  } catch (err) {
    console.warn('[GatewayRegistry] Failed to read cache file:', err);
    modelRouterCacheFailed = true;
    return null;
  }
}

function saveLastRefreshTimeToDisk(date: Date): void {
  try {
    if (!fs.existsSync(CACHE_DIR())) {
      fs.mkdirSync(CACHE_DIR(), { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE(), date.getTime().toString(), 'utf-8');
  } catch (err) {
    modelRouterCacheFailed = true;
    console.warn('[GatewayRegistry] Failed to write cache file:', err);
  }
}

function getPackageRoot(): string {
  try {
    // Use require.resolve to find the package root reliably
    const require = createRequire(import.meta.url || 'file://');
    const packageJsonPath = require.resolve('@mastra/core/package.json');
    return path.dirname(packageJsonPath);
  } catch {
    // Fallback to cwd if we can't resolve the package
    return process.cwd();
  }
}

function loadRegistry(useDynamicLoading: boolean): RegistryData {
  // Production: use static import (bundled at build time)
  if (!useDynamicLoading) {
    return staticRegistry;
  }

  // Dynamic loading mode: sync global cache to local before loading
  syncGlobalCacheToLocal();

  // Dynamic loading mode: check in-memory cache first
  if (registryData) {
    return registryData;
  }

  // Dynamic loading mode: load from file system for live updates
  const packageRoot = getPackageRoot();
  const possiblePaths: string[] = [
    // Built: in dist/ relative to package root (first priority - what gets distributed)
    path.join(packageRoot, 'dist', 'provider-registry.json'),
    // Development: in src/ relative to package root
    path.join(packageRoot, 'src', 'llm', 'model', 'provider-registry.json'),
    // Fallback: relative to cwd (for monorepo setups)
    path.join(process.cwd(), 'packages/core/src/llm/model/provider-registry.json'),
    path.join(process.cwd(), 'src/llm/model/provider-registry.json'),
  ];

  const errors: string[] = [];

  for (const jsonPath of possiblePaths) {
    try {
      const content = fs.readFileSync(jsonPath, 'utf-8');
      registryData = JSON.parse(content);
      return registryData!;
    } catch (err) {
      errors.push(`${jsonPath}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
  }

  throw new Error(
    `Failed to load provider registry with dynamic loading. Make sure provider-registry.json is generated by running: npm run generate:providers

Tried paths:
${errors.join('\n')}`,
  );
}

// Export registry data via Proxy for lazy loading
export const PROVIDER_REGISTRY = new Proxy({} as Record<string, ProviderConfig>, {
  get(_target, prop: string) {
    const registry = GatewayRegistry.getInstance();
    const providers = registry.getProviders();
    return providers[prop];
  },
  ownKeys() {
    const registry = GatewayRegistry.getInstance();
    const providers = registry.getProviders();
    return Object.keys(providers);
  },
  has(_target, prop: string) {
    const registry = GatewayRegistry.getInstance();
    const providers = registry.getProviders();
    return prop in providers;
  },
  getOwnPropertyDescriptor(_target, prop) {
    const registry = GatewayRegistry.getInstance();
    const providers = registry.getProviders();
    if (prop in providers) {
      return {
        enumerable: true,
        configurable: true,
      };
    }
    return undefined;
  },
}) as Record<Provider, ProviderConfig>;

export const PROVIDER_MODELS = new Proxy({} as ProviderModels, {
  get(_target, prop: string) {
    const registry = GatewayRegistry.getInstance();
    const models = registry.getModels();
    return models[prop];
  },
  ownKeys() {
    const registry = GatewayRegistry.getInstance();
    const models = registry.getModels();
    return Object.keys(models);
  },
  has(_target, prop: string) {
    const registry = GatewayRegistry.getInstance();
    const models = registry.getModels();
    return prop in models;
  },
  getOwnPropertyDescriptor(_target, prop) {
    const registry = GatewayRegistry.getInstance();
    const models = registry.getModels();
    if (prop in models) {
      return {
        enumerable: true,
        configurable: true,
      };
    }
    return undefined;
  },
});

/**
 * Parse a model string to extract provider and model ID
 * Examples:
 *   "openai/gpt-4o" -> { provider: "openai", modelId: "gpt-4o" }
 *   "fireworks/accounts/etc/model" -> { provider: "fireworks", modelId: "accounts/etc/model" }
 *   "gpt-4o" -> { provider: null, modelId: "gpt-4o" }
 */
export function parseModelString(modelString: string): { provider: string | null; modelId: string } {
  const firstSlashIndex = modelString.indexOf('/');

  if (firstSlashIndex !== -1) {
    // Has at least one slash - extract everything before first slash as provider
    const provider = modelString.substring(0, firstSlashIndex);
    const modelId = modelString.substring(firstSlashIndex + 1);

    if (provider && modelId) {
      return {
        provider,
        modelId,
      };
    }
  }

  // No slash or invalid format
  return {
    provider: null,
    modelId: modelString,
  };
}

/**
 * Get provider configuration by provider ID
 */
export function getProviderConfig(providerId: string): ProviderConfig | undefined {
  const registry = GatewayRegistry.getInstance();
  return registry.getProviderConfig(providerId);
}

/**
 * Check if a provider is registered
 */
export function isProviderRegistered(providerId: string): boolean {
  const registry = GatewayRegistry.getInstance();
  return registry.isProviderRegistered(providerId);
}

/**
 * Get all registered provider IDs
 */
export function getRegisteredProviders(): string[] {
  const registry = GatewayRegistry.getInstance();
  const providers = registry.getProviders();
  return Object.keys(providers);
}

/**
 * Type guard to check if a string is a valid OpenAI-compatible model ID
 */
export function isValidModelId(modelId: string): modelId is ModelRouterModelId {
  const { provider } = parseModelString(modelId);
  return provider !== null && isProviderRegistered(provider);
}

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
export class GatewayRegistry {
  private static instance: GatewayRegistry | null = null;
  private lastRefreshTime: Date | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;
  private isRefreshing = false;
  private useDynamicLoading: boolean;
  private customGateways: MastraModelGateway[] = [];

  private constructor(options: GatewayRegistryOptions = {}) {
    const isDev = process.env.MASTRA_DEV === 'true' || process.env.MASTRA_DEV === '1';
    this.useDynamicLoading = options.useDynamicLoading ?? isDev;
  }

  /**
   * Get the singleton instance
   */
  static getInstance(options?: GatewayRegistryOptions): GatewayRegistry {
    if (!GatewayRegistry.instance) {
      GatewayRegistry.instance = new GatewayRegistry(options);
    }
    return GatewayRegistry.instance;
  }

  /**
   * Register custom gateways for type generation
   * @param gateways - Array of custom gateway instances
   */
  registerCustomGateways(gateways: MastraModelGateway[]): void {
    this.customGateways = gateways;
  }

  /**
   * Get all registered custom gateways
   */
  getCustomGateways(): MastraModelGateway[] {
    return this.customGateways;
  }

  /**
   * Sync providers from all gateways
   * Requires dynamic loading to be enabled (useDynamicLoading=true).
   * @param forceRefresh - Force refresh even if recently synced
   * @param writeToSrc - Write to src/ directory in addition to dist/ (useful for manual generation in repo)
   */
  async syncGateways(forceRefresh = false, writeToSrc = false): Promise<void> {
    // Only allow sync when dynamic loading is enabled or when explicitly writing to src (build script)
    if (!this.useDynamicLoading && !writeToSrc) {
      // console.debug('[GatewayRegistry] Skipping sync (dynamic loading disabled, registry is static)');
      return;
    }

    if (this.isRefreshing && !forceRefresh) {
      // console.debug('[GatewayRegistry] Sync already in progress, skipping...');
      return;
    }

    this.isRefreshing = true;

    try {
      // console.debug('[GatewayRegistry] Starting gateway sync...');

      // Import gateway classes and generation functions
      const { ModelsDevGateway } = await import('./gateways/models-dev.js');
      const { NetlifyGateway } = await import('./gateways/netlify.js');
      const { fetchProvidersFromGateways, writeRegistryFiles } = await import('./registry-generator.js');

      // Initialize default gateways
      const defaultGateways = [new ModelsDevGateway({}), new NetlifyGateway()];

      // Combine default and custom gateways
      const gateways = [...defaultGateways, ...this.customGateways];

      // Fetch provider data
      const { providers, models } = await fetchProvidersFromGateways(gateways);

      // Get package root for file paths
      const packageRoot = getPackageRoot();

      // Write to global cache first (so all projects can benefit)
      try {
        fs.mkdirSync(CACHE_DIR(), { recursive: true });
        await writeRegistryFiles(GLOBAL_PROVIDER_REGISTRY_JSON(), GLOBAL_PROVIDER_TYPES_DTS(), providers, models);
        // console.debug(`[GatewayRegistry] ✅ Updated global cache at ${CACHE_DIR()}`);
      } catch (error) {
        console.warn('[GatewayRegistry] Failed to write to global cache:', error);
      }

      // Write to dist/ (the bundled location that gets distributed)
      const distJsonPath = path.join(packageRoot, 'dist', 'provider-registry.json');
      const distTypesPath = path.join(packageRoot, 'dist', 'llm', 'model', 'provider-types.generated.d.ts');

      await writeRegistryFiles(distJsonPath, distTypesPath, providers, models);
      // console.debug(`[GatewayRegistry] ✅ Updated registry files in dist/`);

      // Copy to src/ only when explicitly requested (e.g., running the generation script)
      const shouldWriteToSrc = writeToSrc;
      if (shouldWriteToSrc) {
        const srcJsonPath = path.join(packageRoot, 'src', 'llm', 'model', 'provider-registry.json');
        const srcTypesPath = path.join(packageRoot, 'src', 'llm', 'model', 'provider-types.generated.d.ts');

        // Copy the already-generated files
        await fs.promises.copyFile(distJsonPath, srcJsonPath);
        await fs.promises.copyFile(distTypesPath, srcTypesPath);
        // console.debug(`[GatewayRegistry] ✅ Copied registry files to src/ (${writeToSrc ? 'manual' : 'dynamic loading'})`);
      }

      // Clear the in-memory cache to force reload (dynamic loading only)
      if (this.useDynamicLoading) {
        registryData = null;
      }

      this.lastRefreshTime = new Date();
      saveLastRefreshTimeToDisk(this.lastRefreshTime);
      // console.debug(`[GatewayRegistry] ✅ Gateway sync completed at ${this.lastRefreshTime.toISOString()}`);
    } catch (error) {
      console.error('[GatewayRegistry] ❌ Gateway sync failed:', error);
      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Get the last refresh time (from memory or disk cache)
   */
  getLastRefreshTime(): Date | null {
    return this.lastRefreshTime || getLastRefreshTimeFromDisk();
  }

  /**
   * Start auto-refresh on an interval
   * Requires dynamic loading to be enabled (useDynamicLoading=true).
   * @param intervalMs - Interval in milliseconds (default: 1 hour)
   */
  startAutoRefresh(intervalMs = 60 * 60 * 1000): void {
    // Only allow auto-refresh when dynamic loading is enabled
    if (!this.useDynamicLoading) {
      // console.debug('[GatewayRegistry] Skipping auto-refresh (dynamic loading disabled, registry is static)');
      return;
    }

    if (this.refreshInterval) {
      // console.debug('[GatewayRegistry] Auto-refresh already running');
      return;
    }

    // console.debug(`[GatewayRegistry] Starting auto-refresh (interval: ${intervalMs}ms)`);

    // Check if we need to run an immediate sync
    const lastRefresh = getLastRefreshTimeFromDisk();
    const now = Date.now();
    const shouldRefresh = !modelRouterCacheFailed && (!lastRefresh || now - lastRefresh.getTime() > intervalMs);

    if (shouldRefresh) {
      // console.debug(
      //   `[GatewayRegistry] Running immediate sync (last refresh: ${lastRefresh ? lastRefresh.toISOString() : 'never'})`,
      // );
      this.syncGateways().catch(err => {
        console.error('[GatewayRegistry] Initial auto-refresh failed:', err);
      });
    } else {
      // console.debug( `[GatewayRegistry] Skipping immediate sync (last refresh: ${lastRefresh.toISOString()}, next in ${Math.round((intervalMs - (now - lastRefresh.getTime())) / 1000)}s)`,
      // );
    }

    this.refreshInterval = setInterval(() => {
      if (modelRouterCacheFailed && this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = null;
        return;
      }
      this.syncGateways().catch(err => {
        console.error('[GatewayRegistry] Auto-refresh failed:', err);
      });
    }, intervalMs);

    // Prevent the interval from keeping the process alive
    if (this.refreshInterval.unref) {
      this.refreshInterval.unref();
    }
  }

  /**
   * Stop auto-refresh
   */
  stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      // console.debug('[GatewayRegistry] Auto-refresh stopped');
    }
  }

  /**
   * Get provider configuration by ID
   */
  getProviderConfig(providerId: string): ProviderConfig | undefined {
    const data = loadRegistry(this.useDynamicLoading);
    return data.providers[providerId];
  }

  /**
   * Check if a provider is registered
   */
  isProviderRegistered(providerId: string): boolean {
    const data = loadRegistry(this.useDynamicLoading);
    return providerId in data.providers;
  }

  /**
   * Get all registered providers
   */
  getProviders(): Record<string, ProviderConfig> {
    const data = loadRegistry(this.useDynamicLoading);
    return data.providers;
  }

  /**
   * Get all models
   */
  getModels(): Record<string, string[]> {
    return loadRegistry(this.useDynamicLoading).models;
  }
}

// Auto-start refresh if enabled
// Defaults to enabled when MASTRA_DEV=true (which enables dynamic loading by default)
const isDev = process.env.MASTRA_DEV === 'true' || process.env.MASTRA_DEV === '1';
const autoRefreshEnabled =
  process.env.MASTRA_AUTO_REFRESH_PROVIDERS === 'true' ||
  (process.env.MASTRA_AUTO_REFRESH_PROVIDERS !== 'false' && isDev);

if (autoRefreshEnabled) {
  // console.debug('[GatewayRegistry] Auto-refresh enabled');
  GatewayRegistry.getInstance({ useDynamicLoading: isDev }).startAutoRefresh();
}
