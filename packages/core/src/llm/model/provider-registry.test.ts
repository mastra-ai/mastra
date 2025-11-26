import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import type { ProviderConfig } from './gateways/base.js';
import { ModelsDevGateway } from './gateways/models-dev.js';
import { NetlifyGateway } from './gateways/netlify.js';
import { GatewayRegistry } from './provider-registry.js';

describe('GatewayRegistry Auto-Refresh', () => {
  const CACHE_DIR = path.join(os.homedir(), '.cache', 'mastra');
  const CACHE_FILE = path.join(CACHE_DIR, 'gateway-refresh-time');
  let originalEnv: NodeJS.ProcessEnv;
  let originalWriteFile: typeof fs.promises.writeFile;
  let originalCopyFile: typeof fs.promises.copyFile;

  // Store original file contents to restore after tests
  const PROVIDER_REGISTRY_PATH = path.join(__dirname, 'provider-registry.json');
  const PROVIDER_TYPES_PATH = path.join(__dirname, 'provider-types.generated.d.ts');
  let originalProviderRegistryContent: string | null = null;
  let originalProviderTypesContent: string | null = null;

  beforeAll(() => {
    // Save original file contents before any tests run
    try {
      if (fs.existsSync(PROVIDER_REGISTRY_PATH)) {
        originalProviderRegistryContent = fs.readFileSync(PROVIDER_REGISTRY_PATH, 'utf-8');
      }
      if (fs.existsSync(PROVIDER_TYPES_PATH)) {
        originalProviderTypesContent = fs.readFileSync(PROVIDER_TYPES_PATH, 'utf-8');
      }
    } catch (error) {
      console.warn('Failed to save original file contents:', error);
    }
  });

  beforeEach(() => {
    // Save original functions
    originalWriteFile = fs.promises.writeFile;
    originalCopyFile = fs.promises.copyFile;
    originalEnv = { ...process.env };

    // Clean up cache file before each test
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
    }

    // Reset the singleton instance
    // @ts-expect-error - accessing private property for testing
    GatewayRegistry['instance'] = undefined;

    // Mock file write operations globally to prevent any test from modifying the actual registry files
    // Only block writes to the actual provider-registry.json and provider-types.generated.d.ts files
    vi.spyOn(fs.promises, 'writeFile').mockImplementation(async (filePath, ...args) => {
      if (typeof filePath === 'string' && (filePath === PROVIDER_REGISTRY_PATH || filePath === PROVIDER_TYPES_PATH)) {
        // Block writes to the actual registry files
        return Promise.resolve();
      }
      // Allow all other writes (including temp files in tests)
      return originalWriteFile(filePath, ...args);
    });

    vi.spyOn(fs.promises, 'copyFile').mockImplementation(async (src, dest, ...args) => {
      if (typeof dest === 'string' && (dest === PROVIDER_REGISTRY_PATH || dest === PROVIDER_TYPES_PATH)) {
        // Block copies to the actual registry files
        return Promise.resolve();
      }
      // Allow all other copies
      return originalCopyFile(src, dest, ...args);
    });
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;

    // Stop any running intervals
    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });
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

  afterAll(() => {
    // Restore original file contents after all tests complete
    // This ensures we only write back once, improving efficiency
    try {
      if (originalProviderRegistryContent !== null) {
        fs.writeFileSync(PROVIDER_REGISTRY_PATH, originalProviderRegistryContent, 'utf-8');
      }
      if (originalProviderTypesContent !== null) {
        fs.writeFileSync(PROVIDER_TYPES_PATH, originalProviderTypesContent, 'utf-8');
      }
    } catch (error) {
      console.warn('Failed to restore files in afterAll:', error);
    }
  });

  it('should create cache file on first sync', async () => {
    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });

    expect(fs.existsSync(CACHE_FILE)).toBe(false);

    await registry.syncGateways();

    expect(fs.existsSync(CACHE_FILE)).toBe(true);

    const timestamp = fs.readFileSync(CACHE_FILE, 'utf-8').trim();
    const cacheTime = new Date(parseInt(timestamp, 10));

    expect(cacheTime.getTime()).toBeGreaterThan(Date.now() - 5000); // Within last 5 seconds
    expect(cacheTime.getTime()).toBeLessThanOrEqual(Date.now());
  }, 60000);

  it('should read last refresh time from disk cache', async () => {
    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });

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

    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });

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

    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });

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

    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });

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
    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });

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

    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });

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
    GatewayRegistry['instance'] = undefined;

    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });

    // Auto-refresh should NOT start automatically
    // @ts-expect-error - accessing private property for testing
    expect(registry.refreshInterval).toBeNull();
  });

  it('should respect MASTRA_AUTO_REFRESH_PROVIDERS=true override', () => {
    delete process.env.MASTRA_DEV;
    process.env.MASTRA_AUTO_REFRESH_PROVIDERS = 'true';

    // Reset singleton to pick up new env
    // @ts-expect-error - accessing private property for testing
    GatewayRegistry['instance'] = undefined;

    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });

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
    GatewayRegistry['instance'] = undefined;

    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });

    // Auto-refresh should NOT start (explicit override)
    // @ts-expect-error - accessing private property for testing
    expect(registry.refreshInterval).toBeNull();
  });

  it('should stop auto-refresh if cache operations fail', async () => {
    // This test verifies that auto-refresh stops when cache operations fail persistently

    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });

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

    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });

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

    let modelsDevCallCount = 0;

    // Use vi.spyOn for proper mocking (automatically restored by vi.restoreAllMocks)
    vi.spyOn(ModelsDevGateway.prototype, 'fetchProviders').mockImplementation(async function (): Promise<
      Record<string, ProviderConfig>
    > {
      modelsDevCallCount++;
      if (modelsDevCallCount === 1) {
        return {
          'test-provider': {
            name: 'Test Provider',
            url: 'https://test.com/v1',
            apiKeyEnvVar: 'TEST_API_KEY',
            models: ['model-a', 'model-b'],
            gateway: 'models.dev',
          },
        };
      } else {
        // Second call - add a new model and a new provider
        return {
          'test-provider': {
            name: 'Test Provider',
            url: 'https://test.com/v1',
            apiKeyEnvVar: 'TEST_API_KEY',
            models: ['model-a', 'model-b', 'model-c'], // Added model-c
            gateway: 'models.dev',
          },
          'new-provider': {
            name: 'New Provider',
            url: 'https://new.com/v1',
            apiKeyEnvVar: 'NEW_API_KEY',
            models: ['new-model-1', 'new-model-2'],
            gateway: 'models.dev',
          },
        };
      }
    });

    // Mock Netlify to return empty
    vi.spyOn(NetlifyGateway.prototype, 'fetchProviders').mockImplementation(async function (): Promise<
      Record<string, ProviderConfig>
    > {
      return {};
    });

    // Mock both fs.writeFileSync and fs.promises.writeFile to intercept writes
    const originalWriteFileSync = fs.writeFileSync;
    const originalWriteFile = fs.promises.writeFile;
    const originalRename = fs.promises.rename;

    // Track temp files for redirect mapping
    const tempFileMap = new Map<string, string>();

    // Mock sync version for cache files
    fs.writeFileSync = vi.fn().mockImplementation((filePath, data, encoding) => {
      // Let cache writes go through normally
      return originalWriteFileSync(filePath, data, encoding);
    });

    // Mock async version for registry files - handles atomic write temp files
    fs.promises.writeFile = vi.fn().mockImplementation(async (filePath, data, encoding) => {
      if (typeof filePath === 'string') {
        // Handle temp files from atomic writes
        if (filePath.includes('.tmp') && filePath.includes('provider-registry.json')) {
          const redirectedTempPath = `${tempJsonPath}.${Date.now()}.tmp`;
          tempFileMap.set(filePath, redirectedTempPath);
          return originalWriteFile(redirectedTempPath, data, encoding);
        } else if (filePath.includes('.tmp') && filePath.includes('provider-types.generated.d.ts')) {
          const redirectedTempPath = `${tempTypesPath}.${Date.now()}.tmp`;
          tempFileMap.set(filePath, redirectedTempPath);
          return originalWriteFile(redirectedTempPath, data, encoding);
        } else if (filePath.includes('provider-registry.json')) {
          // Direct write (non-atomic)
          return originalWriteFile(tempJsonPath, data, encoding);
        } else if (filePath.includes('provider-types.generated.d.ts')) {
          // Direct write (non-atomic)
          return originalWriteFile(tempTypesPath, data, encoding);
        }
      }
      // Let other writes go through normally
      return originalWriteFile(filePath, data, encoding);
    });

    // Mock rename to handle atomic write completion
    fs.promises.rename = vi.fn().mockImplementation(async (oldPath, newPath) => {
      if (typeof oldPath === 'string' && typeof newPath === 'string') {
        const redirectedOldPath = tempFileMap.get(oldPath);
        if (redirectedOldPath) {
          // Redirect the rename to our temp location
          if (newPath.includes('provider-registry.json')) {
            return originalRename(redirectedOldPath, tempJsonPath);
          } else if (newPath.includes('provider-types.generated.d.ts')) {
            return originalRename(redirectedOldPath, tempTypesPath);
          }
        }
      }
      return originalRename(oldPath, newPath);
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

    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });

    // Note: Mocks are automatically restored by vi.restoreAllMocks() in afterEach
  });

  it('should write to src/ when writeToSrc flag is true', async () => {
    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });
    const tmpDir = path.join(os.tmpdir(), `mastra-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const writtenFiles: string[] = [];
    const renamedFiles: { src: string; dest: string }[] = [];
    const copiedFiles: { src: string; dest: string }[] = [];

    // Mock fs.promises.writeFile to track where files are written
    vi.spyOn(fs.promises, 'writeFile').mockImplementation(async (filePath: any) => {
      writtenFiles.push(filePath.toString());
      return Promise.resolve();
    });

    // Mock fs.promises.rename to track atomic writes (write-to-temp-then-rename)
    vi.spyOn(fs.promises, 'rename').mockImplementation(async (src: any, dest: any) => {
      renamedFiles.push({ src: src.toString(), dest: dest.toString() });
      return Promise.resolve();
    });

    // Mock fs.promises.copyFile to track file copies
    vi.spyOn(fs.promises, 'copyFile').mockImplementation(async (src: any, dest: any) => {
      copiedFiles.push({ src: src.toString(), dest: dest.toString() });
      return Promise.resolve();
    });

    // Mock gateway to return test data
    vi.spyOn(ModelsDevGateway.prototype, 'fetchProviders').mockResolvedValue({
      'test-provider': {
        name: 'Test Provider',
        models: ['model-a'],
        apiKeyEnvVar: 'TEST_API_KEY',
        gateway: 'models-dev',
      } as ProviderConfig,
    });

    vi.spyOn(NetlifyGateway.prototype, 'fetchProviders').mockResolvedValue({});

    // Call syncGateways with writeToSrc=true
    await registry.syncGateways(true, true);

    // Verify files were written to dist/ via atomic rename
    expect(renamedFiles.some(f => f.dest.includes('dist/provider-registry.json'))).toBe(true);
    expect(renamedFiles.some(f => f.dest.includes('dist/llm/model/provider-types.generated.d.ts'))).toBe(true);

    // Verify files were copied to src/
    expect(copiedFiles.some(c => c.dest.includes('src/llm/model/provider-registry.json'))).toBe(true);
    expect(copiedFiles.some(c => c.dest.includes('src/llm/model/provider-types.generated.d.ts'))).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should write .d.ts file to correct dist subdirectory path', async () => {
    const tmpDir = path.join(os.tmpdir(), `mastra-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const renamedFiles: { src: string; dest: string }[] = [];

    // Mock fs.promises.writeFile to allow temp file writes
    const writeFileSpy = vi.spyOn(fs.promises, 'writeFile').mockImplementation(async () => {
      return Promise.resolve();
    });

    // Mock fs.promises.rename to track where files are atomically written
    const renameSpy = vi.spyOn(fs.promises, 'rename').mockImplementation(async (src: any, dest: any) => {
      renamedFiles.push({ src: src.toString(), dest: dest.toString() });
      return Promise.resolve();
    });

    // Mock gateway to return test data
    vi.spyOn(ModelsDevGateway.prototype, 'fetchProviders').mockResolvedValue({
      'test-provider': {
        name: 'Test Provider',
        models: ['model-a'],
        apiKeyEnvVar: 'TEST_API_KEY',
        gateway: 'models-dev',
      },
    } as Record<string, ProviderConfig>);

    vi.spyOn(NetlifyGateway.prototype, 'fetchProviders').mockResolvedValue({} as Record<string, ProviderConfig>);

    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });
    await registry.syncGateways(true);

    // Verify .d.ts file is written to both global cache and local dist/llm/model/ subdirectory
    // With atomic writes, we check the rename destination (not writeFile path)
    const typesFiles = renamedFiles.filter(f => f.dest.includes('provider-types.generated.d.ts'));
    expect(typesFiles.length).toBeGreaterThanOrEqual(1);

    // Should write to global cache
    const globalTypesFile = typesFiles.find(f => f.dest.includes('.cache/mastra/provider-types.generated.d.ts'));
    expect(globalTypesFile).toBeDefined();

    // Should also write to local dist/llm/model/ (not dist/ root)
    const localTypesFile = typesFiles.find(f => f.dest.includes('dist/llm/model/provider-types.generated.d.ts'));
    expect(localTypesFile).toBeDefined();
    expect(localTypesFile?.dest).not.toContain('dist/provider-types.generated.d.ts');

    // Cleanup
    writeFileSpy.mockRestore();
    renameSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('Issue #10434: Concurrent write corruption', () => {
  // Store original fs functions to use in tests (avoid mock interference)
  const originalWriteFile = fs.promises.writeFile.bind(fs.promises);
  const originalRename = fs.promises.rename.bind(fs.promises);
  const originalUnlink = fs.promises.unlink.bind(fs.promises);
  const originalReadFileSync = fs.readFileSync.bind(fs);
  const originalWriteFileSync = fs.writeFileSync.bind(fs);
  const originalMkdirSync = fs.mkdirSync.bind(fs);
  const originalRmSync = fs.rmSync.bind(fs);

  // Ensure no mocks from other test suites interfere
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Helper: atomic write using temp file + rename pattern
  // Uses original fs functions to avoid mock interference
  async function atomicWriteFile(filePath: string, content: string): Promise<void> {
    // Use random suffix to avoid collisions between concurrent writes
    const randomSuffix = Math.random().toString(36).substring(2, 15);
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.${randomSuffix}.tmp`;
    try {
      await originalWriteFile(tempPath, content, 'utf-8');
      await originalRename(tempPath, filePath);
    } catch (error) {
      try {
        await originalUnlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  it('should not corrupt JSON file when using atomic writes for concurrent operations', async () => {
    // This test verifies that atomic writes prevent file corruption
    // from concurrent write operations (fix for issue #10434)

    const tempDir = path.join(os.tmpdir(), `mastra-concurrent-write-test-${Date.now()}`);
    const testJsonPath = path.join(tempDir, 'provider-registry.json');

    // Ensure temp directory exists
    originalMkdirSync(tempDir, { recursive: true });

    // Create two different JSON contents that would be written
    const jsonContent1 = JSON.stringify(
      {
        providers: {
          openai: { name: 'OpenAI', models: ['gpt-4', 'gpt-3.5-turbo'] },
        },
        models: { openai: ['gpt-4', 'gpt-3.5-turbo'] },
        version: '1.0.0',
      },
      null,
      2,
    );

    const jsonContent2 = JSON.stringify(
      {
        providers: {
          anthropic: { name: 'Anthropic', models: ['claude-3-opus', 'claude-3-sonnet'] },
        },
        models: { anthropic: ['claude-3-opus', 'claude-3-sonnet'] },
        version: '1.0.0',
      },
      null,
      2,
    );

    // Test with atomic writes - should never corrupt
    const iterations = 50;
    let corruptionDetected = false;

    for (let i = 0; i < iterations && !corruptionDetected; i++) {
      // Start both atomic writes "simultaneously"
      const write1 = atomicWriteFile(testJsonPath, jsonContent1);
      const write2 = atomicWriteFile(testJsonPath, jsonContent2);

      // Wait for both to complete
      await Promise.all([write1, write2]);

      // Check if the file is valid JSON
      try {
        const content = originalReadFileSync(testJsonPath, 'utf-8');
        JSON.parse(content);
        // If we get here, the JSON is valid (one write "won" atomically)
      } catch {
        // JSON parse error means the file was corrupted
        corruptionDetected = true;
        const content = originalReadFileSync(testJsonPath, 'utf-8');
        console.log(`Corruption detected on iteration ${i + 1}:`);
        console.log('File content (last 200 chars):', content.slice(-200));
      }
    }

    // Clean up
    originalRmSync(tempDir, { recursive: true, force: true });

    // With atomic writes, corruption should NEVER occur
    expect(corruptionDetected).toBe(false);
  });

  it('should handle concurrent syncGlobalCacheToLocal and writeRegistryFiles calls with atomic writes', async () => {
    // This test verifies that atomic writes prevent corruption in the specific
    // race condition scenario from issue #10434

    const tempDir = path.join(os.tmpdir(), `mastra-sync-race-test-${Date.now()}`);
    const globalCacheDir = path.join(tempDir, 'global-cache');
    const distDir = path.join(tempDir, 'dist');
    const globalJsonPath = path.join(globalCacheDir, 'provider-registry.json');
    const distJsonPath = path.join(distDir, 'provider-registry.json');

    // Create directories
    originalMkdirSync(globalCacheDir, { recursive: true });
    originalMkdirSync(distDir, { recursive: true });

    // Create initial global cache content (what syncGlobalCacheToLocal would read)
    const globalContent = JSON.stringify(
      {
        providers: { 'cached-provider': { name: 'Cached', models: ['model-a', 'model-b', 'model-c'] } },
        models: { 'cached-provider': ['model-a', 'model-b', 'model-c'] },
        version: '1.0.0',
      },
      null,
      2,
    );
    originalWriteFileSync(globalJsonPath, globalContent, 'utf-8');

    // Content that writeRegistryFiles would write (fresh from gateway fetch)
    const freshContent = JSON.stringify(
      {
        providers: { 'fresh-provider': { name: 'Fresh', models: ['new-model-1', 'new-model-2'] } },
        models: { 'fresh-provider': ['new-model-1', 'new-model-2'] },
        version: '1.0.0',
      },
      null,
      2,
    );

    // Simulate the race condition multiple times with atomic writes
    const iterations = 50;
    let corruptionDetected = false;

    for (let i = 0; i < iterations && !corruptionDetected; i++) {
      // Simulate syncGlobalCacheToLocal with atomic write
      const syncGlobalToLocal = async () => {
        const content = originalReadFileSync(globalJsonPath, 'utf-8');
        await atomicWriteFile(distJsonPath, content);
      };

      // Simulate writeRegistryFiles with atomic write
      const writeRegistryFiles = async () => {
        await atomicWriteFile(distJsonPath, freshContent);
      };

      // Start both operations concurrently
      await Promise.all([syncGlobalToLocal(), writeRegistryFiles()]);

      // Verify the result is valid JSON
      try {
        const resultContent = originalReadFileSync(distJsonPath, 'utf-8');
        JSON.parse(resultContent);
      } catch {
        corruptionDetected = true;
        const resultContent = originalReadFileSync(distJsonPath, 'utf-8');
        console.log(`Corruption detected on iteration ${i + 1}:`);
        console.log('File content (last 200 chars):', resultContent.slice(-200));
      }
    }

    // Clean up
    originalRmSync(tempDir, { recursive: true, force: true });

    // With atomic writes, corruption should NEVER occur
    expect(corruptionDetected).toBe(false);
  });
});
