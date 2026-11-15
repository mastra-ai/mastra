import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GatewayLanguageModel, MastraModelGatewayInterface, ProviderConfig } from './gateways/base.js';
import { gatewayServesObservationalMemory } from './gateways/mastra.js';
import { ModelRouterLanguageModel } from './router.js';

/**
 * The Mastra gateway only serves Observational Memory for Gateway project keys
 * (`msk_…`). Organization keys (`msk-gateway-…`, `mskv2_…`) are served by a
 * gateway without the memory API, so memory has to stay local — and a model that
 * isn't on the gateway at all is never gateway-managed.
 *
 * A credential the gateway cannot resolve is not read as local ownership: only a
 * missing credential reports `false`, and any other lookup failure is thrown, so a
 * failed lookup can never make the gateway and the local store both save the thread.
 */
describe('ModelRouterLanguageModel.isGatewayMemoryManaged', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    (ModelRouterLanguageModel as unknown as { _clearCachesForTests?: () => void })._clearCachesForTests?.();
  });

  it('reports true for a Gateway project key from the environment', async () => {
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'msk_live_project_key');
    const router = new ModelRouterLanguageModel('mastra/openai/gpt-4o');

    expect(router.gatewayId).toBe('mastra');
    expect(await router.isGatewayMemoryManaged()).toBe(true);
  });

  it('reports false for a Gateway organization key', async () => {
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'msk-gateway-eu_current');
    expect(await new ModelRouterLanguageModel('mastra/openai/gpt-4o').isGatewayMemoryManaged()).toBe(false);

    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'mskv2_current');
    expect(await new ModelRouterLanguageModel('mastra/openai/gpt-4o').isGatewayMemoryManaged()).toBe(false);
  });

  it('lets an explicit per-model key decide over the environment', async () => {
    // Environment says "gateway serves memory"; the model's own key says it does not.
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'msk_live_project_key');
    const v2 = new ModelRouterLanguageModel({ id: 'mastra/openai/gpt-4o', apiKey: 'mskv2_current' });
    expect(await v2.isGatewayMemoryManaged()).toBe(false);

    // And the other way around.
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'mskv2_current');
    const v1 = new ModelRouterLanguageModel({ id: 'mastra/openai/gpt-4o', apiKey: 'msk_live_project_key' });
    expect(await v1.isGatewayMemoryManaged()).toBe(true);
  });

  it('reports false for a model served by another gateway', async () => {
    const router = new ModelRouterLanguageModel('acme/openai/gpt-4o', [createGateway('acme')]);
    expect(router.gatewayId).toBe('acme');
    expect(await router.isGatewayMemoryManaged()).toBe(false);
  });

  it('reports false when the gateway has no credential configured', async () => {
    const missing = createGateway('mastra', {
      getApiKey: async () => {
        throw new Error('Missing MASTRA_GATEWAY_API_KEY environment variable');
      },
    });
    const router = new ModelRouterLanguageModel('mastra/openai/gpt-4o', [missing]);

    // A missing credential keeps memory local — the model call reports the same error.
    expect(router.gatewayId).toBe('mastra');
    await expect(router.isGatewayMemoryManaged()).resolves.toBe(false);
  });

  it('surfaces a failed credential lookup instead of reporting local ownership', async () => {
    const failing = createGateway('mastra', {
      getApiKey: async () => {
        throw new Error('gateway auth hook failed');
      },
    });
    const router = new ModelRouterLanguageModel('mastra/openai/gpt-4o', [failing]);

    // Anything but a missing credential has to surface: reporting "local" here would store the
    // same thread twice, because the model call resolves this credential through the same path.
    expect(router.gatewayId).toBe('mastra');
    await expect(router.isGatewayMemoryManaged()).rejects.toThrow('gateway auth hook failed');
  });

  it('reports the resolved key when a lookup fails before succeeding', async () => {
    let lookups = 0;
    const flaky = createGateway('mastra', {
      getApiKey: async () => {
        lookups += 1;
        if (lookups === 1) throw new Error('gateway auth hook failed');
        return 'msk_live_project_key';
      },
    });
    const router = new ModelRouterLanguageModel('mastra/openai/gpt-4o', [flaky]);

    // The failure is not remembered as "local" for the next step.
    await expect(router.isGatewayMemoryManaged()).rejects.toThrow('gateway auth hook failed');
    await expect(router.isGatewayMemoryManaged()).resolves.toBe(true);
  });
});

describe('gatewayServesObservationalMemory', () => {
  it('accepts Gateway project keys', () => {
    expect(gatewayServesObservationalMemory('msk_live_project_key')).toBe(true);
  });

  it('rejects Gateway organization keys', () => {
    expect(gatewayServesObservationalMemory('msk-gateway-eu_current')).toBe(false);
    expect(gatewayServesObservationalMemory('mskv2_current')).toBe(false);
  });

  it('rejects missing or unrelated keys', () => {
    expect(gatewayServesObservationalMemory(undefined)).toBe(false);
    expect(gatewayServesObservationalMemory('')).toBe(false);
    expect(gatewayServesObservationalMemory('sk-openai-key')).toBe(false);
  });
});

function createGateway(id: string, overrides: Partial<MastraModelGatewayInterface> = {}): MastraModelGatewayInterface {
  return {
    id,
    name: id,
    fetchProviders: vi.fn(async (): Promise<Record<string, ProviderConfig>> => ({})),
    buildUrl: vi.fn(() => 'https://api.example.com/v1'),
    getApiKey: vi.fn(async () => 'key'),
    resolveLanguageModel: vi.fn(
      ({ providerId, modelId }) =>
        ({
          specificationVersion: 'v2',
          provider: providerId,
          modelId,
          supportedUrls: {},
          doGenerate: vi.fn(),
          doStream: vi.fn(async () => ({ stream: new ReadableStream() })),
        }) as GatewayLanguageModel,
    ),
    ...overrides,
  } satisfies MastraModelGatewayInterface;
}
