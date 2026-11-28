import { MessageList } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import {
  OBSERVATION_CONTEXT_PROMPT,
  OBSERVATION_CONTEXT_PROMPT_THREAD,
  ObservationalMemory,
} from '@mastra/memory/processors';
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

// Observational memory adds its context as the last system messages: a preamble, then the
// observations. When memory rewrites them, a breakpoint on the last system message alone
// matches nothing, so Anthropic reads none of the unchanged instructions in front of them.
const memoryPrompt = (observations: string, preamble = OBSERVATION_CONTEXT_PROMPT_THREAD) => [
  { role: 'system', content: 'Instructions' },
  { role: 'system', content: 'Skills' },
  { role: 'system', content: `${preamble}\n\nIMPORTANT: reference these observations.` },
  { role: 'system', content: '<observations>' },
  { role: 'system', content: observations },
  { role: 'system', content: '</observations>' },
  { role: 'user', content: [{ type: 'text', text: 'Next question' }] },
];

const cachedIndexes = (prompt: any[]) =>
  prompt.flatMap((message, index) => {
    const parts = typeof message.content === 'string' ? [message] : message.content;
    return parts.some((part: any) => part.providerOptions?.anthropic?.cacheControl) ? [index] : [];
  });

describe('createPromptCacheMiddleware with observational memory', () => {
  it('also marks the last system message before memory context, so a memory rewrite keeps the instructions cached', async () => {
    const result = await createPromptCacheMiddleware('conversation').transformParams!({
      params: { prompt: memoryPrompt('- user likes tea') },
      type: 'stream',
    } as any);
    const out = result.prompt as any[];

    expect(cachedIndexes(out)).toEqual([1, 5, 6]);
    expect(out[1].providerOptions).toEqual(oneHourCache);
  });

  it('recognises resource-scoped memory context too', async () => {
    const result = await createPromptCacheMiddleware('system').transformParams!({
      params: { prompt: memoryPrompt('- user likes tea', OBSERVATION_CONTEXT_PROMPT) },
      type: 'generate',
    } as any);
    const out = result.prompt as any[];

    expect(cachedIndexes(out)).toEqual([1, 5]);
    expect(out[1].providerOptions).toEqual(fiveMinuteCache);
  });

  it('adds nothing when memory context is the first system message', async () => {
    const result = await createPromptCacheMiddleware('conversation').transformParams!({
      params: { prompt: memoryPrompt('- user likes tea').slice(2) },
      type: 'stream',
    } as any);

    expect(cachedIndexes(result.prompt as any[])).toEqual([3, 4]);
  });
});

const routes = {
  'API-key route': {
    routeThroughMastraGateway: false,
    credential: { type: 'api_key', key: 'test' },
    url: 'https://api.anthropic.com/v1/messages',
  },
  'OAuth route through the Mastra gateway': {
    routeThroughMastraGateway: true,
    credential: { type: 'oauth', access: 'access', refresh: 'refresh', expires: Date.now() + 60 * 60_000 },
    url: 'https://gateway.example.com/v1/messages',
  },
} satisfies Record<string, { routeThroughMastraGateway: boolean; credential: AuthCredential; url: string }>;

// What actually reaches the wire, per route and gateway scope.
describe.each(Object.entries(routes))('cache_control sent by the %s', (_name, route) => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function sentCacheControls(anthropicPromptCacheScope?: 'conversation' | 'system') {
    const bodies: any[] = [];
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL, init: RequestInit) => {
        urls.push(String(url));
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
      routeThroughMastraGateway: route.routeThroughMastraGateway,
      anthropicPromptCacheScope,
      credentialStore: fakeStore({ anthropic: route.credential }),
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

    expect(urls).toEqual([route.url]);
    expect(bodies).toHaveLength(1);
    return JSON.stringify(bodies[0]).match(/"cache_control":\{[^}]*\}/g);
  }

  async function sentBodies(prompts: any[][]) {
    const bodies: any[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL, init: RequestInit) => {
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
      routeThroughMastraGateway: route.routeThroughMastraGateway,
      credentialStore: fakeStore({ anthropic: route.credential }),
    });
    const model = gateway.resolveLanguageModel({
      providerId: 'anthropic',
      modelId: 'claude-haiku-4-5',
      apiKey: 'test',
    });
    for (const prompt of prompts) await (model as any).doGenerate({ prompt });
    return bodies;
  }

  it('keeps a breakpoint on unchanged system text when memory rewrites its observations', async () => {
    const [before, after] = await sentBodies([
      memoryPrompt('- user likes tea'),
      memoryPrompt('- user likes tea\n- user moved to Sooke'),
    ]);
    // Everything up to and including the first marked system block: what Anthropic can read back.
    const cachedPrefix = (body: any) => {
      const first = body.system.findIndex((block: any) => block.cache_control);
      return first < 0 ? undefined : JSON.stringify(body.system.slice(0, first + 1));
    };

    expect(JSON.stringify(before.system)).not.toBe(JSON.stringify(after.system));
    expect(cachedPrefix(before)).toBeDefined();
    expect(cachedPrefix(before)).toContain('Skills');
    expect(cachedPrefix(before)).not.toContain('observations');
    expect(cachedPrefix(after)).toBe(cachedPrefix(before));
    expect(JSON.stringify(after).match(/"cache_control"/g)).toHaveLength(3);
  });

  it('finds the context observational memory really renders', async () => {
    const store = await new InMemoryStore().getStore('memory');
    if (!store) throw new Error('InMemoryStore has no memory domain');
    const om = new ObservationalMemory({
      storage: store,
      scope: 'thread',
      observation: { model: 'openai/gpt-4o-mini', messageTokens: 1000, bufferTokens: 200 },
      reflection: { model: 'openai/gpt-4o-mini', observationTokens: 2000 },
    });
    const promptWith = async (activeObservations: string) => {
      const context = await om.buildContextSystemMessages({
        threadId: 'thread-1',
        resourceId: 'resource-1',
        record: { activeObservations } as any,
        currentDate: new Date('2026-11-21T12:00:00Z'),
      });
      const list = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
      list.addSystem('Instructions');
      list.addSystem('Skills');
      for (const message of context ?? []) list.addSystem(message, 'observational-memory');
      list.add({ role: 'user', content: 'Next question' }, 'input');
      return list.get.all.aiV5.prompt();
    };
    const [before, after] = await sentBodies([
      await promptWith('Date: Nov 21, 2026\n* 🔴 (09:00) User likes tea'),
      await promptWith('Date: Nov 21, 2026\n* 🔴 (09:00) User likes tea\n* 🔴 (09:30) User moved to Sooke'),
    ]);
    const firstMarked = (body: any) => body.system.findIndex((block: any) => block.cache_control);

    expect(JSON.stringify(before.system)).not.toBe(JSON.stringify(after.system));
    expect(before.system[firstMarked(before)].text).toBe('Skills');
    expect(after.system[firstMarked(after)].text).toBe('Skills');
    expect(JSON.stringify(after.system.slice(0, firstMarked(after) + 1))).toBe(
      JSON.stringify(before.system.slice(0, firstMarked(before) + 1)),
    );
  });

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
