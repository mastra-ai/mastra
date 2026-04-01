import type { MastraModelGateway, ProviderConfig } from '@mastra/core/llm';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchProvidersFromGateways, generateTypesContent } from '../gateway-sync.js';

function createGateway(
  id: string,
  providers: Record<string, ProviderConfig>,
  shouldEnable = true,
): MastraModelGateway {
  return {
    id,
    name: id,
    shouldEnable: vi.fn().mockReturnValue(shouldEnable),
    fetchProviders: vi.fn().mockResolvedValue(providers),
    supportsModel: vi.fn(),
    createModel: vi.fn(),
  } as unknown as MastraModelGateway;
}

describe('gateway-sync', () => {
  const originalMastraGatewayApiKey = process.env.MASTRA_GATEWAY_API_KEY;

  afterEach(() => {
    if (originalMastraGatewayApiKey === undefined) {
      delete process.env.MASTRA_GATEWAY_API_KEY;
      return;
    }

    process.env.MASTRA_GATEWAY_API_KEY = originalMastraGatewayApiKey;
  });

  it('prefixes gateway providers and includes mastra gateway models', async () => {
    process.env.MASTRA_GATEWAY_API_KEY = 'test-key';
    const modelsDev = createGateway('models.dev', {
      openai: {
        name: 'OpenAI',
        gateway: 'models.dev',
        apiKeyEnvVar: 'OPENAI_API_KEY',
        models: ['gpt-4.1'],
      },
    });
    const netlify = createGateway('netlify', {
      xai: {
        name: 'xAI',
        gateway: 'netlify',
        apiKeyEnvVar: 'NETLIFY_API_KEY',
        models: ['grok-3-mini'],
      },
    });
    const mastra = createGateway('mastra', {
      google: {
        name: 'Google',
        gateway: 'mastra',
        apiKeyEnvVar: 'MASTRA_GATEWAY_API_KEY',
        models: ['gemini-2.5-flash'],
      },
    });

    const { providers, models } = await fetchProvidersFromGateways([modelsDev, netlify, mastra]);

    expect(providers.openai).toBeDefined();
    expect(providers['netlify/xai']).toBeDefined();
    expect(providers['mastra/google']).toBeDefined();
    expect(models['mastra/google']).toEqual(['gemini-2.5-flash']);
  });

  it('skips mastra gateway providers when MASTRA_GATEWAY_API_KEY is not set', async () => {
    delete process.env.MASTRA_GATEWAY_API_KEY;

    const modelsDev = createGateway('models.dev', {
      openai: {
        name: 'OpenAI',
        gateway: 'models.dev',
        apiKeyEnvVar: 'OPENAI_API_KEY',
        models: ['gpt-4.1'],
      },
    });
    const netlify = createGateway('netlify', {
      xai: {
        name: 'xAI',
        gateway: 'netlify',
        apiKeyEnvVar: 'NETLIFY_API_KEY',
        models: ['grok-3-mini'],
      },
    });

    const mastra = createGateway('mastra', {}, false);

    const { providers } = await fetchProvidersFromGateways([modelsDev, netlify, mastra]);

    expect(providers.openai).toBeDefined();
    expect(providers['netlify/xai']).toBeDefined();
    expect(providers['mastra']).toBeUndefined();
  });

  it('generates types for quoted gateway provider ids', () => {
    const content = generateTypesContent({
      'mastra/google': ['gemini-2.5-flash'],
    });

    expect(content).toContain("readonly 'mastra/google': readonly ['gemini-2.5-flash'];");
    expect(content).toContain("[P in Provider]: `${P}/${ProviderModelsMap[P][number]}`;");
  });
});
