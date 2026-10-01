import { describe, expect, it } from 'vitest';
import { MastraCodeGateway } from '../../agents/mastracode-gateway.js';
import type { AuthCredential, CredentialStore } from '../../auth/types.js';
import { opencodeClaudeMaxProvider, promptCacheMiddleware } from '../claude-max.js';

function fakeStore(data: Record<string, AuthCredential>): CredentialStore {
  return {
    reload: () => {},
    get: provider => data[provider],
    getStoredApiKey: provider => {
      const cred = data[provider];
      return cred?.type === 'api_key' ? cred.key : undefined;
    },
    getApiKey: async provider => {
      const cred = data[provider];
      if (!cred) return undefined;
      return cred.type === 'api_key' ? cred.key : cred.access;
    },
  };
}

const oneHourCache = { anthropic: { cacheControl: { type: 'ephemeral', ttl: '1h' } } };

describe('promptCacheMiddleware', () => {
  it('writes 1h cache breakpoints on the last system message and the last prompt message only', async () => {
    const prompt = [
      { role: 'system', content: 'Instructions' },
      { role: 'system', content: 'Memory' },
      { role: 'user', content: [{ type: 'text', text: 'First question' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'First answer' }] },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Earlier part' },
          { type: 'text', text: 'Follow-up' },
        ],
      },
    ];

    const result = await promptCacheMiddleware.transformParams!({ params: { prompt }, type: 'stream' } as any);
    const out = result.prompt as any[];

    expect(out[0].providerOptions).toBeUndefined();
    expect(out[1].providerOptions).toEqual(oneHourCache);
    expect(out[2].content[0].providerOptions).toBeUndefined();
    expect(out[3].content[0].providerOptions).toBeUndefined();
    expect(out[4].content[0].providerOptions).toBeUndefined();
    expect(out[4].content[1].providerOptions).toEqual(oneHourCache);
  });
});

// Observational memory's per-provider `activateAfterIdle` map matches the provider before the
// first `.`. Mastra Code's `anthropic: '1h'` entry only applies if these routes report `anthropic.*`.
describe('Anthropic provider string seen by observational memory', () => {
  it('is anthropic.messages on the API-key route', () => {
    const gateway = new MastraCodeGateway({
      mastraGatewayBaseUrl: 'https://gateway.example.com',
      routeThroughMastraGateway: false,
      credentialStore: fakeStore({ anthropic: { type: 'api_key', key: 'test' } }),
    });

    const model = gateway.resolveLanguageModel({
      providerId: 'anthropic',
      modelId: 'claude-sonnet-4-5',
      apiKey: 'test',
    });

    expect(model.provider).toBe('anthropic.messages');
  });

  it('is anthropic.messages on the OAuth route through the Mastra gateway', () => {
    const gateway = new MastraCodeGateway({
      mastraGatewayBaseUrl: 'https://gateway.example.com',
      routeThroughMastraGateway: true,
      credentialStore: fakeStore({
        anthropic: { type: 'oauth', access: 'access', refresh: 'refresh', expires: Date.now() + 60_000 },
      }),
    });

    const model = gateway.resolveLanguageModel({
      providerId: 'anthropic',
      modelId: 'claude-sonnet-4-5',
      apiKey: 'gateway-key',
    });

    expect(model.provider).toBe('anthropic.messages');
  });

  it('is anthropic.messages from opencodeClaudeMaxProvider (test-env branch; production uses the same createAnthropic name)', () => {
    const model = opencodeClaudeMaxProvider('claude-sonnet-4-5') as { provider: string };

    expect(model.provider).toBe('anthropic.messages');
  });
});
