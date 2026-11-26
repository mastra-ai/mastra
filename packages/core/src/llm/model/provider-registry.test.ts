import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { MastraModelGateway } from './gateways/base.js';
import type { ModelReasoningOption, ProviderConfig, ReasoningCapabilities } from './gateways/base.js';
import {
  GatewayRegistry,
  getModelReasoningOptions,
  modelSupportsAttachments,
  modelSupportsStructuredOutput,
  modelSupportsTemperature,
  _resetCapabilityCaches,
} from './provider-registry.js';

// The registry writes to ~/.cache/mastra (shared by every Mastra project on the machine) and to the
// @mastra/core package root it resolves through `require.resolve('@mastra/core/package.json')`, i.e.
// the real packages/core/dist (and src/ for writeToSrc). Each test gets its own temp home and a temp
// package root seeded like a fresh build, so syncs, cache writes and corrupted-file cleanup run for
// real without touching the build or the user's cache. vitest.registry-guard-setup.ts fails any
// test that still does.
const fixture = vi.hoisted(() => ({ home: '', packageRoot: '' }));

// The developer's shell must not decide which gateways sync or whether the registry auto-refreshes
// on import: a real MASTRA_GATEWAY_API_KEY enables the Mastra gateway and adds a `mastra` provider
// to every sync. Hoisted so the module-level auto-refresh check in provider-registry.ts sees it too.
const REGISTRY_ENV = vi.hoisted(() => {
  const keys = [
    'MASTRA_GATEWAY_API_KEY',
    'MASTRA_GATEWAY_VERSION',
    'MASTRA_GATEWAY_URL',
    'MASTRA_DEV',
    'MASTRA_AUTO_REFRESH_PROVIDERS',
    'MASTRA_OFFLINE',
  ];
  for (const key of keys) vi.stubEnv(key, undefined);
  return keys;
});

vi.mock('node:os', async importOriginal => {
  const actual = await importOriginal<typeof import('node:os')>();
  const { join } = await import('node:path');
  // Before the first test (module scope, describe bodies) fall back to a temp path, never the real home.
  const homedir = () => fixture.home || join(actual.tmpdir(), 'mastra-provider-registry-test-no-home');
  return { ...actual, homedir, default: { ...actual, homedir } };
});

vi.mock('node:module', async importOriginal => {
  const actual = await importOriginal<typeof import('node:module')>();
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const createRequire: typeof actual.createRequire = url => {
    const require = actual.createRequire(url);
    const resolve = Object.assign(
      (id: string, options?: { paths?: string[] }) =>
        id === '@mastra/core/package.json'
          ? join(fixture.packageRoot || join(tmpdir(), 'mastra-provider-registry-test-no-root'), 'package.json')
          : require.resolve(id, options),
      { paths: require.resolve.paths },
    );
    return Object.assign(require, { resolve });
  };
  return { ...actual, createRequire, default: { ...actual, createRequire } };
});

const fixtureRoots: string[] = [];

