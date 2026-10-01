import { afterEach, describe, expect, it, vi } from 'vitest';
import { MastraCodeGateway } from '../../agents/mastracode-gateway.js';
import type { AuthCredential, CredentialStore } from '../../auth/types.js';
import { createPromptCacheMiddleware, opencodeClaudeMaxProvider } from '../claude-max.js';

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
const fiveMinuteCache = { anthropic: { cacheControl: { type: 'ephemeral', ttl: '5m' } } };

const conversationPrompt = () => [
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

describe('createPromptCacheMiddleware', () => {
  it('conversation scope writes 1h breakpoints on the last system message and the last prompt message only', async () => {
    const result = await createPromptCacheMiddleware('conversation').transformParams!({
      params: { prompt: conversationPrompt() },
      type: 'stream',
    } as any);
    const out = result.prompt as any[];

    expect(out[0].providerOptions).toBeUndefined();
    expect(out[1].providerOptions).toEqual(oneHourCache);
    expect(out[2].content[0].providerOptions).toBeUndefined();
    expect(out[3].content[0].providerOptions).toBeUndefined();
    expect(out[4].content[0].providerOptions).toBeUndefined();
    expect(out[4].content[1].providerOptions).toEqual(oneHourCache);
  });

  it('system scope writes one 5m breakpoint on the last system message and leaves the messages uncached', async () => {
    const result = await createPromptCacheMiddleware('system').transformParams!({
      params: { prompt: conversationPrompt() },
      type: 'generate',
    } as any);
    const out = result.prompt as any[];

    expect(out[0].providerOptions).toBeUndefined();
    expect(out[1].providerOptions).toEqual(fiveMinuteCache);
    for (const message of out.slice(2)) {
      for (const part of message.content) expect(part.providerOptions).toBeUndefined();
    }
  });
});

// What actually reaches Anthropic on the API-key route, per gateway scope.
describe('cache_control sent by the API-key route', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function sentCacheControls(anthropicPromptCacheScope?: 'conversation' | 'system') {
    const bodies: any[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)));
        return new Response(
          JSON.stringify({
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            model: 'claude-haiku-4-5',
            content: [{ type: 'text', text: 'ok' }],
            stop_reason: 'end_turn',
            stop_sequence: null,
            usage: { input_tokens: 1, output_tokens: 1 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }),
    );

    const gateway = new MastraCodeGateway({
      mastraGatewayBaseUrl: 'https://gateway.example.com',
      routeThroughMastraGateway: false,
      anthropicPromptCacheScope,
      credentialStore: fakeStore({ anthropic: { type: 'api_key', key: 'test' } }),
    });
    const model = gateway.resolveLanguageModel({
      providerId: 'anthropic',
      modelId: 'claude-haiku-4-5',
      apiKey: 'test',
    });

    await (model as any).doGenerate({
      prompt: [
        { role: 'system', content: 'Observer instructions' },
        { role: 'user', content: [{ type: 'text', text: 'Messages to observe' }] },
      ],
    });

    expect(bodies).toHaveLength(1);
    return JSON.stringify(bodies[0]).match(/"cache_control":\{[^}]*\}/g);
  }

  it('sends two 1h breakpoints by default', async () => {
    expect(await sentCacheControls()).toEqual([
      '"cache_control":{"type":"ephemeral","ttl":"1h"}',
      '"cache_control":{"type":"ephemeral","ttl":"1h"}',
    ]);
  });

  it('sends one 5m breakpoint with the system scope', async () => {
    expect(await sentCacheControls('system')).toEqual(['"cache_control":{"type":"ephemeral","ttl":"5m"}']);
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
