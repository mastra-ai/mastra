import { findGatewayForModel, getGatewayId, ModelsDevGateway } from '@mastra/core/llm';
import { describe, expect, it, vi } from 'vitest';
import { MastraCodeGateway } from '../../agents/mastracode-gateway.js';
import type { CredentialStore } from '../../auth/types.js';
import { GitHubCopilotGateway } from '../github-copilot-gateway.js';

vi.mock('../github-copilot.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../github-copilot.js')>()),
  getCopilotModelCatalog: vi.fn(async () => [{ id: 'gpt-4.1' }, { id: 'claude-sonnet-4' }]),
}));

function oauthStore(providerIds: string[]): CredentialStore {
  return {
    allowEnvironmentFallback: false,
    reload() {},
    get: providerId =>
      providerIds.includes(providerId)
        ? { type: 'oauth', access: 'token', refresh: 'refresh', expires: Date.now() + 60_000 }
        : undefined,
    getStoredApiKey: () => undefined,
    getApiKey: async () => 'token',
  };
}

describe('GitHubCopilotGateway', () => {
  it('lists Copilot under its own gateway id so catalog ids are github-copilot/<model>', async () => {
    const gateway = new GitHubCopilotGateway({ credentialStore: oauthStore(['github-copilot']) });

    expect(gateway.id).toBe('github-copilot');
    const providers = await gateway.fetchProviders();
    expect(Object.keys(providers)).toEqual(['github-copilot']);
    expect(providers['github-copilot']?.models).toEqual(['gpt-4.1', 'claude-sonnet-4']);
  });

  it('reports auth only when a Copilot login exists', () => {
    const request = { gatewayId: 'github-copilot', providerId: 'github-copilot', modelId: 'gpt-4.1', routerId: 'x' };

    expect(new GitHubCopilotGateway({ credentialStore: oauthStore(['github-copilot']) }).resolveAuth(request)).toEqual({
      bearerToken: 'oauth',
      source: 'gateway',
    });
    expect(new GitHubCopilotGateway({ credentialStore: oauthStore([]) }).resolveAuth(request)).toBeUndefined();
  });
});

describe('Mastra Code gateway routing', () => {
  const credentialStore = oauthStore(['github-copilot', 'kimi-for-coding']);
  const gateways = [
    new GitHubCopilotGateway({ credentialStore }),
    new MastraCodeGateway({
      mastraGatewayBaseUrl: 'https://gateway-api.mastra.ai',
      routeThroughMastraGateway: false,
      customProviders: [],
      credentialStore,
    }),
    new ModelsDevGateway(),
  ];

  it.each([
    ['github-copilot/gpt-4.1', 'github-copilot'],
    ['kimi-code-plan-cn/k3', 'mastracode'],
    ['mastracode/kimi-for-coding/k3', 'mastracode'],
    ['mastracode/github-copilot/gpt-4.1', 'mastracode'],
  ])('routes %s through the %s gateway', (modelId, gatewayId) => {
    expect(getGatewayId(findGatewayForModel(modelId, gateways))).toBe(gatewayId);
  });

  it('claims the models.dev Kimi provider with the Kimi For Coding login', () => {
    const mastraCode = gateways[1] as MastraCodeGateway;

    expect(mastraCode.handlesModel('kimi-code-plan-cn/k3')).toBe(true);
    expect(mastraCode.handlesModel('kimi-code-plan-global/k3')).toBe(false);
  });
});