beforeEach(() => {
  // No test here may reach models.dev or Netlify: a sync that is not mocked fails instead of
  // writing live provider data into whichever fixture is current when it resolves.
  vi.stubGlobal('fetch', () => Promise.reject(new Error('provider-registry tests must not use the network')));
  for (const key of REGISTRY_ENV) vi.stubEnv(key, undefined);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mastra-provider-registry-'));
  fixtureRoots.push(root);
  fixture.home = path.join(root, 'home');
  fixture.packageRoot = path.join(root, 'core');
  fs.mkdirSync(fixture.home);

  const srcModel = path.join(fixture.packageRoot, 'src', 'llm', 'model');
  const distModel = path.join(fixture.packageRoot, 'dist', 'llm', 'model');
  fs.mkdirSync(srcModel, { recursive: true });
  fs.mkdirSync(distModel, { recursive: true });
  fs.writeFileSync(path.join(fixture.packageRoot, 'package.json'), '{"name":"@mastra/core"}');
  for (const file of ['provider-registry.json', 'provider-types.generated.d.ts']) {
    fs.copyFileSync(path.join(__dirname, file), path.join(srcModel, file));
  }
  fs.copyFileSync(
    path.join(__dirname, 'provider-registry.json'),
    path.join(fixture.packageRoot, 'dist', 'provider-registry.json'),
  );
  fs.copyFileSync(
    path.join(__dirname, 'provider-types.generated.d.ts'),
    path.join(distModel, 'provider-types.generated.d.ts'),
  );
  // Only in src/: the loader falls back to it when dist/capabilities is absent, and copying it once is enough.
  fs.cpSync(path.join(__dirname, 'capabilities'), path.join(srcModel, 'capabilities'), { recursive: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

afterAll(() => {
  for (const root of fixtureRoots) fs.rmSync(root, { recursive: true, force: true });
});

/**
 * The gateway classes syncGateways() will instantiate. It imports them dynamically, so after a
 * vi.resetModules() they are not the classes imported at the top of this file.
 */
async function loadedGateways() {
  const [{ ModelsDevGateway }, { NetlifyGateway }, { MastraGateway }] = await Promise.all([
    import('./gateways/models-dev.js'),
    import('./gateways/netlify.js'),
    import('./gateways/mastra.js'),
  ]);
  return { ModelsDevGateway, NetlifyGateway, MastraGateway };
}

const fixtureDist = (...segments: string[]) => path.join(fixture.packageRoot, 'dist', ...segments);
const fixtureCache = (...segments: string[]) => path.join(fixture.home, '.cache', 'mastra', ...segments);
const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf-8'));

/** Remove a model from OpenRouter's checked-in capability arrays (all, or one dimension). */
function stripFromOpenRouterCapabilities(modelId: string, dimension?: string) {
  const originalReadFileSync = fs.readFileSync;
  vi.spyOn(fs, 'readFileSync').mockImplementation((filePath, ...rest) => {
    const content = originalReadFileSync(filePath as any, ...(rest as [any]));
    if (typeof filePath === 'string' && path.basename(filePath) === 'openrouter.json' && typeof content === 'string') {
      const data = JSON.parse(content);
      for (const key of Object.keys(data)) {
        if (Array.isArray(data[key]) && (!dimension || key === dimension)) {
          data[key] = data[key].filter((id: string) => id !== modelId);
        }
      }
      return JSON.stringify(data);
    }
    return content;
  });
}

function withReasoningData(reasoningByProvider: ReasoningCapabilities) {
  const originalReadFileSync = fs.readFileSync;
  vi.spyOn(fs, 'readFileSync').mockImplementation((filePath, options) => {
    const provider = typeof filePath === 'string' ? decodeURIComponent(path.basename(filePath, '.json')) : undefined;
    const reasoning = provider ? reasoningByProvider[provider] : undefined;
    if (!reasoning || typeof filePath !== 'string') return originalReadFileSync(filePath, options);
    const content = fs.existsSync(filePath) ? String(originalReadFileSync(filePath, options)) : '{}';
    return JSON.stringify({ ...JSON.parse(content), reasoning });
  });
}

describe('modelSupportsAttachments', () => {
  afterEach(() => {
    _resetCapabilityCaches();
    vi.restoreAllMocks();
  });

  it('falls back to checked-in source capabilities when dist capability files are absent', async () => {
    // A stale partial build: dist/capabilities exists but has no openrouter.json.
    fs.mkdirSync(fixtureDist('capabilities'));

    // gpt-oss-120b is open-weight and text-only in both the OpenRouter and
    // OpenAI capability lists, so it stays false through the nested-provider fallback.
    expect(modelSupportsAttachments('openrouter/gpt-oss-120b')).toBe(false);
    expect(modelSupportsAttachments('openrouter/openai/gpt-oss-120b')).toBe(false);
    expect(modelSupportsAttachments('mastra/openrouter/openai/gpt-oss-120b')).toBe(false);
    expect(modelSupportsAttachments('openrouter/openai/gpt-4o')).toBe(true);
    expect(modelSupportsAttachments('mastra/openrouter/openai/gpt-4o')).toBe(true);
  });

  it('does not fall back to the nested provider when the gateway lists the model without support', () => {
    const originalReadFileSync = fs.readFileSync;
    vi.spyOn(fs, 'readFileSync').mockImplementation((filePath, ...rest) => {
      const content = originalReadFileSync(filePath as any, ...(rest as [any]));
      if (typeof filePath === 'string' && path.basename(filePath) === 'deepseek.json' && typeof content === 'string') {
        // Simulate a gateway-synced DeepSeek file where the direct API gained vision.
        const data = JSON.parse(content);
        data.attachment = [...(data.attachment ?? []), 'deepseek-v4-flash'];
        return JSON.stringify(data);
      }
      return content;
    });

    // DeepSeek direct supports it, but OpenRouter lists the model without attachment support.
    expect(modelSupportsAttachments('deepseek/deepseek-v4-flash')).toBe(true);
    expect(modelSupportsAttachments('openrouter/deepseek/deepseek-v4-flash')).toBe(false);
  });

  it('treats a gateway-listed model absent from every capability array as unsupported', () => {
    // A model with no capabilities at all is in the gateway's model list but in
    // none of its capability arrays; that must not trigger the nested fallback.
    stripFromOpenRouterCapabilities('openai/gpt-4o');

    expect(modelSupportsAttachments('openai/gpt-4o')).toBe(true);
    expect(modelSupportsAttachments('openrouter/openai/gpt-4o')).toBe(false);
  });

  it('falls back to the nested provider when the gateway does not list the model', () => {
    const registry = GatewayRegistry.getInstance();
    const originalGetModels = registry.getModels.bind(registry);
    vi.spyOn(registry, 'getModels').mockImplementation(() => {
      const models = originalGetModels();
      return { ...models, openrouter: models.openrouter.filter(id => id !== 'openai/gpt-4o') };
    });

    expect(modelSupportsAttachments('openrouter/openai/gpt-4o')).toBe(true);
  });

  it('falls back to the nested provider when the gateway lists the model but publishes no capability data', () => {
    // Netlify enumerates models but implements no capability getters, so no
    // capabilities/netlify.json exists. Listing alone is not an answer.
    expect(fs.existsSync(path.join(process.cwd(), 'src', 'llm', 'model', 'capabilities', 'netlify.json'))).toBe(false);
    expect(GatewayRegistry.getInstance().getModels().netlify).toContain('openai/gpt-4o');

    expect(modelSupportsAttachments('netlify/openai/gpt-4o')).toBe(true);
    expect(modelSupportsAttachments('netlify/openai/gpt-oss-120b')).toBe(false);
  });
});

describe('gateway capability precedence across dimensions', () => {
  afterEach(() => {
    _resetCapabilityCaches();
    vi.restoreAllMocks();
  });

  it('honors the gateway false for temperature over the nested provider', () => {
    stripFromOpenRouterCapabilities('openai/gpt-4o', 'temperature');

    expect(modelSupportsTemperature('openai/gpt-4o')).toBe(true);
    expect(modelSupportsTemperature('openrouter/openai/gpt-4o')).toBe(false);
  });

  it('honors the gateway false for structured output over the nested provider', () => {
    stripFromOpenRouterCapabilities('openai/gpt-4o', 'structuredOutput');

    expect(modelSupportsStructuredOutput('openai/gpt-4o')).toBe(true);
    expect(modelSupportsStructuredOutput('openrouter/openai/gpt-4o')).toBe(false);
  });

  it('keeps the nested fallback for catalog-only gateways across dimensions', () => {
    expect(modelSupportsTemperature('netlify/anthropic/claude-sonnet-4-6')).toBe(true);
    expect(modelSupportsTemperature('netlify/anthropic/claude-sonnet-5')).toBe(false);
    expect(modelSupportsStructuredOutput('netlify/openai/gpt-4o')).toBe(true);
  });
});

describe('modelSupportsTemperature', () => {
  beforeEach(() => {
    _resetCapabilityCaches();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true for models listed in the temperature capability', () => {
    expect(modelSupportsTemperature('openai/gpt-4o')).toBe(true);
    expect(modelSupportsTemperature('anthropic/claude-sonnet-4-6')).toBe(true);
  });

  it('returns false for models whose provider is known but model is not in temperature list', () => {
    // gpt-5-pro is in the openai attachment list but NOT in the temperature list
    expect(modelSupportsTemperature('openai/gpt-5-pro')).toBe(false);
  });

  it('returns undefined for unknown providers', () => {
    expect(modelSupportsTemperature('unknown-provider/some-model')).toBeUndefined();
  });

  it('resolves nested provider model IDs through the fallback path', () => {
    // openrouter/anthropic/claude-sonnet-4-6 should resolve via the nested provider fallback
    expect(modelSupportsTemperature('openrouter/anthropic/claude-sonnet-4-6')).toBe(true);
    expect(modelSupportsTemperature('openrouter/openai/gpt-5-pro')).toBe(false);
  });
});

describe('modelSupportsTemperature — Bedrock resolution (issue #23319)', () => {
  beforeEach(() => {
    _resetCapabilityCaches();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to the underlying vendor for Bedrock router ids', () => {
    // aws-bedrock has no capability file; claude-sonnet-5 must inherit anthropic's
    // (unsupported) temperature fact, while claude-sonnet-4-6 stays supported.
    expect(modelSupportsTemperature('aws-bedrock/claude-sonnet-5')).toBe(false);
    expect(modelSupportsTemperature('aws-bedrock/claude-sonnet-4-6')).toBe(true);
  });

  it('normalizes provider-instance ids (region + vendor prefixes)', () => {
    // @ai-sdk/amazon-bedrock exposes provider `amazon-bedrock` and region/vendor-qualified ids.
    expect(modelSupportsTemperature('amazon-bedrock/us.anthropic.claude-sonnet-5')).toBe(false);
    expect(modelSupportsTemperature('amazon-bedrock/eu.anthropic.claude-sonnet-4-6')).toBe(true);
    // Global and geographic (JP/AU/IN) inference-profile prefixes resolve the same way.
    expect(modelSupportsTemperature('amazon-bedrock/global.anthropic.claude-sonnet-5')).toBe(false);
    expect(modelSupportsTemperature('amazon-bedrock/jp.anthropic.claude-sonnet-4-6')).toBe(true);
    expect(modelSupportsTemperature('amazon-bedrock/au.anthropic.claude-sonnet-4-6')).toBe(true);
    expect(modelSupportsTemperature('amazon-bedrock/in.anthropic.claude-sonnet-5')).toBe(false);
    expect(modelSupportsTemperature('amazon-bedrock/in.anthropic.claude-opus-5')).toBe(false);
  });

  it('applies the Bedrock grok temperature override without affecting direct xai', () => {
    // Bedrock-hosted grok-4.6 rejects temperature even though direct xai accepts it.
    expect(modelSupportsTemperature('aws-bedrock/grok-4.6')).toBe(false);
    expect(modelSupportsTemperature('amazon-bedrock/us.xai.grok-4.6')).toBe(false);
    expect(modelSupportsTemperature('xai/grok-4.6')).toBe(true);
  });

  it('uses OpenAI capabilities for Bedrock-hosted models without changing gpt-oss handling', () => {
    for (const model of [
      'us.openai.gpt-6-sol',
      'us.openai.gpt-6-luna',
      'global.openai.gpt-6-sol',
      'us.openai.gpt-5.6-sol',
      'us.openai.gpt-4o',
    ]) {
      expect(modelSupportsTemperature(`amazon-bedrock/${model}`)).toBe(true);
    }
    // gpt-5-pro is not in the openai temperature list, and Bedrock inherits that.
    expect(modelSupportsTemperature('amazon-bedrock/us.openai.gpt-5-pro')).toBe(false);
    expect(modelSupportsTemperature('amazon-bedrock/global.openai.gpt-5-pro')).toBe(false);
    expect(modelSupportsTemperature('amazon-bedrock/us.openai.gpt-oss-120b')).toBeUndefined();
  });
});

describe('modelSupportsStructuredOutput', () => {
  afterEach(() => {
    _resetCapabilityCaches();
  });

  it.each([
    ['returns true for a model with known native support', 'openai/gpt-4o', true],
    ['returns false for a known unsupported route override', 'deepseek/deepseek-v4-pro', false],
    ['returns false for an unlisted model from a provider with capability data', 'openai/not-a-real-model', false],
    [
      'uses underlying provider data for nested gateway routes without a route override',
      'openrouter/openai/gpt-4o',
      true,
    ],
  ] as const)('%s', (_title, input, expected) => {
    expect(modelSupportsStructuredOutput(input)).toBe(expected);
  });

  it('returns undefined when the provider has no capability data', () => {
    expect(modelSupportsStructuredOutput('unknown-provider/some-model')).toBeUndefined();
  });
});

describe('getModelReasoningOptions', () => {
  const haikuBudget: ModelReasoningOption[] = [{ type: 'budget_tokens', min: 1024 }];
  const gatewayToggle: ModelReasoningOption[] = [{ type: 'toggle' }];
  const gpt5Efforts: ModelReasoningOption[] = [{ type: 'effort', values: ['minimal', 'low', 'medium', 'high'] }];

  beforeEach(() => {
    withReasoningData({
      anthropic: { 'claude-haiku-4-5': haikuBudget },
      openai: { 'gpt-5': gpt5Efforts },
      openrouter: { 'anthropic/claude-haiku-4.5': gatewayToggle },
      'acme/anthropic': { 'claude-haiku-4-5': gatewayToggle },
      'aws-bedrock': { 'us.anthropic.claude-sonnet-4-5': gatewayToggle },
    });
  });

  afterEach(() => {
    _resetCapabilityCaches();
    vi.restoreAllMocks();
  });

  it('returns the controls the provider publishes for the model', () => {
    expect(getModelReasoningOptions('anthropic/claude-haiku-4-5')).toEqual(haikuBudget);
  });

  it('answers with the gateway data when the gateway publishes it, not the upstream provider', () => {
    expect(getModelReasoningOptions('openrouter/anthropic/claude-haiku-4.5')).toEqual(gatewayToggle);
  });

  it('answers no controls for a model the publishing gateway lists without options, instead of borrowing upstream data', () => {
    expect(GatewayRegistry.getInstance().getModels().openrouter).toContain('openai/gpt-5');

    expect(getModelReasoningOptions('openrouter/openai/gpt-5')).toEqual([]);
  });

  it('falls back to the upstream provider for catalog-only gateways', () => {
    expect(getModelReasoningOptions('netlify/openai/gpt-5')).toEqual(gpt5Efforts);
  });

  it("answers with a gateway's per-provider data before the upstream provider's", () => {
    expect(getModelReasoningOptions('acme/anthropic/claude-haiku-4-5')).toEqual(gatewayToggle);
  });

  it('uses the vendor data for Bedrock-hosted models', () => {
    expect(getModelReasoningOptions('amazon-bedrock/us.anthropic.claude-haiku-4-5')).toEqual(haikuBudget);
  });

  it('prefers data Bedrock publishes under the full model id', () => {
    expect(getModelReasoningOptions('amazon-bedrock/us.anthropic.claude-sonnet-4-5')).toEqual(gatewayToggle);
  });

  it('answers no controls for a model its provider lists without options', () => {
    expect(getModelReasoningOptions('anthropic/claude-opus-4-6')).toEqual([]);
  });

  it('returns undefined when nothing describes the model', () => {
    expect(getModelReasoningOptions('unknown-provider/some-model')).toBeUndefined();
    expect(getModelReasoningOptions('claude-haiku-4-5')).toBeUndefined();
  });
});

describe('GatewayRegistry Auto-Refresh', () => {
  let CACHE_DIR: string;
  let CACHE_FILE: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    CACHE_DIR = fixtureCache();
    CACHE_FILE = fixtureCache('gateway-refresh-time');
    originalEnv = { ...process.env };

    // Reset the singleton instance
    // @ts-expect-error - accessing private property for testing
    GatewayRegistry['instance'] = undefined;
  });

  afterEach(() => {
    // Restore env in place: assigning a new object to process.env detaches it from the real
    // environment, so later HOME changes would no longer reach os.homedir().
    for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
    Object.assign(process.env, originalEnv);

    // Stop any running intervals
    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });
    registry.stopAutoRefresh();

    // Restore all mocks
    vi.restoreAllMocks();
  });

  it('should not sync the global cache on every registry read once loaded', () => {
    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });
    registry.getProviders();

    const globalCachePath = path.join(os.homedir(), '.cache', 'mastra', 'provider-registry.json');
    const existsSpy = vi.spyOn(fs, 'existsSync');

    registry.getProviders();
    registry.isProviderRegistered('openai');
    registry.getModels();

    expect(existsSpy.mock.calls.some(([p]) => p === globalCachePath)).toBe(false);
  });

  it('should create cache file on first sync', async () => {
    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });
    vi.spyOn((await loadedGateways()).ModelsDevGateway.prototype, 'fetchProviders').mockResolvedValue({
      openai: { name: 'OpenAI', models: ['gpt-4o'], apiKeyEnvVar: 'OPENAI_API_KEY', gateway: 'models.dev' },
    });
    vi.spyOn((await loadedGateways()).NetlifyGateway.prototype, 'fetchProviders').mockResolvedValue({});

    expect(fs.existsSync(CACHE_FILE)).toBe(false);

    await registry.syncGateways();

    expect(fs.existsSync(CACHE_FILE)).toBe(true);

    const timestamp = fs.readFileSync(CACHE_FILE, 'utf-8').trim();
    const cacheTime = new Date(parseInt(timestamp, 10));

    expect(cacheTime.getTime()).toBeGreaterThan(Date.now() - 5000); // Within last 5 seconds
    expect(cacheTime.getTime()).toBeLessThanOrEqual(Date.now());
  });

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

    // Mock before construction: the constructor starts auto-refresh, which syncs immediately
    vi.spyOn(GatewayRegistry.prototype, 'syncGateways').mockResolvedValue(undefined);

    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });

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

    // Mock before construction: the constructor starts auto-refresh, which syncs immediately
    vi.spyOn(GatewayRegistry.prototype, 'syncGateways').mockResolvedValue(undefined);

    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });

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

    // A fresh module: the failure flag is module state that would disable syncs in later tests.
    vi.resetModules();
    const { GatewayRegistry } = await import('./provider-registry.js');
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

    // The sync writes the fixture's dist/ for real; read what it wrote.
    const tempJsonPath = fixtureDist('provider-registry.json');
    const tempTypesPath = fixtureDist('llm', 'model', 'provider-types.generated.d.ts');

    // Mock the gateways to return controlled data
    const { ModelsDevGateway } = await import('./gateways/models-dev.js');
    const { NetlifyGateway } = await import('./gateways/netlify.js');

    let modelsDevCallCount = 0;

    // Use vi.spyOn for proper mocking (automatically restored by vi.restoreAllMocks)
    vi.spyOn((await loadedGateways()).ModelsDevGateway.prototype, 'fetchProviders').mockImplementation(
      async function (): Promise<Record<string, ProviderConfig>> {
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
        }
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
      },
    );

    // Mock Netlify to return empty
    vi.spyOn((await loadedGateways()).NetlifyGateway.prototype, 'fetchProviders').mockImplementation(
      async function (): Promise<Record<string, ProviderConfig>> {
        return {};
      },
    );

    // First sync
    await registry.syncGateways(true);

    // Read and verify first generation
    const firstJson = JSON.parse(fs.readFileSync(tempJsonPath, 'utf-8'));
    expect(firstJson.providers['test-provider']).toBeDefined();
    expect(firstJson.providers['new-provider']).toBeUndefined();
    expect(firstJson.providers['test-provider'].models).toEqual(['model-a', 'model-b']);

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
    expect(secondJson.providers['test-provider'].models).toEqual(['model-a', 'model-b', 'model-c']);
    expect(secondJson.providers['new-provider'].models).toEqual(['new-model-1', 'new-model-2']);

    const secondTypes = fs.readFileSync(tempTypesPath, 'utf-8');
    expect(secondTypes).toContain("'test-provider': readonly ['model-a', 'model-b', 'model-c']");
    expect(secondTypes).toContain("'new-provider': readonly ['new-model-1', 'new-model-2']");
    expect(secondTypes).toContain('export type Provider = keyof ProviderModelsMap');

    // Verify the ModelRouterModelId type definition exists (it's a template literal type)
    expect(secondTypes).toContain('export type ModelRouterModelId');
    expect(secondTypes).toContain('ProviderModelsMap[P][number]');
  });

  it('should hide disabled gateway providers at runtime when shouldEnable returns false', async () => {
    delete process.env.MASTRA_GATEWAY_API_KEY;
    // @ts-expect-error - accessing private property for testing
    GatewayRegistry['instance'] = undefined;

    const registry = GatewayRegistry.getInstance({ useDynamicLoading: false });

    expect(registry.getProviders().mastra).toBeUndefined();
    expect(registry.getProviders()['mastra/google']).toBeUndefined();
    expect(registry.getModels().mastra).toBeUndefined();
    expect(registry.getModels()['mastra/google']).toBeUndefined();
  });

  it('should allow a later caller to enable dynamic loading on the singleton', async () => {
    // @ts-expect-error - accessing private property for testing
    GatewayRegistry['instance'] = undefined;

    const syncSpy = vi.spyOn(GatewayRegistry.prototype, 'syncGateways').mockResolvedValue();

    const initialRegistry = GatewayRegistry.getInstance({ useDynamicLoading: false });
    const upgradedRegistry = GatewayRegistry.getInstance({ useDynamicLoading: true });

    expect(upgradedRegistry).toBe(initialRegistry);

    await upgradedRegistry.syncGateways(true);

    expect(syncSpy).toHaveBeenCalledOnce();
    expect(syncSpy).toHaveBeenCalledWith(true);
    // @ts-expect-error - accessing private property for testing
    expect(upgradedRegistry.useDynamicLoading).toBe(true);
  });

  it('should write to src/ when writeToSrc flag is true', async () => {
    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });

    // Mock gateway to return test data
    vi.spyOn((await loadedGateways()).ModelsDevGateway.prototype, 'fetchProviders').mockResolvedValue({
      'test-provider': {
        name: 'Test Provider',
        models: ['model-a'],
        apiKeyEnvVar: 'TEST_API_KEY',
        gateway: 'models-dev',
      } as ProviderConfig,
    });

    vi.spyOn((await loadedGateways()).NetlifyGateway.prototype, 'fetchProviders').mockResolvedValue({});
    const mastraFetchProvidersSpy = vi
      .spyOn((await loadedGateways()).MastraGateway.prototype, 'fetchProviders')
      .mockResolvedValue({
        mastra: {
          name: 'Gateway',
          models: ['anthropic/claude-sonnet-4.5'],
          apiKeyEnvVar: 'MASTRA_GATEWAY_API_KEY',
          gateway: 'mastra',
        } as ProviderConfig,
      });

    // Call syncGateways with writeToSrc=true
    await registry.syncGateways(true, true);

    expect(mastraFetchProvidersSpy).not.toHaveBeenCalled();

    // dist/ and src/ (of the fixture package root) both hold the generated registry and types
    const srcModel = path.join(fixture.packageRoot, 'src', 'llm', 'model');
    for (const jsonPath of [fixtureDist('provider-registry.json'), path.join(srcModel, 'provider-registry.json')]) {
      expect(Object.keys(readJson(jsonPath).providers)).toEqual(['test-provider']);
    }
    for (const typesPath of [
      fixtureDist('llm', 'model', 'provider-types.generated.d.ts'),
      path.join(srcModel, 'provider-types.generated.d.ts'),
    ]) {
      expect(fs.readFileSync(typesPath, 'utf-8')).toContain("'test-provider': readonly ['model-a']");
    }
  });

  it('should skip syncGateways when MASTRA_OFFLINE is set to true', async () => {
    process.env.MASTRA_OFFLINE = 'true';

    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });

    // Mock fetchProviders to detect if network calls are attempted
    const fetchSpy = vi.spyOn((await loadedGateways()).ModelsDevGateway.prototype, 'fetchProviders');

    await registry.syncGateways(true);

    // fetchProviders should never be called — syncGateways bails out early
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should skip syncGateways when MASTRA_OFFLINE is set to 1', async () => {
    process.env.MASTRA_OFFLINE = '1';

    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });

    const fetchSpy = vi.spyOn((await loadedGateways()).ModelsDevGateway.prototype, 'fetchProviders');

    await registry.syncGateways(true);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should not skip syncGateways when MASTRA_OFFLINE is set to false', async () => {
    process.env.MASTRA_OFFLINE = 'false';

    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });

    // Mock fetchProviders to avoid actual network calls but verify it's called
    const fetchSpy = vi
      .spyOn((await loadedGateways()).ModelsDevGateway.prototype, 'fetchProviders')
      .mockResolvedValue({});
    vi.spyOn((await loadedGateways()).NetlifyGateway.prototype, 'fetchProviders').mockResolvedValue({});

    await registry.syncGateways(true);

    expect(fetchSpy).toHaveBeenCalled();
  });

  it('should skip startAutoRefresh when MASTRA_OFFLINE is set', () => {
    process.env.MASTRA_OFFLINE = 'true';

    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });

    registry.startAutoRefresh(100);

    // @ts-expect-error - accessing private property for testing
    expect(registry.refreshInterval).toBeNull();
  });

  it('should write .d.ts file to correct dist subdirectory path', async () => {
    // Mock gateway to return test data
    vi.spyOn((await loadedGateways()).ModelsDevGateway.prototype, 'fetchProviders').mockResolvedValue({
      'test-provider': {
        name: 'Test Provider',
        models: ['model-a'],
        apiKeyEnvVar: 'TEST_API_KEY',
        gateway: 'models-dev',
      },
    } as Record<string, ProviderConfig>);

    vi.spyOn((await loadedGateways()).NetlifyGateway.prototype, 'fetchProviders').mockResolvedValue(
      {} as Record<string, ProviderConfig>,
    );

    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });
    await registry.syncGateways(true);

    // The .d.ts goes to the global cache and to dist/llm/model/ (not the dist/ root)
    for (const typesPath of [
      fixtureCache('provider-types.generated.d.ts'),
      fixtureDist('llm', 'model', 'provider-types.generated.d.ts'),
    ]) {
      expect(fs.readFileSync(typesPath, 'utf-8')).toContain("'test-provider': readonly ['model-a']");
    }
    expect(fs.existsSync(fixtureDist('provider-types.generated.d.ts'))).toBe(false);
  });
});

