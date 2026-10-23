import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MIN_PRICED_MODELS, modelsDevToPricingModels, pickModelsDevCosts } from './models-dev';
import type { PricingRegistry } from './pricing-registry';

const NEW_MODEL = { provider: 'openai', model: 'brand-new-model' };

/** A models.dev payload big enough to pass validation, with one model the bundled snapshot does not have. */
function catalog(newModelInput = 7): Record<string, unknown> {
  const models: Record<string, unknown> = { 'brand-new-model': { cost: { input: newModelInput, output: 21 } } };
  for (let i = 0; i < MIN_PRICED_MODELS; i++) {
    models[`filler-${i}`] = { cost: { input: 1, output: 2 } };
  }
  return { openai: { models } };
}

// The bot regenerates the snapshot from models.dev without CI, so this checks its shape, not specific models.
describe('PricingRegistry bundled snapshot', () => {
  it('is models.dev costs with enough priced models', () => {
    const costs = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'pricing-data.json'), 'utf-8'));

    expect(pickModelsDevCosts(costs)).toEqual(costs);
    expect(modelsDevToPricingModels(costs).size).toBeGreaterThanOrEqual(MIN_PRICED_MODELS);
  });
});

describe('PricingRegistry.getGlobal refresh', () => {
  let home: string;
  let fetchMock: ReturnType<typeof vi.fn>;
  const cacheFile = () => path.join(home, '.cache', 'mastra', 'pricing-data.json');

  async function loadRegistry(): Promise<typeof PricingRegistry> {
    vi.resetModules();
    return (await import('./pricing-registry')).PricingRegistry;
  }

  function writeCache(costs: unknown, etag: string, ageMs: number, version = 1): void {
    fs.mkdirSync(path.dirname(cacheFile()), { recursive: true });
    fs.writeFileSync(cacheFile(), JSON.stringify({ version, etag, costs }));
    const mtime = new Date(Date.now() - ageMs);
    fs.utimesSync(cacheFile(), mtime, mtime);
  }

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'mastra-pricing-'));
    vi.stubEnv('HOME', home);
    vi.stubEnv('USERPROFILE', home);
    // Refresh is on by default only under `mastra dev`.
    vi.stubEnv('MASTRA_DEV', 'true');
    vi.stubEnv('MASTRA_AUTO_REFRESH_PRICING', '');
    vi.stubEnv('MASTRA_OFFLINE', '');
    fetchMock = vi.fn(async () => new Response(JSON.stringify(catalog()), { headers: { etag: 'W/"v2"' } }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('starts from the bundled snapshot and swaps in models.dev prices in the background', async () => {
    const Registry = await loadRegistry();

    expect(Registry.getGlobal()?.get(NEW_MODEL)).toBeNull();
    await vi.waitFor(() => expect(Registry.getGlobal()?.get(NEW_MODEL)?.tiers[0]?.rates.input_tokens).toBe(7e-6));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.waitFor(() =>
      expect(JSON.parse(fs.readFileSync(cacheFile(), 'utf-8'))).toMatchObject({ version: 1, etag: 'W/"v2"' }),
    );
  });

  it('ignores a cache file written in another format', async () => {
    writeCache(catalog(9), 'W/"v1"', 0, 2);
    const Registry = await loadRegistry();

    expect(Registry.getGlobal()?.get(NEW_MODEL)).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://models.dev/api.json',
      expect.objectContaining({ headers: undefined }),
    );
    await vi.waitFor(() => expect(Registry.getGlobal()?.get(NEW_MODEL)?.tiers[0]?.rates.input_tokens).toBe(7e-6));
  });

  it('starts from a stale cache and revalidates it with its ETag', async () => {
    writeCache(catalog(9), 'W/"v1"', 2 * 24 * 60 * 60 * 1000);
    fetchMock.mockImplementation(async () => new Response(null, { status: 304 }));
    const Registry = await loadRegistry();

    expect(Registry.getGlobal()?.get(NEW_MODEL)?.tiers[0]?.rates.input_tokens).toBe(9e-6);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://models.dev/api.json',
      expect.objectContaining({ headers: { 'if-none-match': 'W/"v1"' } }),
    );
    await vi.waitFor(() => expect(Date.now() - fs.statSync(cacheFile()).mtimeMs).toBeLessThan(60_000));
  });

  it('falls back to the bundled snapshot when refreshed prices miss a model it has', async () => {
    const bundled = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'pricing-data.json'), 'utf-8'));
    const [bundledModel] = Object.keys(bundled.openai.models);
    writeCache(catalog(), 'W/"v1"', 0);
    const Registry = await loadRegistry();

    expect(Registry.getGlobal()?.get({ provider: 'openai', model: bundledModel! })?.id).toBe(`openai/${bundledModel}`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not refresh a fresh cache until a model has no price', async () => {
    writeCache(catalog(), 'W/"v1"', 0);
    const Registry = await loadRegistry();

    expect(Registry.getGlobal()?.get(NEW_MODEL)).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    expect(Registry.getGlobal()?.get({ provider: 'openai', model: 'not-on-models-dev' })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes on a missing model at most once an hour, even if the last refresh failed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    writeCache(catalog(), 'W/"v1"', 0);
    fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError('fetch failed')));
    const Registry = await loadRegistry();
    const registry = Registry.getGlobal()!;

    registry.get({ provider: 'openai', model: 'missing-a' });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await new Promise(resolve => setTimeout(resolve, 10));
    registry.get({ provider: 'openai', model: 'missing-a' });
    registry.get({ provider: 'openai', model: 'missing-b' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + 61 * 60 * 1000);
    registry.get({ provider: 'openai', model: 'missing-a' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => expect(Registry.getGlobal()).not.toBe(registry));
  });

  it.each([
    ['a server error', () => new Response('nope', { status: 500 })],
    ['a payload with too few priced models', () => new Response(JSON.stringify({ openai: { models: {} } }))],
    ['a network failure', () => Promise.reject(new TypeError('fetch failed'))],
  ])('keeps the pricing in use after %s', async (_name, respond) => {
    fetchMock.mockImplementation(respond);
    const Registry = await loadRegistry();
    const bundled = Registry.getGlobal();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(bundled).not.toBeNull();
    expect(Registry.getGlobal()).toBe(bundled);
    expect(fs.existsSync(cacheFile())).toBe(false);
  });

  it.each([
    ['outside `mastra dev` by default', { MASTRA_DEV: '' }],
    ['with MASTRA_AUTO_REFRESH_PRICING=false', { MASTRA_AUTO_REFRESH_PRICING: 'false' }],
    [
      'with MASTRA_OFFLINE=true, even when refresh is turned on',
      { MASTRA_OFFLINE: 'true', MASTRA_AUTO_REFRESH_PRICING: 'true' },
    ],
  ])('uses only the bundled snapshot %s', async (_name, env) => {
    for (const [name, value] of Object.entries(env)) {
      vi.stubEnv(name, value);
    }
    writeCache(catalog(), 'W/"v1"', 2 * 24 * 60 * 60 * 1000);
    const Registry = await loadRegistry();

    expect(Registry.getGlobal()?.get(NEW_MODEL)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes outside `mastra dev` with MASTRA_AUTO_REFRESH_PRICING=true', async () => {
    vi.stubEnv('MASTRA_DEV', '');
    vi.stubEnv('MASTRA_AUTO_REFRESH_PRICING', 'true');
    const Registry = await loadRegistry();

    expect(Registry.getGlobal()?.get(NEW_MODEL)).toBeNull();
    await vi.waitFor(() => expect(Registry.getGlobal()?.get(NEW_MODEL)?.tiers[0]?.rates.input_tokens).toBe(7e-6));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('gateway pricing', () => {
  const PRIVATE_MODEL = { provider: 'my-provider', model: 'model-1' };
  const PUBLIC_MODEL = { provider: 'openai', model: 'gpt-4o' };

  function gateway(id: string, pricing: Record<string, unknown>, providerId = 'my-provider') {
    return { id, fetchProviders: vi.fn(async () => ({ [providerId]: { pricing } })) };
  }

  async function loadModule(env: Record<string, string> = {}) {
    vi.resetModules();
    // Refresh off (not `mastra dev`) unless a test turns it on; gateway loading on (not offline).
    vi.stubEnv('MASTRA_DEV', '');
    vi.stubEnv('MASTRA_AUTO_REFRESH_PRICING', '');
    vi.stubEnv('MASTRA_OFFLINE', '');
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 500 })),
    );
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    return import('./pricing-registry');
  }

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('prices models that models.dev lacks on the first miss, and never replaces a models.dev price', async () => {
    const { PricingRegistry, setPricingGateways } = await loadModule();
    const publicPrice = PricingRegistry.getGlobal()?.get(PUBLIC_MODEL)?.tiers[0]?.rates.input_tokens;
    expect(publicPrice).toBeGreaterThan(0);

    const custom = gateway('private', {
      'model-1': { input: 0.5, output: 1.5, tiers: [{ tier: { size: 200_000 }, input: 1, output: 3 }] },
    });
    const reseller = gateway('reseller', { 'gpt-4o': { input: 99, output: 99 } }, 'openai');
    await import('@mastra/core/llm'); // warm the loader's import, so a startup load would run within a tick
    setPricingGateways(() => [custom, reseller]);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(custom.fetchProviders).not.toHaveBeenCalled(); // production: nothing is called at startup

    expect(PricingRegistry.getGlobal()?.get(PRIVATE_MODEL)).toBeNull(); // the miss starts the load
    await vi.waitFor(() => expect(PricingRegistry.getGlobal()?.get(PRIVATE_MODEL)).not.toBeNull());
    const priced = PricingRegistry.getGlobal()?.get(PRIVATE_MODEL);
    expect(priced?.tiers[0]?.rates).toEqual({ input_tokens: 0.5e-6, output_tokens: 1.5e-6 });
    expect(priced?.getPricingTierForUsage({ inputTokens: 250_000 })?.rates.input_tokens).toBe(1e-6);
    expect(PricingRegistry.getGlobal()?.get(PUBLIC_MODEL)?.tiers[0]?.rates.input_tokens).toBe(publicPrice);
  });

  it('loads at startup under `mastra dev`, and reads each gateway once across Mastra registrations', async () => {
    const { PricingRegistry, setPricingGateways } = await loadModule({ MASTRA_DEV: 'true' });
    const custom = gateway('private', { 'model-1': { input: 2, output: 4 } });
    setPricingGateways(() => [custom]);
    await vi.waitFor(() => expect(custom.fetchProviders).toHaveBeenCalledTimes(1));
    await vi.waitFor(() =>
      expect(PricingRegistry.getGlobal()?.get(PRIVATE_MODEL)?.tiers[0]?.rates.input_tokens).toBe(2e-6),
    );

    setPricingGateways(() => [custom]);
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(custom.fetchProviders).toHaveBeenCalledTimes(1);
  });

  it('loads a gateway added later on the next miss, and skips the gateways core ships', async () => {
    const { PricingRegistry, setPricingGateways } = await loadModule();
    const builtIns = [
      gateway('models.dev', { 'gpt-4o': { input: 99, output: 99 } }, 'openai'),
      gateway('azure-openai', { 'gpt-4o': { input: 99, output: 99 } }, 'azure'),
    ];
    const first = gateway('first', { 'model-0': { input: 1, output: 1 } });
    const gateways = [...builtIns, first];
    setPricingGateways(() => gateways);
    expect(PricingRegistry.getGlobal()?.get({ provider: 'my-provider', model: 'model-0' })).toBeNull();
    await vi.waitFor(() =>
      expect(PricingRegistry.getGlobal()?.get({ provider: 'my-provider', model: 'model-0' })).not.toBeNull(),
    );
    expect(PricingRegistry.getGlobal()?.get(PRIVATE_MODEL)).toBeNull();

    gateways.push(gateway('private', { 'model-1': { input: 2, output: 4 } }));
    expect(PricingRegistry.getGlobal()?.get(PRIVATE_MODEL)).toBeNull(); // the miss starts the load
    await vi.waitFor(() =>
      expect(PricingRegistry.getGlobal()?.get(PRIVATE_MODEL)?.tiers[0]?.rates.input_tokens).toBe(2e-6),
    );
    for (const builtIn of builtIns) expect(builtIn.fetchProviders).not.toHaveBeenCalled();
  });

  it('warns when a gateway fails to load and retries it at most once an hour', async () => {
    vi.useFakeTimers();
    const { PricingRegistry, setPricingGateways } = await loadModule();
    const broken = gateway('private', { 'model-1': { input: 2, output: 4 } });
    broken.fetchProviders.mockRejectedValueOnce(new Error('down'));
    setPricingGateways(() => [broken]);

    expect(PricingRegistry.getGlobal()?.get(PRIVATE_MODEL)).toBeNull();
    await vi.advanceTimersByTimeAsync(0);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('gateway private'), expect.any(Error));
    expect(PricingRegistry.getGlobal()?.get(PRIVATE_MODEL)).toBeNull();
    await vi.advanceTimersByTimeAsync(0);
    expect(broken.fetchProviders).toHaveBeenCalledTimes(1); // the miss does not retry within the hour

    await vi.advanceTimersByTimeAsync(61 * 60 * 1000);
    expect(PricingRegistry.getGlobal()?.get(PRIVATE_MODEL)).toBeNull();
    await vi.advanceTimersByTimeAsync(0);
    expect(broken.fetchProviders).toHaveBeenCalledTimes(2);
    expect(PricingRegistry.getGlobal()?.get(PRIVATE_MODEL)?.tiers[0]?.rates.input_tokens).toBe(2e-6);
  });

  it('does not call gateways under MASTRA_OFFLINE', async () => {
    const { PricingRegistry, setPricingGateways } = await loadModule({ MASTRA_OFFLINE: 'true' });
    const custom = gateway('private', { 'model-1': { input: 2, output: 4 } });
    setPricingGateways(() => [custom]);
    expect(PricingRegistry.getGlobal()?.get(PRIVATE_MODEL)).toBeNull();
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(custom.fetchProviders).not.toHaveBeenCalled();
  });
});
