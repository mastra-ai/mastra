import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ModelRegistry } from './provider-registry.js';

describe('ModelRegistry Auto-Refresh', () => {
  const CACHE_DIR = path.join(os.homedir(), '.cache', 'mastra');
  const CACHE_FILE = path.join(CACHE_DIR, 'gateway-refresh-time');
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };

    // Clean up cache file before each test
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
    }

    // Reset the singleton instance
    // @ts-expect-error - accessing private property for testing
    ModelRegistry['instance'] = undefined;
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;

    // Stop any running intervals
    const registry = ModelRegistry.getInstance();
    registry.stopAutoRefresh();

    // Clean up cache file
    try {
      if (fs.existsSync(CACHE_FILE)) {
        fs.unlinkSync(CACHE_FILE);
      }
    } catch {
      // Ignore errors during cleanup
    }

    // Restore all mocks
    vi.restoreAllMocks();
  });

  it('should create cache file on first sync', async () => {
    const registry = ModelRegistry.getInstance();

    expect(fs.existsSync(CACHE_FILE)).toBe(false);

    await registry.syncGateways();

    expect(fs.existsSync(CACHE_FILE)).toBe(true);

    const timestamp = fs.readFileSync(CACHE_FILE, 'utf-8').trim();
    const cacheTime = new Date(parseInt(timestamp, 10));

    expect(cacheTime.getTime()).toBeGreaterThan(Date.now() - 5000); // Within last 5 seconds
    expect(cacheTime.getTime()).toBeLessThanOrEqual(Date.now());
  }, 60000);

  it('should read last refresh time from disk cache', async () => {
    const registry = ModelRegistry.getInstance();

    // Manually create cache file with a known timestamp
    const testTime = new Date('2024-01-01T12:00:00Z');
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, testTime.getTime().toString(), 'utf-8');

    const lastRefresh = registry.getLastRefreshTime();

    expect(lastRefresh).not.toBeNull();
    expect(lastRefresh?.getTime()).toBe(testTime.getTime());
  });

  it('should skip immediate sync if cache is fresh (< 1 hour)', async () => {
    // Create a fresh cache (just now)
    const now = new Date();
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, now.getTime().toString(), 'utf-8');

    const registry = ModelRegistry.getInstance();

    // Spy on syncGateways
    const syncSpy = vi.spyOn(registry, 'syncGateways');

    // Start auto-refresh with a short interval for testing
    registry.startAutoRefresh(100); // 100ms interval

    // Wait a bit to ensure no immediate sync happens
    await new Promise(resolve => setTimeout(resolve, 50));

    // syncGateways should not have been called (cache is fresh)
    expect(syncSpy).not.toHaveBeenCalled();

    registry.stopAutoRefresh();
  });

  it('should run immediate sync if cache is stale (> 1 hour)', async () => {
    // Create a stale cache (2 hours ago)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, twoHoursAgo.getTime().toString(), 'utf-8');

    const registry = ModelRegistry.getInstance();

    // Mock syncGateways to avoid actual network calls
    const syncSpy = vi.spyOn(registry, 'syncGateways').mockResolvedValue(undefined);

    // Start auto-refresh
    registry.startAutoRefresh(100); // 100ms interval

    // Wait for the immediate sync to complete
    await new Promise(resolve => setTimeout(resolve, 50));

    // syncGateways should have been called at least once immediately (cache is stale)
    expect(syncSpy.mock.calls.length).toBeGreaterThanOrEqual(1);

    registry.stopAutoRefresh();
  });

  it('should run immediate sync if cache file does not exist', async () => {
    expect(fs.existsSync(CACHE_FILE)).toBe(false);

    const registry = ModelRegistry.getInstance();

    // Mock syncGateways to avoid actual network calls
    const syncSpy = vi.spyOn(registry, 'syncGateways').mockResolvedValue(undefined);

    // Start auto-refresh
    registry.startAutoRefresh(100); // 100ms interval

    // Wait for the immediate sync to complete
    await new Promise(resolve => setTimeout(resolve, 50));

    // syncGateways should have been called at least once immediately (no cache)
    expect(syncSpy.mock.calls.length).toBeGreaterThanOrEqual(1);

    registry.stopAutoRefresh();
  });

  it('should auto-refresh on interval', async () => {
    const registry = ModelRegistry.getInstance();

    // Mock syncGateways to avoid actual network calls
    const syncSpy = vi.spyOn(registry, 'syncGateways').mockResolvedValue(undefined);

    // Start auto-refresh with a very short interval (200ms)
    registry.startAutoRefresh(200);

    // Wait for multiple intervals
    await new Promise(resolve => setTimeout(resolve, 650));

    // Should have been called at least 3 times (immediate + 2 intervals)
    expect(syncSpy.mock.calls.length).toBeGreaterThanOrEqual(3);

    registry.stopAutoRefresh();
  });

  it('should enable auto-refresh by default when MASTRA_DEV=true', () => {
    process.env.MASTRA_DEV = 'true';

    const registry = ModelRegistry.getInstance();

    // Mock syncGateways to avoid actual network calls
    vi.spyOn(registry, 'syncGateways').mockResolvedValue(undefined);

    // Auto-refresh should start automatically
    // We can't directly check if it's running, but we can verify the interval is set
    // @ts-expect-error - accessing private property for testing
    expect(registry.refreshInterval).toBeDefined();

    registry.stopAutoRefresh();
    delete process.env.MASTRA_DEV;
  });

  it('should not enable auto-refresh by default when MASTRA_DEV is not set', () => {
    delete process.env.MASTRA_DEV;
    delete process.env.MASTRA_AUTO_REFRESH_PROVIDERS;

    // Reset singleton to pick up new env
    // @ts-expect-error - accessing private property for testing
    ModelRegistry['instance'] = undefined;

    const registry = ModelRegistry.getInstance();

    // Auto-refresh should NOT start automatically
    // @ts-expect-error - accessing private property for testing
    expect(registry.refreshInterval).toBeNull();
  });

  it('should respect MASTRA_AUTO_REFRESH_PROVIDERS=true override', () => {
    delete process.env.MASTRA_DEV;
    process.env.MASTRA_AUTO_REFRESH_PROVIDERS = 'true';

    // Reset singleton to pick up new env
    // @ts-expect-error - accessing private property for testing
    ModelRegistry['instance'] = undefined;

    const registry = ModelRegistry.getInstance();

    // Mock syncGateways to avoid actual network calls
    vi.spyOn(registry, 'syncGateways').mockResolvedValue(undefined);

    // Auto-refresh should start (explicit override)
    // @ts-expect-error - accessing private property for testing
    expect(registry.refreshInterval).toBeDefined();

    registry.stopAutoRefresh();
  });

  it('should respect MASTRA_AUTO_REFRESH_PROVIDERS=false override', () => {
    process.env.MASTRA_DEV = 'true';
    process.env.MASTRA_AUTO_REFRESH_PROVIDERS = 'false';

    // Reset singleton to pick up new env
    // @ts-expect-error - accessing private property for testing
    ModelRegistry['instance'] = undefined;

    const registry = ModelRegistry.getInstance();

    // Auto-refresh should NOT start (explicit override)
    // @ts-expect-error - accessing private property for testing
    expect(registry.refreshInterval).toBeNull();
  });

  it('should stop auto-refresh if cache operations fail', async () => {
    // This test verifies that auto-refresh stops when cache operations fail persistently

    const registry = ModelRegistry.getInstance();

    // Stop any existing auto-refresh
    registry.stopAutoRefresh();

    // Clear any existing cache file
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
    }

    // Mock fs operations to fail for cache file operations
    const originalExistsSync = fs.existsSync;
    const originalReadFileSync = fs.readFileSync;
    const originalWriteFileSync = fs.writeFileSync;

    // Track cache operation attempts
    let readAttempts = 0;

    fs.existsSync = vi.fn().mockImplementation(path => {
      if (typeof path === 'string' && path.includes('gateway-refresh-time')) {
        // Pretend the cache file exists so it tries to read it
        return true;
      }
      return originalExistsSync(path);
    });

    fs.readFileSync = vi.fn().mockImplementation((path, encoding) => {
      if (typeof path === 'string' && path.includes('gateway-refresh-time')) {
        readAttempts++;
        // Always fail reading cache
        throw new Error('Permission denied - read');
      }
      return originalReadFileSync(path, encoding);
    });

    fs.writeFileSync = vi.fn().mockImplementation((path, data, encoding) => {
      if (typeof path === 'string' && path.includes('gateway-refresh-time')) {
        // Always fail writing cache
        throw new Error('Permission denied - write');
      }
      return originalWriteFileSync(path, data, encoding);
    });

    // Start auto-refresh with a short interval
    // This will trigger getLastRefreshTimeFromDisk which will fail and set modelRouterCacheFailed = true
    registry.startAutoRefresh(100);

    // The read failure should happen immediately during startAutoRefresh
    expect(readAttempts).toBeGreaterThan(0);

    // Wait for the first interval tick
    await new Promise(resolve => setTimeout(resolve, 150));

    // The interval should have been cleared on the first tick due to modelRouterCacheFailed being true
    // @ts-expect-error - accessing private property for testing
    expect(registry.refreshInterval).toBeNull();

    // Restore original functions
    fs.existsSync = originalExistsSync;
    fs.readFileSync = originalReadFileSync;
    fs.writeFileSync = originalWriteFileSync;

    // Clean up
    registry.stopAutoRefresh();
  });

  it('should update registry files when provider models change', async () => {
    // This test verifies that .d.ts and .json files are correctly updated when gateway data changes

    const registry = ModelRegistry.getInstance();

    // Stop any existing auto-refresh
    registry.stopAutoRefresh();

    // Create a temp directory for test files
    const tempDir = path.join(os.tmpdir(), 'mastra-registry-test-' + Date.now());
    const tempJsonPath = path.join(tempDir, 'provider-registry.json');
    const tempTypesPath = path.join(tempDir, 'provider-types.generated.d.ts');

    // Ensure temp directory exists
    fs.mkdirSync(tempDir, { recursive: true });

    // Mock the gateways to return controlled data
    const { ModelsDevGateway } = await import('./gateways/models-dev.js');
    const { NetlifyGateway } = await import('./gateways/netlify.js');

    // Save original methods
    const originalModelsDevFetch = ModelsDevGateway.prototype.fetchProviders;
    const originalNetlifyFetch = NetlifyGateway.prototype.fetchProviders;

    let modelsDevCallCount = 0;
    ModelsDevGateway.prototype.fetchProviders = vi.fn(async function () {
      modelsDevCallCount++;
      if (modelsDevCallCount === 1) {
        return {
          'test-provider': {
            id: 'test-provider',
            name: 'Test Provider',
            baseURL: 'https://test.com/v1',
            apiKeySource: 'TEST_API_KEY',
            models: ['model-a', 'model-b'],
            supportsStreaming: true,
            supportsToolCalls: true,
            supportsSystemMessages: true,
            supportsObjectGeneration: false,
          },
        };
      } else {
        // Second call - add a new model and a new provider
        return {
          'test-provider': {
            id: 'test-provider',
            name: 'Test Provider',
            baseURL: 'https://test.com/v1',
            apiKeySource: 'TEST_API_KEY',
            models: ['model-a', 'model-b', 'model-c'], // Added model-c
            supportsStreaming: true,
            supportsToolCalls: true,
            supportsSystemMessages: true,
            supportsObjectGeneration: false,
          },
          'new-provider': {
            id: 'new-provider',
            name: 'New Provider',
            baseURL: 'https://new.com/v1',
            apiKeySource: 'NEW_API_KEY',
            models: ['new-model-1', 'new-model-2'],
            supportsStreaming: false,
            supportsToolCalls: false,
            supportsSystemMessages: true,
            supportsObjectGeneration: true,
          },
        };
      }
    });

    // Mock Netlify to return empty
    NetlifyGateway.prototype.fetchProviders = vi.fn(async function () {
      return {};
    });

    // Mock both fs.writeFileSync and fs.promises.writeFile to intercept writes
    const originalWriteFileSync = fs.writeFileSync;
    const originalWriteFile = fs.promises.writeFile;

    // Mock sync version for cache files
    fs.writeFileSync = vi.fn().mockImplementation((filePath, data, encoding) => {
      // Let cache writes go through normally
      return originalWriteFileSync(filePath, data, encoding);
    });

    // Mock async version for registry files
    fs.promises.writeFile = vi.fn().mockImplementation(async (filePath, data, encoding) => {
      if (typeof filePath === 'string') {
        if (filePath.includes('provider-registry.json')) {
          // Redirect to temp JSON file
          return originalWriteFile(tempJsonPath, data, encoding);
        } else if (filePath.includes('provider-types.generated.d.ts')) {
          // Redirect to temp types file
          return originalWriteFile(tempTypesPath, data, encoding);
        }
      }
      // Let other writes go through normally
      return originalWriteFile(filePath, data, encoding);
    });

    // First sync
    await registry.syncGateways(true);

    // Read and verify first generation
    const firstJson = JSON.parse(fs.readFileSync(tempJsonPath, 'utf-8'));
    expect(firstJson.providers['test-provider']).toBeDefined();
    expect(firstJson.providers['new-provider']).toBeUndefined();
    expect(firstJson.models['test-provider']).toEqual(['model-a', 'model-b']);

    const firstTypes = fs.readFileSync(tempTypesPath, 'utf-8');
    expect(firstTypes).toContain("'test-provider': readonly ['model-a', 'model-b']");
    expect(firstTypes).not.toContain('new-provider');
    expect(firstTypes).toContain('export type Provider = keyof ProviderModelsMap');

    // Second sync with updated data
    await registry.syncGateways(true);

    // Read and verify second generation
    const secondJson = JSON.parse(fs.readFileSync(tempJsonPath, 'utf-8'));
    expect(secondJson.providers['test-provider']).toBeDefined();
    expect(secondJson.providers['new-provider']).toBeDefined();
    expect(secondJson.models['test-provider']).toEqual(['model-a', 'model-b', 'model-c']);
    expect(secondJson.models['new-provider']).toEqual(['new-model-1', 'new-model-2']);

    const secondTypes = fs.readFileSync(tempTypesPath, 'utf-8');
    expect(secondTypes).toContain("'test-provider': readonly ['model-a', 'model-b', 'model-c']");
    expect(secondTypes).toContain("'new-provider': readonly ['new-model-1', 'new-model-2']");
    expect(secondTypes).toContain('export type Provider = keyof ProviderModelsMap');

    // Verify the ModelRouterModelId type definition exists (it's a template literal type)
    expect(secondTypes).toContain('export type ModelRouterModelId');
    expect(secondTypes).toContain('ProviderModelsMap[P][number]');

    // Restore original functions
    ModelsDevGateway.prototype.fetchProviders = originalModelsDevFetch;
    NetlifyGateway.prototype.fetchProviders = originalNetlifyFetch;
    fs.writeFileSync = originalWriteFileSync;

    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
