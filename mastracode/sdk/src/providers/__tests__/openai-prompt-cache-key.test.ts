import { afterEach, describe, expect, it, vi } from 'vitest';
import { MastraCodeGateway } from '../../agents/mastracode-gateway.js';
import type { AuthCredential, CredentialStore } from '../../auth/types.js';

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
    allowEnvironmentFallback: false,
  };
}

const codexOAuth: AuthCredential = {
  type: 'oauth',
  access: 'access',
  refresh: 'refresh',
  expires: Date.now() + 60 * 60_000,
  accountId: 'acct-1',
} as AuthCredential;

const routes = {
  'API-key route': {
    routeThroughMastraGateway: false,
    production: false,
    credential: { type: 'api_key', key: 'sk-test' } as AuthCredential,
    url: 'https://api.openai.com/v1/responses',
    sessionHeaders: false,
  },
  'Codex OAuth route': {
    routeThroughMastraGateway: false,
    production: true,
    credential: codexOAuth,
    url: 'https://chatgpt.com/backend-api/codex/responses',
    sessionHeaders: true,
  },
  'Codex OAuth route through the Mastra gateway': {
    routeThroughMastraGateway: true,
    production: false,
    credential: codexOAuth,
    url: 'https://gateway.example.com/v1/responses',
    sessionHeaders: true,
  },
};

function responsesBody() {
  return {
    id: 'resp_1',
    created_at: 1,
    model: 'gpt-5.4',
    output: [
      {
        type: 'message',
        role: 'assistant',
        id: 'msg_1',
        content: [{ type: 'output_text', text: 'ok', annotations: [] }],
      },
    ],
    usage: { input_tokens: 1, output_tokens: 1 },
  };
}

// What reaches the wire for one model call made inside a thread.
describe.each(Object.entries(routes))('OpenAI prompt cache key sent by the %s', (_name, route) => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  async function send(
    threadId: string,
    modelId = 'gpt-5.4',
    providerOptions?: { mastracode: { codexServiceTier: 'fast' } },
  ) {
    const sent: Array<{ url: string; body: any; raw: string; headers: Headers }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const request = input instanceof Request ? input : new Request(input, init);
        const raw = await request.text();
        sent.push({ url: request.url, body: JSON.parse(raw), raw, headers: request.headers });
        return new Response(JSON.stringify(responsesBody()), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
    if (route.production) {
      vi.stubEnv('VITEST', '');
      vi.stubEnv('NODE_ENV', 'production');
    }

    const gateway = new MastraCodeGateway({
      mastraGatewayBaseUrl: 'https://gateway.example.com',
      routeThroughMastraGateway: route.routeThroughMastraGateway,
      credentialStore: fakeStore({ 'openai-codex': route.credential }),
    });
    const model = gateway.resolveLanguageModel({
      providerId: 'openai',
      modelId,
      apiKey: 'test',
      headers: { 'x-thread-id': threadId, 'x-resource-id': 'resource-1' },
    });

    await (model as any).doGenerate({
      ...(providerOptions ? { providerOptions } : {}),
      prompt: [
        { role: 'system', content: 'Instructions' },
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      ],
    });

    expect(sent.map(request => request.url)).toEqual([route.url]);
    return sent[0]!;
  }

  it.each(['gpt-6.2-sol', 'gpt-6.2-astra'])(
    'scopes the fast preference to Codex OAuth requests for %s',
    async modelId => {
      const standard = await send('thread-fast', modelId);
      const fast = await send('thread-fast', modelId, { mastracode: { codexServiceTier: 'fast' } });
      const next = await send('thread-fast', modelId);

      expect(standard.body).not.toHaveProperty('service_tier');
      expect(fast.body).toEqual(route.sessionHeaders ? { ...standard.body, service_tier: 'priority' } : standard.body);
      expect([...fast.headers]).toEqual([...standard.headers]);
      expect(next.raw).toBe(standard.raw);
    },
  );

  it('strips the alias before applying the route-specific model remap, without Fast on a model that lacks it', async () => {
    const standard = await send('thread-fast', 'gpt-5.3');
    const aliased = await send('thread-fast', 'gpt-5.3:fast');

    expect(standard.body.model).toBe(route.sessionHeaders ? 'gpt-5.3-codex' : 'gpt-5.3');
    expect(aliased.body).toEqual(standard.body);
  });

  it('requests Fast from the model suffix on a model that supports it', async () => {
    const standard = await send('thread-fast', 'gpt-6.2-sol');
    const aliased = await send('thread-fast', 'gpt-6.2-sol:fast');

    expect(aliased.body).toEqual(route.sessionHeaders ? { ...standard.body, service_tier: 'priority' } : standard.body);
  });

  it("keeps a caller's own prompt cache key", async () => {
    const sent: Array<{ body: any }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const request = input instanceof Request ? input : new Request(input, init);
        sent.push({ body: JSON.parse(await request.text()) });
        return new Response(JSON.stringify(responsesBody()), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
    if (route.production) {
      vi.stubEnv('VITEST', '');
      vi.stubEnv('NODE_ENV', 'production');
    }

    const gateway = new MastraCodeGateway({
      mastraGatewayBaseUrl: 'https://gateway.example.com',
      routeThroughMastraGateway: route.routeThroughMastraGateway,
      credentialStore: fakeStore({ 'openai-codex': route.credential }),
    });
    const model = gateway.resolveLanguageModel({
      providerId: 'openai',
      modelId: 'gpt-5.4',
      apiKey: 'test',
      headers: { 'x-thread-id': 'thread-a' },
    });

    await (model as any).doGenerate({
      prompt: [
        { role: 'system', content: 'Instructions' },
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      ],
      providerOptions: { openai: { promptCacheKey: 'caller-key' } },
    });

    expect(sent[0]!.body.prompt_cache_key).toBe('caller-key');
  });

  it('reads the thread header in any letter case', async () => {
    const { getRequestThreadId } = await import('../openai-codex.js');
    expect(getRequestThreadId({ 'X-Thread-Id': 'thread-a' })).toBe('thread-a');
    expect(getRequestThreadId({ 'x-THREAD-id': 'thread-a' })).toBe('thread-a');
  });

  it('keys the prompt cache by the thread', async () => {
    const first = await send('thread-a');
    const again = await send('thread-a');
    const other = await send('thread-b');

    expect(first.body.prompt_cache_key).toBe('thread-a');
    expect(again.body.prompt_cache_key).toBe('thread-a');
    expect(other.body.prompt_cache_key).toBe('thread-b');
  });

  it.runIf(route.sessionHeaders)('sends the thread as the session-id and thread-id headers', async () => {
    const { headers } = await send('thread-a');

    expect(headers.get('session-id')).toBe('thread-a');
    expect(headers.get('thread-id')).toBe('thread-a');
  });
});
