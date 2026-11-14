import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GatewayLanguageModel, MastraModelGatewayInterface, ProviderConfig } from './gateways/base.js';
import { gatewayServesObservationalMemory } from './gateways/mastra.js';
import { ModelRouterLanguageModel } from './router.js';

/**
 * The Mastra gateway only serves Observational Memory for Gateway project keys
 * (`msk_…`). Organization keys (`msk-gateway-…`, `mskv2_…`) are served by a
 * gateway without the memory API, so memory has to stay local — and a model that
 * isn't on the gateway at all is never gateway-managed.
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

  it('reports false without throwing when the gateway credential cannot be resolved', async () => {
    const throwing = createGateway('mastra', {
      getApiKey: async () => {
        throw new Error('credential unavailable');
      },
    });
    const router = new ModelRouterLanguageModel('mastra/openai/gpt-4o', [throwing]);

    expect(router.gatewayId).toBe('mastra');
    await expect(router.isGatewayMemoryManaged()).resolves.toBe(false);
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
