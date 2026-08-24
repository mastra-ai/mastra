import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MastraGateway } from './mastra.js';

describe('MastraGateway', () => {
  beforeEach(() => {
    delete process.env.MASTRA_GATEWAY_API_KEY;
  });

  afterEach(() => {
    delete process.env.MASTRA_GATEWAY_API_KEY;
    vi.restoreAllMocks();
  });

  it('reports disabled when MASTRA_GATEWAY_API_KEY is not set', () => {
    const gateway = new MastraGateway();

    expect(gateway.shouldEnable()).toBe(false);
  });

  it('returns no providers when MASTRA_GATEWAY_API_KEY is not set', async () => {
    const gateway = new MastraGateway();

    const providers = await gateway.fetchProviders();

    expect(providers).toEqual({});
  });

  it('returns the mastra provider when MASTRA_GATEWAY_API_KEY is set', async () => {
    process.env.MASTRA_GATEWAY_API_KEY = 'test-key';

    const gateway = new MastraGateway();

    expect(gateway.shouldEnable()).toBe(true);

    const providers = await gateway.fetchProviders();

    expect(providers.mastra).toBeDefined();
    expect(providers.mastra?.apiKeyEnvVar).toBe('MASTRA_GATEWAY_API_KEY');
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