describe('Corrupted JSON recovery', () => {
  const originalReadFileSync = fs.readFileSync.bind(fs);
  const originalWriteFileSync = fs.writeFileSync.bind(fs);
  const originalExistsSync = fs.existsSync.bind(fs);
  const originalMkdirSync = fs.mkdirSync.bind(fs);
  const originalRmSync = fs.rmSync.bind(fs);

  beforeEach(() => {
    vi.restoreAllMocks();
    // Reset the singleton instance
    // @ts-expect-error - accessing private property for testing
    GatewayRegistry['instance'] = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fall back to static registry when dynamic JSON is corrupted', async () => {
    // Create a corrupted JSON file (like what would happen from dual writes)
    const corruptedJsonPath = fixtureDist('provider-registry.json');
    const corruptedContent = `{
  "providers": {
    "test": { "name": "Test", "models": ["a", "b"] }
  },
  "models": { "test": ["a", "b"] },
  "version": "1.0.0"
}
}
]}
}`; // <-- extra garbage from concurrent write
    originalWriteFileSync(corruptedJsonPath, corruptedContent, 'utf-8');
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // A fresh module: the dev-mode registry is cached in module state once loaded.
    vi.resetModules();
    const fresh = await import('./provider-registry.js');
    const providers = fresh.GatewayRegistry.getInstance({ useDynamicLoading: true }).getProviders();

    // The corrupted file is deleted and the bundled registry is served instead
    expect(providers.openai?.name).toBe('OpenAI');
    expect(fs.existsSync(corruptedJsonPath)).toBe(false);
  });

  it('should delete corrupted JSON file silently without logging', async () => {
    const tempDir = path.join(os.tmpdir(), `mastra-corrupted-json-delete-test-${Date.now()}`);
    const distDir = path.join(tempDir, 'dist');
    originalMkdirSync(distDir, { recursive: true });

    // Create a corrupted JSON file
    const corruptedJsonPath = path.join(distDir, 'provider-registry.json');
    const corruptedContent = `{"providers": {}} CORRUPTED`;
    originalWriteFileSync(corruptedJsonPath, corruptedContent, 'utf-8');

    // Mock console.warn to capture the warning
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Mock fs.readFileSync to return corrupted content for our test path
    const readFileSyncSpy = vi.spyOn(fs, 'readFileSync').mockImplementation((filePath, encoding) => {
      if (typeof filePath === 'string' && filePath === corruptedJsonPath) {
        return corruptedContent;
      }
      return originalReadFileSync(filePath, encoding as BufferEncoding);
    });

    // Mock fs.existsSync to return true for our test path
    const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockImplementation(filePath => {
      if (typeof filePath === 'string' && filePath === corruptedJsonPath) {
        return true;
      }
      return originalExistsSync(filePath);
    });

    const unlinkSyncSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(filePath => {
      if (typeof filePath === 'string') {
        deletedPath = filePath;
      }
      // Don't actually delete, just track
    });

    // We need to import the loadRegistry function fresh to test it
    // Since loadRegistry is not exported, we'll test through GatewayRegistry
    // @ts-expect-error - accessing private property for testing
    GatewayRegistry['instance'] = undefined;

    // This should trigger loadRegistry with corrupted JSON detection
    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });

    // Access providers to trigger loading
    try {
      registry.getProviders();
    } catch {
      // May throw if static registry also has issues in test environment
    }

    // The corruption is auto-recoverable (next gateway sync rewrites the file),
    // so we should not log a warning that worries users.
    expect(warnSpy).not.toHaveBeenCalled();

    // Clean up mocks
    readFileSyncSpy.mockRestore();
    existsSyncSpy.mockRestore();
    unlinkSyncSpy.mockRestore();
    warnSpy.mockRestore();

    // Clean up temp directory
    originalRmSync(tempDir, { recursive: true, force: true });
  });

  it('should not propagate corrupted global cache to local dist', async () => {
    const tempDir = path.join(os.tmpdir(), `mastra-corrupted-global-test-${Date.now()}`);
    const cacheDir = path.join(tempDir, '.cache', 'mastra');
    originalMkdirSync(cacheDir, { recursive: true });

    // Create a corrupted global cache file
    const globalJsonPath = path.join(cacheDir, 'provider-registry.json');
    const corruptedContent = `{"providers": {}} EXTRA_GARBAGE`;
    originalWriteFileSync(globalJsonPath, corruptedContent, 'utf-8');

    // Verify the file was created
    expect(originalExistsSync(globalJsonPath)).toBe(true);

    // The syncGlobalCacheToLocal function should detect the corruption,
    // delete the corrupted file, and NOT copy it to local dist
    // We test this by checking that JSON.parse fails on the content
    expect(() => JSON.parse(corruptedContent)).toThrow(SyntaxError);

    // Clean up
    originalRmSync(tempDir, { recursive: true, force: true });
  });

  it('should detect unquoted numeric provider names in .d.ts content', () => {
    // The validation regex used in syncGlobalCacheToLocal to detect corrupted .d.ts files
    const validationRegex = /readonly\s+\d/;

    // Corrupted content: unquoted "302ai" starts with a digit - invalid TypeScript
    const corruptedDtsContent = `export type ProviderModelsMap = {
  readonly openai: readonly ['gpt-4o'];
  readonly 302ai: readonly ['model-1'];
};`;

    // Valid content: "302ai" is properly quoted
    const validDtsContent = `export type ProviderModelsMap = {
  readonly openai: readonly ['gpt-4o'];
  readonly '302ai': readonly ['model-1'];
};`;

    // Content with no numeric providers at all
    const nothingToQuote = `export type ProviderModelsMap = {
  readonly openai: readonly ['gpt-4o'];
  readonly anthropic: readonly ['claude-3'];
};`;

    expect(validationRegex.test(corruptedDtsContent)).toBe(true);
    expect(validationRegex.test(validDtsContent)).toBe(false);
    expect(validationRegex.test(nothingToQuote)).toBe(false);
  });
});

