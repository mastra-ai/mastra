import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GatewayLanguageModel, MastraModelGatewayInterface, ProviderConfig } from './gateways/base.js';
import { ModelRouterLanguageModel } from './router.js';

function createOAuthGateway(): MastraModelGatewayInterface {
  return {
    id: 'oauth-gateway',
    name: 'OAuth Gateway',
    handlesModel: (modelId: string) => modelId.startsWith('openai/'),
    resolveAuth: () => ({ bearerToken: 'oauth-token', source: 'gateway' }),
    fetchProviders: async (): Promise<Record<string, ProviderConfig>> => ({}),
    buildUrl: () => undefined,
    getApiKey: async () => '',
    resolveLanguageModel: () => ({}) as GatewayLanguageModel,
  };
}

describe('ModelRouterLanguageModel.hasAuth', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is true with an explicit apiKey even when nothing else can authenticate', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const model = new ModelRouterLanguageModel({ id: 'openai/gpt-4.1', apiKey: 'sk-explicit' });
    await expect(model.hasAuth()).resolves.toBe(true);
  });

  it('asks the gateway chain the call itself will use', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    await expect(new ModelRouterLanguageModel('openai/gpt-4.1').hasAuth()).resolves.toBe(false);
    await expect(new ModelRouterLanguageModel('openai/gpt-4.1', [createOAuthGateway()]).hasAuth()).resolves.toBe(true);
  });
});
