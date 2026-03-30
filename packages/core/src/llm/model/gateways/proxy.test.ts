import { describe, it, expect, vi, afterEach } from 'vitest';
import { MastraProxyGateway } from './proxy.js';
import { findGatewayForModel } from './index.js';

// Stub SDK factory functions so resolveLanguageModel doesn't make real HTTP calls.
// Each mock returns a callable that returns a fake model object.
function fakeModel(provider: string, model: string) {
  return { modelId: model, provider, specificationVersion: 'v2' };
}

vi.mock('@ai-sdk/openai-v5', () => ({
  createOpenAI: vi.fn(({ baseURL, apiKey, headers }: any) => ({
    responses: (modelId: string) => ({ ...fakeModel('openai', modelId), baseURL, apiKey, headers }),
    chat: (modelId: string) => ({ ...fakeModel('openai', modelId), baseURL, apiKey, headers }),
  })),
}));

vi.mock('@ai-sdk/anthropic-v5', () => ({
  createAnthropic: vi.fn(({ baseURL, apiKey, headers }: any) => (modelId: string) => ({
    ...fakeModel('anthropic', modelId),
    baseURL,
    apiKey,
    headers,
  })),
}));

vi.mock('@ai-sdk/google-v5', () => ({
  createGoogleGenerativeAI: vi.fn(({ baseURL, apiKey, headers }: any) => ({
    chat: (modelId: string) => ({ ...fakeModel('google', modelId), baseURL, apiKey, headers }),
  })),
}));

vi.mock('@ai-sdk/mistral-v5', () => ({
  createMistral: vi.fn(({ baseURL, apiKey, headers }: any) => (modelId: string) => ({
    ...fakeModel('mistral', modelId),
    baseURL,
    apiKey,
    headers,
  })),
}));

vi.mock('@ai-sdk/groq-v5', () => ({
  createGroq: vi.fn(({ baseURL, apiKey, headers }: any) => (modelId: string) => ({
    ...fakeModel('groq', modelId),
    baseURL,
    apiKey,
    headers,
  })),
}));

vi.mock('@ai-sdk/xai-v5', () => ({
  createXai: vi.fn(({ baseURL, apiKey, headers }: any) => (modelId: string) => ({
    ...fakeModel('xai', modelId),
    baseURL,
    apiKey,
    headers,
  })),
}));

vi.mock('@ai-sdk/deepseek-v5', () => ({
  createDeepSeek: vi.fn(({ baseURL, apiKey, headers }: any) => (modelId: string) => ({
    ...fakeModel('deepseek', modelId),
    baseURL,
    apiKey,
    headers,
  })),
}));

vi.mock('@ai-sdk/perplexity-v5', () => ({
  createPerplexity: vi.fn(({ baseURL, apiKey, headers }: any) => (modelId: string) => ({
    ...fakeModel('perplexity', modelId),
    baseURL,
    apiKey,
    headers,
  })),
}));

vi.mock('@ai-sdk/cerebras-v5', () => ({
  createCerebras: vi.fn(({ baseURL, apiKey, headers }: any) => (modelId: string) => ({
    ...fakeModel('cerebras', modelId),
    baseURL,
    apiKey,
    headers,
  })),
}));

vi.mock('@ai-sdk/togetherai-v5', () => ({
  createTogetherAI: vi.fn(({ baseURL, apiKey, headers }: any) => (modelId: string) => ({
    ...fakeModel('togetherai', modelId),
    baseURL,
    apiKey,
    headers,
  })),
}));

vi.mock('@ai-sdk/deepinfra-v5', () => ({
  createDeepInfra: vi.fn(({ baseURL, apiKey, headers }: any) => (modelId: string) => ({
    ...fakeModel('deepinfra', modelId),
    baseURL,
    apiKey,
    headers,
  })),
}));

vi.mock('@openrouter/ai-sdk-provider-v5', () => ({
  createOpenRouter: vi.fn(({ baseURL, apiKey, headers }: any) => (modelId: string) => ({
    ...fakeModel('openrouter', modelId),
    baseURL,
    apiKey,
    headers,
  })),
}));

vi.mock('@internal/ai-v6', () => ({
  createGateway: vi.fn(({ baseURL, apiKey, headers }: any) => (modelId: string) => ({
    ...fakeModel('vercel', modelId),
    baseURL,
    apiKey,
    headers,
  })),
}));

vi.mock('@ai-sdk/openai-compatible-v5', () => ({
  createOpenAICompatible: vi.fn(({ name, baseURL, apiKey, headers }: any) => ({
    chatModel: (modelId: string) => ({ ...fakeModel(name, modelId), baseURL, apiKey, headers }),
  })),
}));

const PROXY_URL = 'https://my-proxy.example.com/v1';