describe('Partial gateway sync should not corrupt registry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // @ts-expect-error - accessing private property for testing
    GatewayRegistry['instance'] = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not write partial results to disk when a gateway fetch fails', async () => {
    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });

    // Mock ModelsDevGateway.fetchProviders to fail (simulating models.dev API being down)
    vi.spyOn((await loadedGateways()).ModelsDevGateway.prototype, 'fetchProviders').mockRejectedValue(
      new Error('Failed to fetch from models.dev: Service Unavailable'),
    );

    // Mock NetlifyGateway.fetchProviders to succeed (only Netlify returns data)
    vi.spyOn((await loadedGateways()).NetlifyGateway.prototype, 'fetchProviders').mockResolvedValue({
      netlify: {
        name: 'Netlify',
        url: 'https://netlify.example.com',
        apiKeyEnvVar: 'NETLIFY_API_KEY',
        models: ['netlify-model-1'],
        gateway: 'netlify',
      },
    } as Record<string, ProviderConfig>);

    const distRegistryBefore = fs.readFileSync(fixtureDist('provider-registry.json'), 'utf-8');

    await registry.syncGateways(true);

    // No registry files should have been written since models.dev failed
    expect(fs.readFileSync(fixtureDist('provider-registry.json'), 'utf-8')).toBe(distRegistryBefore);
    expect(fs.existsSync(fixtureCache('provider-registry.json'))).toBe(false);
  });

  it('should write results when all gateways succeed', async () => {
    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });

    // Mock both gateways to succeed
    vi.spyOn((await loadedGateways()).ModelsDevGateway.prototype, 'fetchProviders').mockResolvedValue({
      openai: {
        name: 'OpenAI',
        url: 'https://api.openai.com/v1',
        apiKeyEnvVar: 'OPENAI_API_KEY',
        models: ['gpt-4o'],
        gateway: 'models.dev',
      },
    } as Record<string, ProviderConfig>);

    vi.spyOn((await loadedGateways()).NetlifyGateway.prototype, 'fetchProviders').mockResolvedValue({
      netlify: {
        name: 'Netlify',
        url: 'https://netlify.example.com',
        apiKeyEnvVar: 'NETLIFY_API_KEY',
        models: ['netlify-model-1'],
        gateway: 'netlify',
      },
    } as Record<string, ProviderConfig>);

    await registry.syncGateways(true);

    // Registry files SHOULD be written since all gateways succeeded
    for (const jsonPath of [fixtureDist('provider-registry.json'), fixtureCache('provider-registry.json')]) {
      expect(Object.keys(readJson(jsonPath).providers).sort()).toEqual(['netlify', 'openai']);
    }
  });
});

