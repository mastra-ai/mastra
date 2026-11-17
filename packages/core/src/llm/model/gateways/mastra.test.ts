import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { _resetMastraGatewayCatalogCache, MastraGateway } from './mastra.js';

vi.mock('../provider-registry.js', () => ({
  PROVIDER_REGISTRY: { openrouter: { models: ['openai/test-model'] } },
}));

describe('MastraGateway', () => {
  beforeEach(() => {
    delete process.env.MASTRA_GATEWAY_API_KEY;
    delete process.env.MASTRA_GATEWAY_VERSION;
    _resetMastraGatewayCatalogCache();
  });

  afterEach(() => {
    delete process.env.MASTRA_GATEWAY_API_KEY;
    delete process.env.MASTRA_GATEWAY_VERSION;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  /** A v2 gateway whose catalogue request is answered by `gatewayFetch` in place of the global fetch. */
  function gatewayWith(apiKey: string, gatewayFetch: (...args: any[]) => Promise<Response>) {
    vi.stubGlobal('fetch', gatewayFetch);
    return new MastraGateway({ apiKey });
  }

  it('reports disabled when MASTRA_GATEWAY_API_KEY is not set', () => {
    const gateway = new MastraGateway();

    expect(gateway.shouldEnable()).toBe(false);
  });

  it('still lists the mastra provider when MASTRA_GATEWAY_API_KEY is not set', async () => {
    const gateway = new MastraGateway();

    const providers = await gateway.fetchProviders();

    expect(providers.mastra).toBeDefined();
    expect(providers.mastra?.apiKeyEnvVar).toBe('MASTRA_GATEWAY_API_KEY');
    expect(providers.mastra?.models.length).toBeGreaterThan(0);
  });

  it('returns the mastra provider when MASTRA_GATEWAY_API_KEY is set', async () => {
    process.env.MASTRA_GATEWAY_API_KEY = 'test-key';

    const gateway = new MastraGateway();

    expect(gateway.shouldEnable()).toBe(true);

    const providers = await gateway.fetchProviders();

    expect(providers.mastra).toBeDefined();
    expect(providers.mastra?.apiKeyEnvVar).toBe('MASTRA_GATEWAY_API_KEY');
  });

  it('lists only chat models served by the selected v2 gateway', async () => {
    process.env.MASTRA_GATEWAY_VERSION = 'v2';
    const gatewayFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [
              { id: 'openai/chat-model', endpoints: ['chat', 'responses'] },
              { id: 'openai/response-only', endpoints: ['responses'] },
              { id: 'voyage/embedding-model', endpoints: ['embeddings'] },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    vi.stubGlobal('fetch', gatewayFetch);
    const gateway = new MastraGateway({ apiKey: 'deployment-key', baseUrl: 'https://gateway.example/v1' });

    const providers = await gateway.fetchProviders();

    expect(gatewayFetch).toHaveBeenCalledWith(
      'https://gateway.example/v1/models',
      expect.objectContaining({
        headers: { Authorization: 'Bearer deployment-key' },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(providers.mastra?.models).toEqual(['openai/chat-model']);
  });

  it('sends the v2 catalog request with the key in Authorization, not through a custom fetch', async () => {
    process.env.MASTRA_GATEWAY_VERSION = 'v2';
    const customFetch = vi.fn(async () => new Response('{}', { status: 200 }));
    const globalFetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ data: [{ id: 'openai/chat-model', endpoints: ['chat'] }] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', globalFetch);
    const gateway = new MastraGateway({ apiKey: 'deployment-key', customFetch });

    const providers = await gateway.fetchProviders();

    expect(customFetch).not.toHaveBeenCalled();
    expect(globalFetch).toHaveBeenCalledOnce();
    const headers = new Headers(globalFetch.mock.calls[0]![1]?.headers);
    expect(headers.get('Authorization')).toBe('Bearer deployment-key');
    expect(headers.get('X-Memory-Gateway-Authorization')).toBeNull();
    expect(providers.mastra?.models).toEqual(['openai/chat-model']);
  });

  it('aborts v2 catalog discovery when the request deadline expires', async () => {
    process.env.MASTRA_GATEWAY_VERSION = 'v2';
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    const gatewayFetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
        }),
    );
    const gateway = gatewayWith('deployment-key', gatewayFetch);

    const pending = gateway.fetchProviders();
    await vi.waitFor(() => expect(gatewayFetch).toHaveBeenCalledOnce());
    controller.abort(new DOMException('catalog deadline', 'TimeoutError'));

    await expect(pending).rejects.toThrow('catalog deadline');
    expect(timeout).toHaveBeenCalledWith(10_000);
  });

  it('uses the live v2 catalog when a v2 organization key is set without MASTRA_GATEWAY_VERSION', async () => {
    const gatewayFetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: [{ id: 'openai/chat-model', endpoints: ['chat'] }] }), { status: 200 }),
    );
    const gateway = gatewayWith('mskv2_org-key', gatewayFetch);

    const providers = await gateway.fetchProviders();

    expect(gatewayFetch).toHaveBeenCalledOnce();
    expect(providers.mastra?.models).toEqual(['openai/chat-model']);
    expect(providers.mastra?.modelReleaseDates).toBeUndefined();
  });

  describe('isV2', () => {
    it.each([
      { version: undefined, key: 'msk_0123456789abcdef0123456789abcdef', expected: false },
      { version: 'v2', key: 'msk_0123456789abcdef0123456789abcdef', expected: false },
      { version: 'v2', key: 'deployment-key', expected: true },
      { version: 'v2', key: undefined, expected: true },
      { version: undefined, key: 'mskv2_org-key', expected: true },
      { version: undefined, key: 'msk-gateway-org-key', expected: true },
      { version: undefined, key: 'other-key', expected: false },
    ])('with MASTRA_GATEWAY_VERSION=$version and key $key is $expected', ({ version, key, expected }) => {
      if (version) process.env.MASTRA_GATEWAY_VERSION = version;
      expect(new MastraGateway({ apiKey: key }).isV2()).toBe(expected);
    });

    it('lets a v1 config key win over a v2 env key and MASTRA_GATEWAY_VERSION', () => {
      process.env.MASTRA_GATEWAY_VERSION = 'v2';
      process.env.MASTRA_GATEWAY_API_KEY = 'mskv2_org-key';
      expect(new MastraGateway({ apiKey: 'msk_0123456789abcdef0123456789abcdef' }).isV2()).toBe(false);
    });
  });

  it('does not show a static v1 model list if v2 catalog loading fails', async () => {
    process.env.MASTRA_GATEWAY_VERSION = 'v2';
    const gateway = gatewayWith(
      'deployment-key',
      vi.fn(async () => new Response('unavailable', { status: 503 })),
    );
    await expect(gateway.fetchProviders()).rejects.toThrow('Gateway model catalog unavailable (503)');
  });

  describe('v2 catalog cache', () => {
    const catalog = (ids: string[]) =>
      new Response(JSON.stringify({ data: ids.map(id => ({ id, endpoints: ['chat'] })) }), { status: 200 });

    beforeEach(() => {
      process.env.MASTRA_GATEWAY_VERSION = 'v2';
    });

    it('reuses the catalog for a minute, then fetches it again', async () => {
      const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
      const gatewayFetch = vi.fn(async () => catalog(['openai/chat-model']));
      const gateway = gatewayWith('deployment-key', gatewayFetch);

      await gateway.fetchProviders();
      now.mockReturnValue(1_000_000 + 59_000);
      await gateway.fetchProviders();
      expect(gatewayFetch).toHaveBeenCalledOnce();

      now.mockReturnValue(1_000_000 + 61_000);
      await gateway.fetchProviders();
      expect(gatewayFetch).toHaveBeenCalledTimes(2);
    });

    it('shares one request between concurrent callers', async () => {
      let respond!: (response: Response) => void;
      const gatewayFetch = vi.fn(() => new Promise<Response>(resolve => (respond = resolve)));
      const gateway = gatewayWith('deployment-key', gatewayFetch);

      const first = gateway.fetchProviders();
      const second = gatewayWith('deployment-key', gatewayFetch).fetchProviders();
      await vi.waitFor(() => expect(gatewayFetch).toHaveBeenCalledOnce());
      respond(catalog(['openai/chat-model']));

      expect((await first).mastra?.models).toEqual(['openai/chat-model']);
      expect((await second).mastra?.models).toEqual(['openai/chat-model']);
      expect(gatewayFetch).toHaveBeenCalledOnce();
    });

    it('keeps catalogs for different keys apart', async () => {
      const gatewayFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const key = new Headers(init?.headers).get('Authorization');
        return catalog([key === 'Bearer key-a' ? 'openai/model-a' : 'openai/model-b']);
      });

      const a = await gatewayWith('key-a', gatewayFetch).fetchProviders();
      const b = await gatewayWith('key-b', gatewayFetch).fetchProviders();

      expect(a.mastra?.models).toEqual(['openai/model-a']);
      expect(b.mastra?.models).toEqual(['openai/model-b']);
    });

    it('serves the last good catalog for up to ten minutes when a refresh fails', async () => {
      const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
      const gatewayFetch = vi.fn(async () => catalog(['openai/chat-model']));
      const gateway = gatewayWith('deployment-key', gatewayFetch);
      await gateway.fetchProviders();

      gatewayFetch.mockImplementation(async () => new Response('unavailable', { status: 503 }));
      now.mockReturnValue(1_000_000 + 9 * 60_000);
      expect((await gateway.fetchProviders()).mastra?.models).toEqual(['openai/chat-model']);

      now.mockReturnValue(1_000_000 + 11 * 60_000);
      await expect(gateway.fetchProviders()).rejects.toThrow('Gateway model catalog unavailable (503)');
    });

    it.each([401, 403])('drops the cached catalog when the key is rejected with %i', async status => {
      const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
      const gatewayFetch = vi.fn(async () => catalog(['openai/chat-model']));
      const gateway = gatewayWith('deployment-key', gatewayFetch);
      await gateway.fetchProviders();

      gatewayFetch.mockImplementation(async () => new Response('rejected', { status }));
      now.mockReturnValue(1_000_000 + 61_000);
      await expect(gateway.fetchProviders()).rejects.toThrow(`Gateway model catalog unavailable (${status})`);

      gatewayFetch.mockImplementation(async () => catalog(['openai/other-model']));
      expect((await gateway.fetchProviders()).mastra?.models).toEqual(['openai/other-model']);
    });

    it('serves the last good catalog after a network error', async () => {
      const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
      const gatewayFetch = vi.fn(async () => catalog(['openai/chat-model']));
      const gateway = gatewayWith('deployment-key', gatewayFetch);
      await gateway.fetchProviders();

      gatewayFetch.mockRejectedValue(new TypeError('fetch failed'));
      now.mockReturnValue(1_000_000 + 61_000);
      expect((await gateway.fetchProviders()).mastra?.models).toEqual(['openai/chat-model']);
    });

    it('waits before retrying after a failed refresh', async () => {
      const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
      const gatewayFetch = vi.fn(async () => catalog(['openai/chat-model']));
      const gateway = gatewayWith('deployment-key', gatewayFetch);
      await gateway.fetchProviders();

      gatewayFetch.mockImplementation(async () => new Response('unavailable', { status: 503 }));
      now.mockReturnValue(1_000_000 + 61_000);
      await gateway.fetchProviders();
      expect(gatewayFetch).toHaveBeenCalledTimes(2);

      now.mockReturnValue(1_000_000 + 61_000 + 14_000);
      expect((await gateway.fetchProviders()).mastra?.models).toEqual(['openai/chat-model']);
      expect(gatewayFetch).toHaveBeenCalledTimes(2);

      now.mockReturnValue(1_000_000 + 61_000 + 16_000);
      expect((await gateway.fetchProviders()).mastra?.models).toEqual(['openai/chat-model']);
      expect(gatewayFetch).toHaveBeenCalledTimes(3);
    });

    it('keeps catalogs fetched through different global fetch implementations apart', async () => {
      const firstFetch = vi.fn(async () => catalog(['openai/model-a']));
      const secondFetch = vi.fn(async () => catalog(['openai/model-b']));

      const a = await gatewayWith('same-key', firstFetch).fetchProviders();
      const b = await gatewayWith('same-key', secondFetch).fetchProviders();

      expect(a.mastra?.models).toEqual(['openai/model-a']);
      expect(b.mastra?.models).toEqual(['openai/model-b']);
      expect(secondFetch).toHaveBeenCalledOnce();
    });

    it('keeps at most 100 catalogs, dropping the oldest', async () => {
      const gatewayFetch = vi.fn(async () => catalog(['openai/chat-model']));
      for (let i = 0; i <= 100; i++) {
        await gatewayWith(`key-${i}`, gatewayFetch).fetchProviders();
      }
      expect(gatewayFetch).toHaveBeenCalledTimes(101);

      await gatewayWith('key-100', gatewayFetch).fetchProviders();
      expect(gatewayFetch).toHaveBeenCalledTimes(101);
      await gatewayWith('key-0', gatewayFetch).fetchProviders();
      expect(gatewayFetch).toHaveBeenCalledTimes(102);
    });

    it('remembers a failure with no earlier catalog for 15 seconds', async () => {
      const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
      const gatewayFetch = vi.fn(async () => new Response('unavailable', { status: 503 }));
      const gateway = gatewayWith('deployment-key', gatewayFetch);

      await expect(gateway.fetchProviders()).rejects.toThrow('Gateway model catalog unavailable (503)');
      expect(gatewayFetch).toHaveBeenCalledOnce();

      now.mockReturnValue(1_000_000 + 14_000);
      await expect(gateway.fetchProviders()).rejects.toThrow('Gateway model catalog unavailable (503)');
      expect(gatewayFetch).toHaveBeenCalledOnce();

      now.mockReturnValue(1_000_000 + 16_000);
      await expect(gateway.fetchProviders()).rejects.toThrow('Gateway model catalog unavailable (503)');
      expect(gatewayFetch).toHaveBeenCalledTimes(2);
    });

    it('remembers a network error with no earlier catalog', async () => {
      const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
      const gatewayFetch = vi.fn(async () => {
        throw new TypeError('fetch failed');
      });
      const gateway = gatewayWith('deployment-key', gatewayFetch);

      await expect(gateway.fetchProviders()).rejects.toThrow('fetch failed');
      now.mockReturnValue(1_000_000 + 5_000);
      await expect(gateway.fetchProviders()).rejects.toThrow('fetch failed');
      expect(gatewayFetch).toHaveBeenCalledOnce();
    });

    it('clears a remembered failure on success, and the next failure starts a new window', async () => {
      const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
      const gatewayFetch = vi.fn(async () => new Response('unavailable', { status: 503 }));
      const gateway = gatewayWith('deployment-key', gatewayFetch);
      await expect(gateway.fetchProviders()).rejects.toThrow('(503)');

      gatewayFetch.mockImplementation(async () => catalog(['openai/chat-model']));
      now.mockReturnValue(1_000_000 + 16_000);
      expect((await gateway.fetchProviders()).mastra?.models).toEqual(['openai/chat-model']);
      expect(gatewayFetch).toHaveBeenCalledTimes(2);

      // Past the stale window there is no list to fall back on, so a failure is remembered again.
      gatewayFetch.mockImplementation(async () => new Response('unavailable', { status: 503 }));
      now.mockReturnValue(1_000_000 + 16_000 + 11 * 60_000);
      await expect(gateway.fetchProviders()).rejects.toThrow('(503)');
      expect(gatewayFetch).toHaveBeenCalledTimes(3);
      now.mockReturnValue(1_000_000 + 16_000 + 11 * 60_000 + 14_000);
      await expect(gateway.fetchProviders()).rejects.toThrow('(503)');
      expect(gatewayFetch).toHaveBeenCalledTimes(3);
      now.mockReturnValue(1_000_000 + 16_000 + 11 * 60_000 + 16_000);
      await expect(gateway.fetchProviders()).rejects.toThrow('(503)');
      expect(gatewayFetch).toHaveBeenCalledTimes(4);
    });

    it.each([401, 403])('asks the gateway again on every call after a %i', async status => {
      vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
      const gatewayFetch = vi.fn(async () => new Response('rejected', { status }));
      const gateway = gatewayWith('deployment-key', gatewayFetch);

      await expect(gateway.fetchProviders()).rejects.toThrow(`(${status})`);
      await expect(gateway.fetchProviders()).rejects.toThrow(`(${status})`);
      expect(gatewayFetch).toHaveBeenCalledTimes(2);

      gatewayFetch.mockImplementation(async () => catalog(['openai/chat-model']));
      expect((await gateway.fetchProviders()).mastra?.models).toEqual(['openai/chat-model']);
    });

    it('shares one failing request between concurrent callers', async () => {
      let respond!: (response: Response) => void;
      const gatewayFetch = vi.fn(() => new Promise<Response>(resolve => (respond = resolve)));
      const gateway = gatewayWith('deployment-key', gatewayFetch);

      const first = gateway.fetchProviders();
      const second = gateway.fetchProviders();
      await vi.waitFor(() => expect(gatewayFetch).toHaveBeenCalledOnce());
      respond(new Response('unavailable', { status: 503 }));

      await expect(first).rejects.toThrow('(503)');
      await expect(second).rejects.toThrow('(503)');
      expect(gatewayFetch).toHaveBeenCalledOnce();
    });

    it('counts remembered failures toward the 100 catalog limit', async () => {
      const gatewayFetch = vi.fn(async () => new Response('unavailable', { status: 503 }));
      for (let i = 0; i <= 100; i++) {
        await expect(gatewayWith(`key-${i}`, gatewayFetch).fetchProviders()).rejects.toThrow('(503)');
      }
      expect(gatewayFetch).toHaveBeenCalledTimes(101);

      await expect(gatewayWith('key-100', gatewayFetch).fetchProviders()).rejects.toThrow('(503)');
      expect(gatewayFetch).toHaveBeenCalledTimes(101);
      await expect(gatewayWith('key-0', gatewayFetch).fetchProviders()).rejects.toThrow('(503)');
      expect(gatewayFetch).toHaveBeenCalledTimes(102);
    });

    it('forgets remembered failures when the cache is reset', async () => {
      const gatewayFetch = vi.fn(async () => new Response('unavailable', { status: 503 }));
      const gateway = gatewayWith('deployment-key', gatewayFetch);
      await expect(gateway.fetchProviders()).rejects.toThrow('(503)');

      _resetMastraGatewayCatalogCache();
      await expect(gateway.fetchProviders()).rejects.toThrow('(503)');
      expect(gatewayFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('resolveLanguageModel streaming usage', () => {
    const prompt = [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }];

    function captureBodies() {
      const bodies: Record<string, unknown>[] = [];
      const fetchImpl = vi.fn(async (_input: any, init: any) => {
        bodies.push(JSON.parse(String(init?.body)));
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      });
      return { bodies, fetchImpl };
    }

    async function send(model: any) {
      await model.doStream({ prompt }).catch(() => {});
      await model.doGenerate({ prompt }).catch(() => {});
    }

    it('asks for usage on streaming requests only with an API key', async () => {
      const { bodies, fetchImpl } = captureBodies();
      vi.stubGlobal('fetch', fetchImpl);
      try {
        const model = new MastraGateway({ apiKey: 'gateway-key' }).resolveLanguageModel({
          modelId: 'gpt-4o',
          providerId: 'openai',
          apiKey: 'gateway-key',
        });
        await send(model);
      } finally {
        vi.unstubAllGlobals();
      }

      expect(bodies).toHaveLength(2);
      expect(bodies[0]).toMatchObject({ stream: true, stream_options: { include_usage: true } });
      expect(bodies[1]).not.toHaveProperty('stream_options');
      expect(bodies[1]).not.toHaveProperty('usage');
    });

    it('reports usage sent in a separate final chunk', async () => {
      const frames = [
        { id: 'c1', choices: [{ index: 0, delta: { role: 'assistant', content: 'ok' } }] },
        { id: 'c1', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] },
        { id: 'c1', choices: [], usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 } },
      ];
      const body = frames.map(frame => `data: ${JSON.stringify(frame)}\n\n`).join('') + 'data: [DONE]\n\n';
      const customFetch = vi.fn(
        async () => new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
      );
      const model: any = new MastraGateway({
        apiKey: 'gateway-key',
        customFetch: customFetch as any,
      }).resolveLanguageModel({ modelId: 'gpt-4o', providerId: 'openai', apiKey: 'gateway-key' });

      const { stream } = await model.doStream({ prompt });
      const parts: any[] = [];
      for await (const part of stream) parts.push(part);

      const finish = parts.find(part => part.type === 'finish');
      expect(finish?.usage).toMatchObject({ inputTokens: { total: 7 }, outputTokens: { total: 3 } });
    });

    it('asks for usage on streaming requests only with a custom fetch', async () => {
      const { bodies, fetchImpl } = captureBodies();
      const model = new MastraGateway({ apiKey: 'gateway-key', customFetch: fetchImpl as any }).resolveLanguageModel({
        modelId: 'gpt-4o',
        providerId: 'openai',
        apiKey: 'gateway-key',
      });
      await send(model);

      expect(bodies).toHaveLength(2);
      expect(bodies[0]).toMatchObject({ stream: true, stream_options: { include_usage: true } });
      expect(bodies[1]).not.toHaveProperty('stream_options');
      expect(bodies[1]).not.toHaveProperty('usage');
    });
  });

  describe('resolveLanguageModel gateway authorization header', () => {
    const GATEWAY_AUTH_HEADER = 'X-Memory-Gateway-Authorization';

    function createCapturingGateway() {
      let capturedHeaders: Headers | undefined;
      const customFetch = vi.fn(async (_input: any, init: any) => {
        capturedHeaders = new Headers(init?.headers);
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      });
      const gateway = new MastraGateway({ apiKey: 'gateway-key', customFetch: customFetch as any });
      return { gateway, getHeaders: () => capturedHeaders };
    }

    async function callModel(model: any) {
      await model
        .doGenerate({
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
        })
        .catch(() => {
          // the stubbed response is not a valid provider payload; we only care about the request headers
        });
    }

    it('ignores a caller header that targets the reserved gateway header', async () => {
      const { gateway, getHeaders } = createCapturingGateway();

      const model = gateway.resolveLanguageModel({
        modelId: 'gpt-4o',
        providerId: 'openai',
        apiKey: 'gateway-key',
        headers: { [GATEWAY_AUTH_HEADER]: 'Bearer caller-value', 'X-Custom': 'keep' },
      });
      await callModel(model);

      expect(getHeaders()?.get(GATEWAY_AUTH_HEADER)).toBe('Bearer gateway-key');
      expect(getHeaders()?.get('X-Custom')).toBe('keep');
    });

    it('ignores a differently-cased caller variant of the reserved gateway header', async () => {
      const { gateway, getHeaders } = createCapturingGateway();

      const model = gateway.resolveLanguageModel({
        modelId: 'gpt-4o',
        providerId: 'openai',
        apiKey: 'gateway-key',
        headers: { 'x-memory-gateway-authorization': 'Bearer caller-value' },
      });
      await callModel(model);

      expect(getHeaders()?.get(GATEWAY_AUTH_HEADER)).toBe('Bearer gateway-key');
    });

    it('ignores a caller override on the anthropic path', async () => {
      const { gateway, getHeaders } = createCapturingGateway();

      const model = gateway.resolveLanguageModel({
        modelId: 'claude-sonnet-4-20250514',
        providerId: 'anthropic',
        apiKey: 'gateway-key',
        headers: { [GATEWAY_AUTH_HEADER]: 'Bearer caller-value', 'X-Custom': 'keep' },
      });
      await callModel(model);

      expect(getHeaders()?.get(GATEWAY_AUTH_HEADER)).toBe('Bearer gateway-key');
      expect(getHeaders()?.get('X-Custom')).toBe('keep');
    });

    it('still lets callers override User-Agent', async () => {
      const { gateway, getHeaders } = createCapturingGateway();

      const model = gateway.resolveLanguageModel({
        modelId: 'gpt-4o',
        providerId: 'openai',
        apiKey: 'gateway-key',
        headers: { 'User-Agent': 'custom-agent' },
      });
      await callModel(model);

      // the AI SDK appends its own runtime suffix to whatever User-Agent we pass through
      expect(getHeaders()?.get('User-Agent')).toContain('custom-agent');
      expect(getHeaders()?.get(GATEWAY_AUTH_HEADER)).toBe('Bearer gateway-key');
    });
  });
});
