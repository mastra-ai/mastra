import { openai } from '@ai-sdk/openai-v5';
import {
  AzureOpenAIGateway,
  MastraGateway,
  ModelRouterLanguageModel,
  NetlifyGateway,
  PROVIDER_REGISTRY,
} from '@mastra/core/llm';
import type { MastraModelGatewayInterface } from '@mastra/core/llm';
import { Mastra } from '@mastra/core/mastra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildProvidersList, isModelUsable } from './provider-catalog';

function createKeyedGateway(id: string, providerId: string, apiKeyEnvVar: string): MastraModelGatewayInterface {
  return {
    id,
    name: id,
    fetchProviders: async () => ({
      [providerId]: { name: providerId, models: ['model-a'], apiKeyEnvVar, gateway: id },
    }),
    buildUrl: () => undefined,
    getApiKey: async () => process.env[apiKeyEnvVar] ?? '',
    resolveLanguageModel: () => openai('gpt-4.1'),
  };
}

function createOAuthGateway(handledProvider: string): MastraModelGatewayInterface {
  return {
    id: 'oauth-gateway',
    name: 'OAuth Gateway',
    handlesModel: modelId => modelId.startsWith(`${handledProvider}/`),
    hasProviderCredentials: providerId => providerId === handledProvider || providerId === 'github-copilot',
    resolveAuth: () => ({ bearerToken: 'oauth-token', source: 'gateway' }),
    fetchProviders: async () => ({
      'github-copilot': { name: 'GitHub Copilot', models: ['gpt-4.1'], apiKeyEnvVar: '', gateway: 'oauth-gateway' },
    }),
    buildUrl: () => undefined,
    getApiKey: async () => '',
    resolveLanguageModel: () => openai('gpt-4.1'),
  };
}

function createBrokenGateway(): MastraModelGatewayInterface {
  return {
    ...createKeyedGateway('broken', 'broken-llm', 'BROKEN_API_KEY'),
    hasProviderCredentials: () => {
      throw new Error('credential store failed');
    },
  };
}

function createMastra(gateways?: Record<string, MastraModelGatewayInterface>) {
  return new Mastra({ logger: false, gateways });
}

async function findProvider(mastra: Mastra, id: string) {
  return (await buildProvidersList(mastra)).find(provider => provider.id === id);
}