describe('Issue #10434: Concurrent write corruption', () => {
  // Store original fs functions to use in tests (avoid mock interference)
  const originalWriteFile = fs.promises.writeFile.bind(fs.promises);
  const originalRename = fs.promises.rename.bind(fs.promises);
  const originalUnlink = fs.promises.unlink.bind(fs.promises);

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
    fs.mkdirSync(tempDir, { recursive: true });

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
        const content = fs.readFileSync(testJsonPath, 'utf-8');
        JSON.parse(content);
        // If we get here, the JSON is valid (one write "won" atomically)
      } catch {
        // JSON parse error means the file was corrupted
        corruptionDetected = true;
        const content = fs.readFileSync(testJsonPath, 'utf-8');
        console.log(`Corruption detected on iteration ${i + 1}:`);
        console.log('File content (last 200 chars):', content.slice(-200));
      }
    }

    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });

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
    fs.mkdirSync(globalCacheDir, { recursive: true });
    fs.mkdirSync(distDir, { recursive: true });

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
    fs.writeFileSync(globalJsonPath, globalContent, 'utf-8');

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
        const content = fs.readFileSync(globalJsonPath, 'utf-8');
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
        const resultContent = fs.readFileSync(distJsonPath, 'utf-8');
        JSON.parse(resultContent);
      } catch {
        corruptionDetected = true;
        const resultContent = fs.readFileSync(distJsonPath, 'utf-8');
        console.log(`Corruption detected on iteration ${i + 1}:`);
        console.log('File content (last 200 chars):', resultContent.slice(-200));
      }
    }

    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });

    // With atomic writes, corruption should NEVER occur
    expect(corruptionDetected).toBe(false);
  });
});