describe('MastraProxyGateway', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('matchesModel', () => {
    it('returns true for any model ID', () => {
      const gw = new MastraProxyGateway({ baseUrl: PROXY_URL });
      expect(gw.matchesModel('openai/gpt-4o')).toBe(true);
      expect(gw.matchesModel('anthropic/claude-sonnet-4-20250514')).toBe(true);
      expect(gw.matchesModel('some-random/model')).toBe(true);
    });
  });

  describe('buildUrl', () => {
    it('returns the configured baseUrl', () => {
      const gw = new MastraProxyGateway({ baseUrl: PROXY_URL });
      expect(gw.buildUrl('openai/gpt-4o')).toBe(PROXY_URL);
      expect(gw.buildUrl('anything')).toBe(PROXY_URL);
    });
  });

  describe('getApiKey', () => {
    it('delegates to config.getApiKey when provided', async () => {
      const getApiKey = vi.fn().mockResolvedValue('custom-key-123');
      const gw = new MastraProxyGateway({ baseUrl: PROXY_URL, getApiKey });

      const key = await gw.getApiKey('openai/gpt-4o');
      expect(key).toBe('custom-key-123');
      expect(getApiKey).toHaveBeenCalledWith('openai/gpt-4o');
    });

    it('falls back to env var lookup by provider', async () => {
      vi.stubEnv('OPENAI_API_KEY', 'sk-env-key');
      const gw = new MastraProxyGateway({ baseUrl: PROXY_URL });

      const key = await gw.getApiKey('openai/gpt-4o');
      expect(key).toBe('sk-env-key');
    });

    it('throws when no getApiKey and no env var', async () => {
      const gw = new MastraProxyGateway({ baseUrl: PROXY_URL });
      await expect(gw.getApiKey('openai/gpt-4o')).rejects.toThrow('OPENAI_API_KEY');
    });
  });

  describe('fetchProviders', () => {
    it('returns empty (proxy does not discover providers)', async () => {
      const gw = new MastraProxyGateway({ baseUrl: PROXY_URL });
      const providers = await gw.fetchProviders();
      expect(providers).toEqual({});
    });
  });

  describe('resolveLanguageModel', () => {
    const headers = { 'X-Custom': 'value' };
    const proxyHeaders = { 'X-Proxy-Token': 'secret' };

    function makeGateway() {
      return new MastraProxyGateway({ baseUrl: PROXY_URL, headers: proxyHeaders });
    }

    it('creates native OpenAI model via responses()', async () => {
      const gw = makeGateway();
      const model: any = await gw.resolveLanguageModel({
        modelId: 'gpt-4o',
        providerId: 'openai',
        apiKey: 'sk-test',
        headers,
      });
      expect(model.provider).toBe('openai');
      expect(model.modelId).toBe('gpt-4o');
      expect(model.baseURL).toBe(PROXY_URL);
      expect(model.apiKey).toBe('sk-test');
      expect(model.headers).toMatchObject({ 'X-Proxy-Token': 'secret', 'X-Custom': 'value' });
    });

    it('creates native Anthropic model', async () => {
      const gw = makeGateway();
      const model: any = await gw.resolveLanguageModel({
        modelId: 'claude-sonnet-4-20250514',
        providerId: 'anthropic',
        apiKey: 'sk-ant',
        headers,
      });
      expect(model.provider).toBe('anthropic');
      expect(model.modelId).toBe('claude-sonnet-4-20250514');
      expect(model.baseURL).toBe(PROXY_URL);
    });

    it('creates native Google model', async () => {
      const gw = makeGateway();
      const model: any = await gw.resolveLanguageModel({
        modelId: 'gemini-2.0-flash',
        providerId: 'google',
        apiKey: 'key',
      });
      expect(model.provider).toBe('google');
      expect(model.modelId).toBe('gemini-2.0-flash');
      expect(model.baseURL).toBe(PROXY_URL);
    });

    it('creates native Google model for gemini provider alias', async () => {
      const gw = makeGateway();
      const model: any = await gw.resolveLanguageModel({
        modelId: 'gemini-2.0-flash',
        providerId: 'gemini',
        apiKey: 'key',
      });
      expect(model.provider).toBe('google');
    });

    it('falls back to openai-compatible for unknown providers', async () => {
      const gw = makeGateway();
      const model: any = await gw.resolveLanguageModel({
        modelId: 'my-model',
        providerId: 'custom-corp',
        apiKey: 'key',
      });
      expect(model.provider).toBe('custom-corp');
      expect(model.baseURL).toBe(PROXY_URL);
    });

    it('merges proxy headers under caller headers', async () => {
      const gw = new MastraProxyGateway({
        baseUrl: PROXY_URL,
        headers: { 'X-Proxy': 'low-priority', Shared: 'proxy' },
      });
      const model: any = await gw.resolveLanguageModel({
        modelId: 'gpt-4o',
        providerId: 'openai',
        apiKey: 'sk-test',
        headers: { Shared: 'caller-wins' },
      });
      expect(model.headers['X-Proxy']).toBe('low-priority');
      expect(model.headers['Shared']).toBe('caller-wins');
    });
  });

  describe('findGatewayForModel integration', () => {
    it('proxy gateway is selected over models.dev for any model', () => {
      const proxy = new MastraProxyGateway({ baseUrl: PROXY_URL });
      const mockModelsDev = { id: 'models.dev', matchesModel: () => false } as any;

      const found = findGatewayForModel('openai/gpt-4o', [proxy, mockModelsDev]);
      expect(found).toBe(proxy);
    });

    it('proxy gateway is selected over prefix gateways', () => {
      const proxy = new MastraProxyGateway({ baseUrl: PROXY_URL });
      const mockNetlify = { id: 'netlify', matchesModel: () => false } as any;

      const found = findGatewayForModel('netlify/openai/gpt-4o', [proxy, mockNetlify]);
      expect(found).toBe(proxy);
    });
  });
});
