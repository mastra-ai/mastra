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

  function writeCache(rows: unknown[], etag: string, ageMs: number): void {
    fs.mkdirSync(path.dirname(cacheFile()), { recursive: true });
    fs.writeFileSync(cacheFile(), JSON.stringify({ etag, rows }));
    const mtime = new Date(Date.now() - ageMs);
    fs.utimesSync(cacheFile(), mtime, mtime);
  }

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'mastra-pricing-'));
    vi.stubEnv('HOME', home);
    vi.stubEnv('USERPROFILE', home);
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
    await vi.waitFor(() => expect(JSON.parse(fs.readFileSync(cacheFile(), 'utf-8')).etag).toBe('W/"v2"'));
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

  it('refreshes once per missing model, and at most once an hour', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    writeCache(modelsDevToPricingRows(catalog()), 'W/"v1"', 0);
    const Registry = await loadRegistry();
    const registry = Registry.getGlobal()!;

    registry.get({ provider: 'openai', model: 'missing-a' });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(Registry.getGlobal()).not.toBe(registry));

    const refreshed = Registry.getGlobal()!;
    refreshed.get({ provider: 'openai', model: 'missing-a' });
    refreshed.get({ provider: 'openai', model: 'missing-b' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + 61 * 60 * 1000);
    refreshed.get({ provider: 'openai', model: 'missing-a' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    refreshed.get({ provider: 'openai', model: 'missing-b' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
    ['MASTRA_OFFLINE', 'true'],
    ['MASTRA_AUTO_REFRESH_PRICING', 'false'],
  ])('uses only the bundled snapshot when %s=%s', async (name, value) => {
    vi.stubEnv(name, value);
    writeCache(modelsDevToPricingRows(catalog()), 'W/"v1"', 2 * 24 * 60 * 60 * 1000);
    const Registry = await loadRegistry();

    expect(Registry.getGlobal()?.get(NEW_MODEL)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
