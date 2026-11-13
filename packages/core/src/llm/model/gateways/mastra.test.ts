import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MastraGateway } from './mastra.js';

vi.mock('../provider-registry.js', () => ({
  PROVIDER_REGISTRY: { openrouter: { models: ['openai/test-model'] } },
}));

describe('MastraGateway', () => {
  beforeEach(() => {
    delete process.env.MASTRA_GATEWAY_API_KEY;
    delete process.env.MASTRA_GATEWAY_VERSION;
  });

  afterEach(() => {
    delete process.env.MASTRA_GATEWAY_API_KEY;
    delete process.env.MASTRA_GATEWAY_VERSION;
    vi.restoreAllMocks();
  });

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
    const gateway = new MastraGateway({
      apiKey: 'deployment-key',
      baseUrl: 'https://gateway.example/v1',
      customFetch: gatewayFetch,
    });

    const providers = await gateway.fetchProviders();

    expect(gatewayFetch).toHaveBeenCalledWith(
      'https://gateway.example/v1/models',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Memory-Gateway-Authorization': 'Bearer deployment-key' }),
        signal: expect.any(AbortSignal),
      }),
    );
    expect(providers.mastra?.models).toEqual(['openai/chat-model']);
  });

  it('preserves the Gateway key when customFetch replaces Authorization with OAuth', async () => {
    process.env.MASTRA_GATEWAY_VERSION = 'v2';
    const customFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      headers.set('Authorization', 'Bearer oauth-token');
      expect(headers.get('Authorization')).toBe('Bearer oauth-token');
      expect(headers.get('X-Memory-Gateway-Authorization')).toBe('Bearer deployment-key');
      return new Response(JSON.stringify({ data: [{ id: 'openai/chat-model', endpoints: ['chat'] }] }), {
        status: 200,
      });
    });
    const gateway = new MastraGateway({ apiKey: 'deployment-key', customFetch });

    const providers = await gateway.fetchProviders();

    expect(customFetch).toHaveBeenCalledOnce();
    expect(providers.mastra?.models).toEqual(['openai/chat-model']);
  });

  it('aborts v2 catalog discovery when the request deadline expires', async () => {
    process.env.MASTRA_GATEWAY_VERSION = 'v2';
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    const customFetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
        }),
    );
    const gateway = new MastraGateway({ apiKey: 'deployment-key', customFetch });

    const pending = gateway.fetchProviders();
    await vi.waitFor(() => expect(customFetch).toHaveBeenCalledOnce());
    controller.abort(new DOMException('catalog deadline', 'TimeoutError'));

    await expect(pending).rejects.toThrow('catalog deadline');
    expect(timeout).toHaveBeenCalledWith(10_000);
  });

  it('uses the live v2 catalog when a v2 organization key is set without MASTRA_GATEWAY_VERSION', async () => {
    const gatewayFetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: [{ id: 'openai/chat-model', endpoints: ['chat'] }] }), { status: 200 }),
    );
    const gateway = new MastraGateway({ apiKey: 'mskv2_org-key', customFetch: gatewayFetch });

    const providers = await gateway.fetchProviders();

    expect(gatewayFetch).toHaveBeenCalledOnce();
    expect(providers.mastra?.models).toEqual(['openai/chat-model']);
    expect(providers.mastra?.modelReleaseDates).toBeUndefined();
  });

  it('does not show a static v1 model list if v2 catalog loading fails', async () => {
    process.env.MASTRA_GATEWAY_VERSION = 'v2';
    const gateway = new MastraGateway({
      apiKey: 'deployment-key',
      customFetch: vi.fn(async () => new Response('unavailable', { status: 503 })),
    });
    await expect(gateway.fetchProviders()).rejects.toThrow('Gateway model catalog unavailable (503)');
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
