import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MIN_MODELS_DEV_PRICING_ROWS, modelsDevToPricingRows } from './models-dev';
import { PricingRegistry } from './pricing-registry';
import type { MinifiedPricingModelRow } from './pricing-registry';

const NEW_MODEL = { provider: 'openai', model: 'brand-new-model' };

/** A models.dev payload big enough to pass validation, with one model the bundled snapshot does not have. */
function catalog(newModelInput = 7): Record<string, unknown> {
  const models: Record<string, unknown> = { 'brand-new-model': { cost: { input: newModelInput, output: 21 } } };
  for (let i = 0; i < MIN_MODELS_DEV_PRICING_ROWS; i++) {
    models[`filler-${i}`] = { cost: { input: 1, output: 2 } };
  }
  return { openai: { models } };
}

// The bot regenerates the snapshot from models.dev without CI, so this checks its shape, not specific models.
describe('PricingRegistry bundled snapshot', () => {
  it('has enough models, each with input and output prices', () => {
    const text = fs.readFileSync(path.join(import.meta.dirname, 'pricing-data.jsonl'), 'utf-8');
    const rows = text
      .trim()
      .split('\n')
      .map(line => JSON.parse(line) as MinifiedPricingModelRow);

    expect(rows.length).toBeGreaterThanOrEqual(MIN_MODELS_DEV_PRICING_ROWS);
    expect(rows.filter(row => !(row.s.d.t[0]!.r.it!.c > 0 && row.s.d.t[0]!.r.ot!.c > 0))).toEqual([]);
    expect(() => PricingRegistry.fromText(text)).not.toThrow();
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

  function writeCache(rows: unknown[], etag: string, ageMs: number, version = 1): void {
    fs.mkdirSync(path.dirname(cacheFile()), { recursive: true });
    fs.writeFileSync(cacheFile(), JSON.stringify({ version, etag, rows }));
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
    writeCache(modelsDevToPricingRows(catalog(9)), 'W/"v1"', 0, 2);
    const Registry = await loadRegistry();

    expect(Registry.getGlobal()?.get(NEW_MODEL)).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://models.dev/api.json',
      expect.objectContaining({ headers: undefined }),
    );
    await vi.waitFor(() => expect(Registry.getGlobal()?.get(NEW_MODEL)?.tiers[0]?.rates.input_tokens).toBe(7e-6));
  });

  it('starts from a stale cache and revalidates it with its ETag', async () => {
    writeCache(modelsDevToPricingRows(catalog(9)), 'W/"v1"', 2 * 24 * 60 * 60 * 1000);
    fetchMock.mockImplementation(async () => new Response(null, { status: 304 }));
    const Registry = await loadRegistry();

    expect(Registry.getGlobal()?.get(NEW_MODEL)?.tiers[0]?.rates.input_tokens).toBe(9e-6);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://models.dev/api.json',
      expect.objectContaining({ headers: { 'if-none-match': 'W/"v1"' } }),
    );
    await vi.waitFor(() => expect(Date.now() - fs.statSync(cacheFile()).mtimeMs).toBeLessThan(60_000));
  });

  it('does not refresh a fresh cache until a model has no price', async () => {
    writeCache(modelsDevToPricingRows(catalog()), 'W/"v1"', 0);
    const Registry = await loadRegistry();

    expect(Registry.getGlobal()?.get(NEW_MODEL)).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    expect(Registry.getGlobal()?.get({ provider: 'openai', model: 'not-on-models-dev' })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes on a missing model at most once an hour, even if the last refresh failed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    writeCache(modelsDevToPricingRows(catalog()), 'W/"v1"', 0);
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
    writeCache(modelsDevToPricingRows(catalog()), 'W/"v1"', 2 * 24 * 60 * 60 * 1000);
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