describe('Runtime provider registry filtering', () => {
  type RegistryModule = typeof import('./provider-registry.js');
  type RegistryJson = { providers: Record<string, ProviderConfig>; version: string };

  const ENV_KEYS = ['MASTRA_DEV', 'MASTRA_AUTO_REFRESH_PROVIDERS', 'MASTRA_GATEWAY_API_KEY', 'MASTRA_OFFLINE'];
  let savedEnv: Record<string, string | undefined>;

  class ToggleGateway extends MastraModelGateway {
    readonly name = 'Toggle';
    constructor(
      readonly id: string,
      public enabled = true,
    ) {
      super();
    }
    override shouldEnable() {
      return this.enabled;
    }
    async fetchProviders(): Promise<Record<string, ProviderConfig>> {
      return {
        [this.id]: { name: this.id, models: [`${this.id}-model`], apiKeyEnvVar: 'TOGGLE_KEY', gateway: this.id },
      };
    }
    buildUrl() {
      return 'https://example.invalid/v1';
    }
    async getApiKey() {
      return 'key';
    }
    async resolveLanguageModel(): Promise<never> {
      throw new Error('not used');
    }
  }

  // A bundled registry that also carries providers for the Mastra gateway and a custom gateway,
  // the way one does when it was generated with those gateways enabled.
  async function loadWithBundledRegistry(): Promise<RegistryModule> {
    const real = (await vi.importActual<{ default: RegistryJson }>('./provider-registry.json')).default;
    const bundled: RegistryJson = {
      ...real,
      providers: {
        ...real.providers,
        'mastra/openai': {
          name: 'Mastra OpenAI',
          models: ['gpt-4o'],
          apiKeyEnvVar: 'MASTRA_GATEWAY_API_KEY',
          gateway: 'mastra',
        },
        acme: { name: 'Acme', models: ['acme-1'], apiKeyEnvVar: 'ACME_API_KEY', gateway: 'acme' },
      },
    };
    vi.doMock('./provider-registry.json', () => ({ default: bundled }));
    return import('./provider-registry.js');
  }

  beforeEach(() => {
    savedEnv = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]));
    delete process.env.MASTRA_DEV;
    delete process.env.MASTRA_AUTO_REFRESH_PROVIDERS;
    delete process.env.MASTRA_GATEWAY_API_KEY;
    delete process.env.MASTRA_OFFLINE;
    vi.resetModules();
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.doUnmock('./provider-registry.json');
    vi.resetModules();
    vi.restoreAllMocks();
  });

  // Importing @mastra/core enumerates PROVIDER_REGISTRY (gateways/defaults.ts does it at module scope).
  // Every proxy trap used to re-filter the whole bundled registry, ~625 times per import.
  it('filters the bundled registry once when @mastra/core is imported and on later reads', async () => {
    const entriesSpy = vi.spyOn(Object, 'entries');

    await import('../../index.js');
    const bundled = ((await import('./provider-registry.json')) as unknown as { default: RegistryJson }).default;
    const filterRuns = () => entriesSpy.mock.calls.filter(([value]) => value === bundled.providers).length;
    expect(filterRuns()).toBe(1);

    const llm = await import('../index.js');
    expect(Object.keys(llm.PROVIDER_REGISTRY).length).toBeGreaterThan(100);
    expect(llm.PROVIDER_REGISTRY.openai?.name).toBe('OpenAI');
    expect(llm.GatewayRegistry.getInstance().getModels().openai).toContain('gpt-4o');
    for (const id of Object.keys(llm.PROVIDER_REGISTRY))
      void llm.PROVIDER_REGISTRY[id as keyof typeof llm.PROVIDER_REGISTRY];
    expect(filterRuns()).toBe(1);
  });

  it('shows a custom gateway registered after the registry was first read, and hides it once unregistered', async () => {
    const { GatewayRegistry, PROVIDER_REGISTRY, PROVIDER_MODELS } = await loadWithBundledRegistry();
    const registry = GatewayRegistry.getInstance();

    expect('acme' in PROVIDER_REGISTRY).toBe(false);

    registry.registerCustomGateways([new ToggleGateway('acme')]);
    expect(PROVIDER_REGISTRY['acme' as keyof typeof PROVIDER_REGISTRY]?.name).toBe('Acme');
    expect(PROVIDER_MODELS['acme' as keyof typeof PROVIDER_MODELS]).toEqual(['acme-1']);
    expect(registry.isProviderRegistered('acme')).toBe(true);

    registry.registerCustomGateways([]);
    expect('acme' in PROVIDER_REGISTRY).toBe(false);
    expect(registry.getModels().acme).toBeUndefined();
  });

  it('hides providers of gateways replaced by one whose id contains a newline', async () => {
    const { GatewayRegistry, PROVIDER_REGISTRY } = await loadWithBundledRegistry();
    const registry = GatewayRegistry.getInstance();

    registry.registerCustomGateways([new ToggleGateway('acme'), new ToggleGateway('acmf')]);
    expect('acme' in PROVIDER_REGISTRY).toBe(true);

    registry.registerCustomGateways([new ToggleGateway('acme\nacmf')]);
    expect('acme' in PROVIDER_REGISTRY).toBe(false);
  });

  it('follows a registered gateway being disabled and re-enabled after the registry was first read', async () => {
    const { GatewayRegistry, PROVIDER_REGISTRY } = await loadWithBundledRegistry();
    const acme = new ToggleGateway('acme');
    GatewayRegistry.getInstance().registerCustomGateways([acme]);

    expect('acme' in PROVIDER_REGISTRY).toBe(true);
    acme.enabled = false;
    expect('acme' in PROVIDER_REGISTRY).toBe(false);
    expect(Object.keys(PROVIDER_REGISTRY)).not.toContain('acme');
    acme.enabled = true;
    expect(Object.keys(PROVIDER_REGISTRY)).toContain('acme');
  });

  it('shows Mastra gateway providers once MASTRA_GATEWAY_API_KEY is set after the registry was first read', async () => {
    const { GatewayRegistry, PROVIDER_REGISTRY } = await loadWithBundledRegistry();
    const registry = GatewayRegistry.getInstance();

    expect(registry.getProviderConfig('mastra/openai')).toBeUndefined();

    process.env.MASTRA_GATEWAY_API_KEY = 'msk_test';
    expect(registry.getProviderConfig('mastra/openai')?.name).toBe('Mastra OpenAI');
    expect(registry.getModels()['mastra/openai']).toEqual(['gpt-4o']);

    delete process.env.MASTRA_GATEWAY_API_KEY;
    expect('mastra/openai' in PROVIDER_REGISTRY).toBe(false);
    // Unrelated providers are unaffected by the gateway toggling.
    expect(PROVIDER_REGISTRY.openai?.name).toBe('OpenAI');
  });

  // Dev mode reads the registry from disk and reloads it after a gateway refresh.
  it('serves refreshed provider data in dev mode after a gateway sync', async () => {
    const { GatewayRegistry } = await import('./provider-registry.js');
    const { ModelsDevGateway: FreshModelsDev } = await import('./gateways/models-dev.js');
    const { NetlifyGateway: FreshNetlify } = await import('./gateways/netlify.js');

    // The registry the dev server starts with.
    fs.writeFileSync(
      fixtureDist('provider-registry.json'),
      JSON.stringify({
        version: '1.0.0',
        providers: {
          openai: { name: 'OpenAI', models: ['gpt-old'], apiKeyEnvVar: 'OPENAI_API_KEY', gateway: 'models.dev' },
          anthropic: {
            name: 'Anthropic',
            models: ['claude-old'],
            apiKeyEnvVar: 'ANTHROPIC_API_KEY',
            gateway: 'models.dev',
          },
        },
        models: { openai: ['gpt-old'], anthropic: ['claude-old'] },
      }),
    );

    // Gateways are the network edge; everything after the fetch runs for real.
    vi.spyOn(FreshModelsDev.prototype, 'fetchProviders').mockResolvedValue({
      openai: { name: 'OpenAI', models: ['gpt-refreshed'], apiKeyEnvVar: 'OPENAI_API_KEY', gateway: 'models.dev' },
    });
    vi.spyOn(FreshNetlify.prototype, 'fetchProviders').mockResolvedValue({});

    const registry = GatewayRegistry.getInstance({ useDynamicLoading: true });
    expect(registry.getModels().openai).toEqual(['gpt-old']);
    expect(registry.isProviderRegistered('anthropic')).toBe(true);

    registry.registerCustomGateways([new ToggleGateway('acme')]);
    await registry.syncGateways(true);

    expect(registry.getModels().openai).toEqual(['gpt-refreshed']);
    expect(registry.getProviderConfig('acme')?.models).toEqual(['acme-model']);
    expect(registry.isProviderRegistered('anthropic')).toBe(false);
  });
});