beforeEach(() => {
  vi.spyOn(NetlifyGateway.prototype, 'fetchProviders').mockResolvedValue({});
  for (const key of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY']) {
    vi.stubEnv(key, '');
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('buildProvidersList', () => {
  it('reads credentials once for a large catalog without resolving model auth', async () => {
    vi.stubEnv('AUTO_BLOCK_EXTERNAL_PROVIDERS', 'true');
    const models = Array.from({ length: 10000 }, (_, index) => `model-${index}`);
    const hasProviderCredentials = vi.fn(() => true);
    const getApiKey = vi.fn(async () => {
      throw new Error('Must not exchange tokens');
    });
    const resolveAuth = vi.fn(() => {
      throw new Error('Must not resolve model auth');
    });
    const gateway = {
      ...createKeyedGateway('acme', 'acme', ''),
      fetchProviders: async () => ({ acme: { name: 'Acme', models, apiKeyEnvVar: '', gateway: 'acme' } }),
      hasProviderCredentials,
      getApiKey,
      resolveAuth,
    };

    const provider = await findProvider(createMastra({ acme: gateway }), 'acme');

    expect(provider).toMatchObject({ connected: true, models });
    expect(provider).not.toHaveProperty('connectedModels');
    expect(hasProviderCredentials).toHaveBeenCalledExactlyOnceWith('acme');
    expect(getApiKey).not.toHaveBeenCalled();
    expect(resolveAuth).not.toHaveBeenCalled();
  });

  it('reads current credentials on each request without caching connection status', async () => {
    let signedIn = false;
    const gateway = {
      ...createOAuthGateway('openai'),
      hasProviderCredentials: (providerId: string) => providerId === 'openai' && signedIn,
    };
    const mastra = createMastra({ oauth: gateway });

    expect((await findProvider(mastra, 'openai'))?.connected).toBe(false);
    signedIn = true;
    expect((await findProvider(mastra, 'openai'))?.connected).toBe(true);
    signedIn = false;
    expect((await findProvider(mastra, 'openai'))?.connected).toBe(false);
  });

  it('recognizes constructor credentials without fetching an access token', async () => {
    const getToken = vi.fn();
    const mastra = createMastra({
      mastra: new MastraGateway({ apiKey: 'configured-key' }),
      azure: new AzureOpenAIGateway({
        resourceName: 'test-resource',
        deployments: ['deployment'],
        authentication: { type: 'entraId', credential: { getToken } },
      }),
    });

    const providers = await buildProvidersList(mastra);
    expect(providers.find(provider => provider.id === 'mastra')?.connected).toBe(true);
    expect(providers.find(provider => provider.id === 'azure-openai')?.connected).toBe(true);
    expect(getToken).not.toHaveBeenCalled();
  });

  it('lists every registry provider with its env var and models', async () => {
    const providers = await buildProvidersList(createMastra());

    expect(providers).toHaveLength(Object.keys(PROVIDER_REGISTRY).length);
    const openaiProvider = providers.find(provider => provider.id === 'openai');
    expect(openaiProvider?.envVar).toBe('OPENAI_API_KEY');
    expect(openaiProvider?.models).toContain('gpt-4');
  });

  it('marks a registry provider connected from its env var', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    const mastra = createMastra();

    expect((await findProvider(mastra, 'openai'))?.connected).toBe(true);
    expect((await findProvider(mastra, 'anthropic'))?.connected).toBe(false);
  });

  it('accepts either Google key, they are aliases of one credential', async () => {
    const mastra = createMastra();
    expect((await findProvider(mastra, 'google'))?.connected).toBe(false);

    vi.stubEnv('GOOGLE_API_KEY', 'test-key');
    expect((await findProvider(mastra, 'google'))?.connected).toBe(true);

    vi.stubEnv('GOOGLE_API_KEY', '');
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'test-key');
    expect((await findProvider(mastra, 'google'))?.connected).toBe(true);
  });

  it('lists a custom gateway provider under its prefix and resolves its key through that gateway', async () => {
    const mastra = createMastra({ acme: createKeyedGateway('acme', 'acme-openai', 'ACME_OPENAI_API_KEY') });

    const disconnected = await findProvider(mastra, 'acme/acme-openai');
    expect(disconnected).toMatchObject({ name: 'acme-openai', models: ['model-a'], connected: false });

    vi.stubEnv('ACME_OPENAI_API_KEY', 'test-key');
    expect((await findProvider(mastra, 'acme/acme-openai'))?.connected).toBe(true);
  });

  it('shows a registry provider connected when a registered gateway authenticates it without an env var', async () => {
    const mastra = createMastra({ 'oauth-gateway': createOAuthGateway('openai') });

    expect((await findProvider(mastra, 'openai'))?.connected).toBe(true);
    expect((await findProvider(mastra, 'oauth-gateway/github-copilot'))?.connected).toBe(true);
    expect((await findProvider(mastra, 'anthropic'))?.connected).toBe(false);
  });

  it('keeps the rest of the catalog when one gateway fails to read credentials', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    const mastra = createMastra({ broken: createBrokenGateway(), oauth: createOAuthGateway('anthropic') });

    const providers = await buildProvidersList(mastra);

    expect(providers.find(provider => provider.id === 'broken/broken-llm')?.connected).toBe(false);
    expect(providers.find(provider => provider.id === 'openai')?.connected).toBe(true);
    expect(providers.find(provider => provider.id === 'anthropic')?.connected).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('provider "broken-llm"'), expect.any(Error));
  });

  it('hides the registry and the default gateways when AUTO_BLOCK_EXTERNAL_PROVIDERS is set', async () => {
    vi.stubEnv('AUTO_BLOCK_EXTERNAL_PROVIDERS', 'true');
    const mastra = createMastra({ acme: createKeyedGateway('acme', 'acme-openai', 'ACME_OPENAI_API_KEY') });

    const providers = await buildProvidersList(mastra);

    expect(providers.map(provider => provider.id)).toEqual(['acme/acme-openai']);
  });

  it('returns nothing when external providers are blocked and no custom gateway is registered', async () => {
    vi.stubEnv('AUTO_BLOCK_EXTERNAL_PROVIDERS', '1');

    expect(await buildProvidersList(createMastra())).toEqual([]);
  });
});

describe('isModelUsable', () => {
  it('lets a router model answer through the gateway chain its calls use', async () => {
    const mastra = createMastra({
      'oauth-gateway': createOAuthGateway('openai'),
      acme: createKeyedGateway('acme', 'acme-openai', 'ACME_OPENAI_API_KEY'),
    });
    const gateways = Object.values(mastra.listGateways() ?? {});
    const oauthModel = new ModelRouterLanguageModel('openai/gpt-4.1', gateways);
    const prefixedModel = new ModelRouterLanguageModel('acme/acme-openai/model-a', gateways);
    const keylessModel = new ModelRouterLanguageModel('anthropic/claude-sonnet-4-5', gateways);

    expect(await isModelUsable(oauthModel)).toBe(true);
    expect(await isModelUsable(prefixedModel)).toBe(false);
    expect(await isModelUsable(keylessModel)).toBe(false);

    vi.stubEnv('ACME_OPENAI_API_KEY', 'test-key');
    expect(await isModelUsable(prefixedModel)).toBe(true);
  });

  it('strips the AI SDK provider suffix before asking the registry', async () => {
    const model = openai('gpt-4.1');
    expect(model.provider).not.toBe('openai');

    expect(await isModelUsable(model)).toBe(false);

    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    expect(await isModelUsable(model)).toBe(true);
  });

  it('never collapses Vertex onto the Google AI Studio key', async () => {
    const vertexModel = { provider: 'google.vertex.chat', modelId: 'gemini-2.5-pro' };
    vi.stubEnv('GOOGLE_API_KEY', 'test-key');

    expect(await isModelUsable(vertexModel)).toBe(false);

    vi.stubEnv('GOOGLE_VERTEX_PROJECT', 'my-project');
    vi.stubEnv('GOOGLE_VERTEX_LOCATION', 'us-central1');
    expect(await isModelUsable(vertexModel)).toBe(true);
  });
});