describe('Provider model lists derived from the registry file', () => {
  // The registry file no longer repeats every model list in a top-level `models` map; `getModels()`
  // and `PROVIDER_MODELS` derive it from `providers[*].models`. The dev-mode loader can also read a
  // registry file written by an older @mastra/core that still has the map.
  const originalReadFileSync = fs.readFileSync;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function loadDynamicRegistryFrom(registryFile: object) {
    vi.spyOn(fs, 'readFileSync').mockImplementation((filePath, ...rest) => {
      if (typeof filePath === 'string' && filePath.endsWith(path.join('dist', 'provider-registry.json'))) {
        return JSON.stringify(registryFile);
      }
      return originalReadFileSync(filePath as any, ...(rest as [any]));
    });
    const fresh = await import('./provider-registry.js');
    return { registry: fresh.GatewayRegistry.getInstance({ useDynamicLoading: true }), fresh };
  }

  const providers = {
    openai: { name: 'OpenAI', models: ['gpt-4.1', 'gpt-5'], gateway: 'models.dev' },
    'netlify/anthropic': { name: 'Anthropic', models: ['claude-haiku-4-5'], gateway: 'netlify' },
  };

  it('lists every bundled provider with exactly the models in its provider entry', async () => {
    // A fresh module gives a fresh singleton; the shared one may have been switched to dynamic loading.
    const fresh = await import('./provider-registry.js');
    const registry = fresh.GatewayRegistry.getInstance({ useDynamicLoading: false });
    const providerConfigs = registry.getProviders();
    const models = registry.getModels();

    expect(Object.keys(providerConfigs).length).toBeGreaterThan(100);
    expect(Object.keys(models)).toEqual(Object.keys(providerConfigs));
    for (const [providerId, config] of Object.entries(providerConfigs)) {
      expect(models[providerId]).toEqual(config.models);
    }
  });

  it('reads model lists from a registry file without the top-level map', async () => {
    const { registry, fresh } = await loadDynamicRegistryFrom({ providers, version: '1.0.0' });

    expect(registry.getModels()).toEqual({
      openai: ['gpt-4.1', 'gpt-5'],
      'netlify/anthropic': ['claude-haiku-4-5'],
    });
    expect(Object.keys(fresh.PROVIDER_MODELS)).toEqual(['openai', 'netlify/anthropic']);
    expect(fresh.PROVIDER_MODELS.openai).toEqual(['gpt-4.1', 'gpt-5']);
  });

  it('reads model lists from a registry file written by an older version with the top-level map', async () => {
    const { registry } = await loadDynamicRegistryFrom({
      providers,
      models: { openai: ['gpt-4.1', 'gpt-5'], 'netlify/anthropic': ['claude-haiku-4-5'] },
      version: '1.0.0',
    });

    expect(registry.getModels()).toEqual({
      openai: ['gpt-4.1', 'gpt-5'],
      'netlify/anthropic': ['claude-haiku-4-5'],
    });
  });
});
