import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ModelsDevGateway } from './models-dev.js';

const {
  callableModelMock,
  chatModelMock,
  createAnthropicMock,
  createCerebrasMock,
  createDeepInfraMock,
  createDeepSeekMock,
  createGatewayMock,
  createGoogleGenerativeAIMock,
  createGroqMock,
  createMistralMock,
  createOpenAIMock,
  createOpenRouterMock,
  createPerplexityMock,
  createTogetherAIMock,
  createXaiMock,
  openAIResponsesMock,
} = vi.hoisted(() => ({
  callableModelMock: vi.fn(),
  chatModelMock: vi.fn(),
  createAnthropicMock: vi.fn(),
  createCerebrasMock: vi.fn(),
  createDeepInfraMock: vi.fn(),
  createDeepSeekMock: vi.fn(),
  createGatewayMock: vi.fn(),
  createGoogleGenerativeAIMock: vi.fn(),
  createGroqMock: vi.fn(),
  createMistralMock: vi.fn(),
  createOpenAIMock: vi.fn(),
  createOpenRouterMock: vi.fn(),
  createPerplexityMock: vi.fn(),
  createTogetherAIMock: vi.fn(),
  createXaiMock: vi.fn(),
  openAIResponsesMock: vi.fn(),
}));

vi.mock('@ai-sdk/anthropic-v6', () => ({ createAnthropic: createAnthropicMock }));
vi.mock('@ai-sdk/cerebras-v6', () => ({ createCerebras: createCerebrasMock }));
vi.mock('@ai-sdk/deepinfra-v6', () => ({ createDeepInfra: createDeepInfraMock }));
vi.mock('@ai-sdk/deepseek-v6', () => ({ createDeepSeek: createDeepSeekMock }));
vi.mock('@ai-sdk/google-v6', () => ({ createGoogleGenerativeAI: createGoogleGenerativeAIMock }));
vi.mock('@ai-sdk/groq-v6', () => ({ createGroq: createGroqMock }));
vi.mock('@ai-sdk/mistral-v6', () => ({ createMistral: createMistralMock }));
vi.mock('@ai-sdk/openai-v6', () => ({ createOpenAI: createOpenAIMock }));
vi.mock('@ai-sdk/perplexity-v6', () => ({ createPerplexity: createPerplexityMock }));
vi.mock('@ai-sdk/togetherai-v6', () => ({ createTogetherAI: createTogetherAIMock }));
vi.mock('@ai-sdk/xai-v6', () => ({ createXai: createXaiMock }));
vi.mock('@internal/ai-v6', () => ({ createGateway: createGatewayMock }));
vi.mock('@openrouter/ai-sdk-provider-v6', () => ({ createOpenRouter: createOpenRouterMock }));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('ModelsDevGateway', () => {
  let gateway: ModelsDevGateway;

  beforeEach(() => {
    gateway = new ModelsDevGateway();
    mockFetch.mockClear();
    callableModelMock.mockReturnValue({ provider: 'callable' });
    chatModelMock.mockReturnValue({ provider: 'chat' });
    createAnthropicMock.mockReturnValue(callableModelMock);
    createCerebrasMock.mockReturnValue(callableModelMock);
    createDeepInfraMock.mockReturnValue(callableModelMock);
    createDeepSeekMock.mockReturnValue(callableModelMock);
    createGatewayMock.mockReturnValue(callableModelMock);
    createGoogleGenerativeAIMock.mockReturnValue({ chat: chatModelMock });
    createGroqMock.mockReturnValue(callableModelMock);
    createMistralMock.mockReturnValue(callableModelMock);
    createOpenAIMock.mockReturnValue({ responses: openAIResponsesMock });
    createOpenRouterMock.mockReturnValue(callableModelMock);
    createPerplexityMock.mockReturnValue(callableModelMock);
    createTogetherAIMock.mockReturnValue(callableModelMock);
    createXaiMock.mockReturnValue(callableModelMock);
    openAIResponsesMock.mockReturnValue({ provider: 'openai' });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  describe('fetchProviders', () => {
    const mockApiResponse = {
      openai: {
        id: 'openai',
        name: 'OpenAI',
        models: {
          'gpt-4': { name: 'GPT-4' },
          'gpt-3.5-turbo': { name: 'GPT-3.5 Turbo' },
        },
        env: ['OPENAI_API_KEY'],
        api: 'https://api.openai.com/v1',
        npm: '@ai-sdk/openai',
      },
      anthropic: {
        id: 'anthropic',
        name: 'Anthropic',
        models: {
          'claude-3-opus': { name: 'Claude 3 Opus' },
          'claude-3-sonnet': { name: 'Claude 3 Sonnet' },
        },
        env: ['ANTHROPIC_API_KEY'],
        api: 'https://api.anthropic.com/v1',
        npm: '@ai-sdk/anthropic',
      },
      cerebras: {
        id: 'cerebras',
        name: 'Cerebras',
        models: {
          'llama3.1-8b': { name: 'Llama 3.1 8B' },
        },
        env: ['CEREBRAS_API_KEY'],
        // No API URL - uses native @ai-sdk/cerebras package
        npm: '@ai-sdk/cerebras',
      },
      'fireworks-ai': {
        id: 'fireworks-ai',
        name: 'Fireworks AI',
        models: {
          'llama-v3-70b': { name: 'Llama v3 70B' },
        },
        env: ['FIREWORKS_API_KEY'],
        api: 'https://api.fireworks.ai/inference/v1',
        npm: '@ai-sdk/openai-compatible',
      },
      'cloudflare-workers-ai': {
        id: 'cloudflare-workers-ai',
        name: 'Cloudflare Workers AI',
        models: {
          '@cf/meta/llama-3.1-8b-instruct': { name: 'Llama 3.1 8B Instruct' },
        },
        env: ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_KEY'],
        api: 'https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/v1',
        npm: '@ai-sdk/openai-compatible',
      },
      google: {
        id: 'google',
        name: 'Google',
        models: {
          'gemini-3.1-flash-lite': { name: 'Gemini 3.1 Flash Lite' },
        },
        env: ['GOOGLE_API_KEY'],
        api: 'https://generativelanguage.googleapis.com/v1beta',
        npm: '@ai-sdk/google',
      },
      'unknown-provider': {
        id: 'unknown-provider',
        name: 'Unknown',
        models: {
          'model-1': { name: 'Model 1' },
        },
        // No env, no api, not OpenAI-compatible
        npm: '@some-other/package',
      },
    };

    it('should fetch and parse providers from models.dev API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      });

      const providers = await gateway.fetchProviders();

      expect(mockFetch).toHaveBeenCalledWith('https://models.dev/api.json');
      expect(providers).toBeDefined();
      expect(Object.keys(providers).length).toBeGreaterThan(0);
    });

    it('should identify OpenAI-compatible providers by npm package', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      });

      const providers = await gateway.fetchProviders();

      // cerebras uses native SDK, fireworks-ai uses @ai-sdk/openai-compatible
      expect(providers.cerebras).toBeDefined();
      expect(providers['fireworks-ai']).toBeDefined(); // Provider IDs keep hyphens
      expect(providers.cerebras.url).toBeUndefined(); // No URL needed - uses native @ai-sdk/cerebras
    });

    it('should apply PROVIDER_OVERRIDES', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      });

      const providers = await gateway.fetchProviders();

      // OpenAI should be included even though it uses @ai-sdk/openai
      expect(providers.openai).toBeDefined();
      expect(providers.openai.url).toBe('https://api.openai.com/v1');
    });

    it('should preserve Google legacy API key fallback when generating providers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      });

      const providers = await gateway.fetchProviders();

      expect(providers.google.apiKeyEnvVar).toEqual(['GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY']);
    });

    it('should keep hyphens in provider IDs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      });

      const providers = await gateway.fetchProviders();

      // fireworks-ai should keep its hyphen
      expect(providers['fireworks-ai']).toBeDefined();
      expect(providers['fireworks-ai'].name).toBe('Fireworks AI');
      // But env var should use underscores
      expect(providers['fireworks-ai'].apiKeyEnvVar).toBe('FIREWORKS_API_KEY');
    });

    it('should ignore URL placeholder env vars when selecting the auth env var', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      });

      const providers = await gateway.fetchProviders();

      expect(providers['cloudflare-workers-ai']).toBeDefined();
      expect(providers['cloudflare-workers-ai'].url).toBe(
        'https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/v1',
      );
      expect(providers['cloudflare-workers-ai'].apiKeyEnvVar).toBe('CLOUDFLARE_API_KEY');
    });

    it('should prefer token-like env vars over other auth candidates', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          'example-provider': {
            id: 'example-provider',
            name: 'Example Provider',
            models: {
              'example-model': { name: 'Example Model' },
            },
            env: ['EXAMPLE_ACCOUNT_ID', 'EXAMPLE_API_KEY', 'EXAMPLE_API_TOKEN'],
            api: 'https://api.example.com/accounts/${EXAMPLE_ACCOUNT_ID}/v1',
            npm: '@ai-sdk/openai-compatible',
          },
        }),
      });

      const providers = await gateway.fetchProviders();

      expect(providers['example-provider']).toBeDefined();
      expect(providers['example-provider'].apiKeyEnvVar).toBe('EXAMPLE_API_TOKEN');
    });

    it('should filter out deprecated models', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          groq: {
            id: 'groq',
            name: 'Groq',
            models: {
              'llama-3.1-8b': { name: 'Llama 3.1 8B' },
              'deepseek-r1-distill-llama-70b': {
                name: 'DeepSeek R1 Distill LLaMA 70B',
                status: 'deprecated',
              },
            },
            env: ['GROQ_API_KEY'],
            api: 'https://api.groq.com/openai/v1',
            npm: '@ai-sdk/openai-compatible',
          },
        }),
      });

      const providers = await gateway.fetchProviders();

      expect(providers.groq).toBeDefined();
      expect(providers.groq.models).toEqual(['llama-3.1-8b']);
      expect(providers.groq.models).not.toContain('deepseek-r1-distill-llama-70b');
    });

    it('should return empty models array when all models are deprecated', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          groq: {
            id: 'groq',
            name: 'Groq',
            models: {
              'model-1': { name: 'Model 1', status: 'deprecated' },
              'model-2': { name: 'Model 2', status: 'deprecated' },
            },
            env: ['GROQ_API_KEY'],
            api: 'https://api.groq.com/openai/v1',
            npm: '@ai-sdk/openai-compatible',
          },
        }),
      });

      const providers = await gateway.fetchProviders();

      expect(providers.groq).toBeDefined();
      expect(providers.groq.models).toEqual([]);
    });

    it('should extract model IDs from each provider', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      });

      const providers = await gateway.fetchProviders();

      expect(providers.openai.models).toEqual(['gpt-3.5-turbo', 'gpt-4']);
      expect(providers.anthropic.models).toEqual(['claude-3-opus', 'claude-3-sonnet']);
    });

    it('should handle API fetch errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      await expect(gateway.fetchProviders()).rejects.toThrow('Failed to fetch from models.dev: Internal Server Error');
    });

    it('should skip providers without API URLs or OpenAI compatibility', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      });

      const providers = await gateway.fetchProviders();

      // unknown-provider has no env, no api, and not OpenAI-compatible
      expect(providers['unknown-provider']).toBeUndefined();
      expect(providers.unknown_provider).toBeUndefined();
    });

    it('should ensure URLs do not end with /chat/completions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      });

      const providers = await gateway.fetchProviders();

      // Except for directly supported providers
      expect(providers.anthropic.url).not.toMatch(/\/chat\/completions$/);
      expect(providers.openai.url).not.toMatch(/\/chat\/completions$/);
    });
  });

  describe('buildUrl', () => {
    beforeEach(async () => {
      // Set up gateway with mock data
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          openai: {
            id: 'openai',
            name: 'OpenAI',
            models: { 'gpt-4': {} },
            env: ['OPENAI_API_KEY'],
            api: 'https://api.openai.com/v1',
          },
          'cloudflare-workers-ai': {
            id: 'cloudflare-workers-ai',
            name: 'Cloudflare Workers AI',
            models: { '@cf/meta/llama-3.1-8b-instruct': {} },
            env: ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_KEY'],
            api: 'https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/v1',
          },
        }),
      });
      await gateway.fetchProviders();
    });

    it('should return URL even when API key is missing', () => {
      const url = gateway.buildUrl('openai/gpt-4');
      expect(url).toBe('https://api.openai.com/v1');
    });

    it('should use custom base URL from env vars', () => {
      const url = gateway.buildUrl('openai/gpt-4', {
        OPENAI_API_KEY: 'sk-test',
        OPENAI_BASE_URL: 'https://custom.openai.proxy/v1',
      });
      expect(url).toBe('https://custom.openai.proxy/v1');
    });

    it('should interpolate URL template variables from env vars', () => {
      const url = gateway.buildUrl('cloudflare-workers-ai/@cf/meta/llama-3.1-8b-instruct', {
        CLOUDFLARE_ACCOUNT_ID: 'account-123',
      });

      expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/account-123/ai/v1');
    });

    it('should not fall back to process.env when env vars explicitly provide an empty string', () => {
      vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'account-123');

      const url = gateway.buildUrl('cloudflare-workers-ai/@cf/meta/llama-3.1-8b-instruct', {
        CLOUDFLARE_ACCOUNT_ID: '',
      });

      expect(url).toBe('https://api.cloudflare.com/client/v4/accounts//ai/v1');
    });

    it('should throw when a required URL template variable is missing', () => {
      const previous = process.env.CLOUDFLARE_ACCOUNT_ID;
      delete process.env.CLOUDFLARE_ACCOUNT_ID;
      try {
        expect(() => gateway.buildUrl('cloudflare-workers-ai/@cf/meta/llama-3.1-8b-instruct', {})).toThrow(
          'Missing environment variable CLOUDFLARE_ACCOUNT_ID required to build provider URL',
        );
      } finally {
        if (previous !== undefined) process.env.CLOUDFLARE_ACCOUNT_ID = previous;
      }
    });

    it('should return false for invalid model ID format', () => {
      expect(() => gateway.buildUrl('invalid-format', { OPENAI_API_KEY: 'sk-test' })).toThrow();
    });
  });

  describe('resolveLanguageModel', () => {
    it.each([
      {
        providerId: 'openai',
        factory: createOpenAIMock,
        modelInvoker: openAIResponsesMock,
        model: { provider: 'openai' },
      },
      {
        providerId: 'google',
        factory: createGoogleGenerativeAIMock,
        modelInvoker: chatModelMock,
        model: { provider: 'chat' },
      },
      {
        providerId: 'gemini',
        factory: createGoogleGenerativeAIMock,
        modelInvoker: chatModelMock,
        model: { provider: 'chat' },
      },
      {
        providerId: 'anthropic',
        factory: createAnthropicMock,
        modelInvoker: callableModelMock,
        model: { provider: 'callable' },
      },
      {
        providerId: 'mistral',
        factory: createMistralMock,
        modelInvoker: callableModelMock,
        model: { provider: 'callable' },
      },
      { providerId: 'groq', factory: createGroqMock, modelInvoker: callableModelMock, model: { provider: 'callable' } },
      {
        providerId: 'openrouter',
        factory: createOpenRouterMock,
        modelInvoker: callableModelMock,
        model: { provider: 'callable' },
      },
      { providerId: 'xai', factory: createXaiMock, modelInvoker: callableModelMock, model: { provider: 'callable' } },
      {
        providerId: 'deepseek',
        factory: createDeepSeekMock,
        modelInvoker: callableModelMock,
        model: { provider: 'callable' },
      },
      {
        providerId: 'perplexity',
        factory: createPerplexityMock,
        modelInvoker: callableModelMock,
        model: { provider: 'callable' },
      },
      {
        providerId: 'cerebras',
        factory: createCerebrasMock,
        modelInvoker: callableModelMock,
        model: { provider: 'callable' },
      },
      {
        providerId: 'togetherai',
        factory: createTogetherAIMock,
        modelInvoker: callableModelMock,
        model: { provider: 'callable' },
      },
      {
        providerId: 'deepinfra',
        factory: createDeepInfraMock,
        modelInvoker: callableModelMock,
        model: { provider: 'callable' },
      },
      {
        providerId: 'vercel',
        factory: createGatewayMock,
        modelInvoker: callableModelMock,
        model: { provider: 'callable' },
      },
    ])(
      'passes provider base URL env overrides to the $providerId provider',
      async ({ providerId, factory, modelInvoker, model }) => {
        gateway = new ModelsDevGateway({
          [providerId]: {
            apiKeyEnvVar: `${providerId.toUpperCase()}_API_KEY`,
            name: providerId,
            models: ['test-model'],
            gateway: 'models.dev',
            url: `https://api.${providerId}.example/v1`,
          },
        });

        vi.stubEnv(`${providerId.toUpperCase()}_BASE_URL`, `https://custom.${providerId}.proxy/v1`);

        const result = await gateway.resolveLanguageModel({
          providerId,
          modelId: 'test-model',
          apiKey: 'sk-test',
          headers: { 'x-test': 'true' },
        });

        expect(result).toEqual(model);
        expect(factory).toHaveBeenCalledWith({
          apiKey: 'sk-test',
          baseURL: `https://custom.${providerId}.proxy/v1`,
          headers: expect.objectContaining({
            'x-test': 'true',
          }),
        });
        expect(modelInvoker).toHaveBeenCalledWith('test-model');
      },
    );
  });

  describe('per-model provider overrides', () => {
    it('captures a model-level provider override from models.dev into modelOverrides', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          neon: {
            id: 'neon',
            name: 'Neon',
            npm: '@ai-sdk/openai-compatible',
            api: '${NEON_AI_GATEWAY_BASE_URL}/ai-gateway/mlflow/v1',
            env: ['NEON_AI_GATEWAY_BASE_URL', 'NEON_AI_GATEWAY_TOKEN'],
            models: {
              'gpt-5-mini': {
                name: 'GPT-5 mini',
                provider: {
                  npm: '@ai-sdk/openai',
                  api: '${NEON_AI_GATEWAY_BASE_URL}/ai-gateway/openai/v1',
                  shape: 'responses',
                },
              },
              'claude-haiku-4-5': { name: 'Claude Haiku 4.5' },
            },
          },
        }),
      });

      const providers = await gateway.fetchProviders();

      expect(providers.neon.modelOverrides).toEqual({
        'gpt-5-mini': {
          npm: '@ai-sdk/openai',
          api: '${NEON_AI_GATEWAY_BASE_URL}/ai-gateway/openai/v1',
          shape: 'responses',
        },
      });
    });

    const overrideGateway = () =>
      new ModelsDevGateway({
        neon: {
          apiKeyEnvVar: 'NEON_AI_GATEWAY_TOKEN',
          name: 'Neon',
          models: ['gpt-5-mini', 'claude-haiku-4-5'],
          gateway: 'models.dev',
          url: 'https://ex.neon.tech/ai-gateway/mlflow/v1',
          modelOverrides: {
            'gpt-5-mini': { api: 'https://ex.neon.tech/ai-gateway/openai/v1', shape: 'responses' },
          },
        },
      });

    it('routes a shape="responses" model via the OpenAI Responses API on a chat-completions provider', async () => {
      gateway = overrideGateway();

      const result = await gateway.resolveLanguageModel({
        providerId: 'neon',
        modelId: 'gpt-5-mini',
        apiKey: 'nt_live_test',
        headers: { 'x-test': 'true' },
      });

      expect(result).toEqual({ provider: 'openai' });
      expect(createOpenAIMock).toHaveBeenCalledWith({
        apiKey: 'nt_live_test',
        baseURL: 'https://ex.neon.tech/ai-gateway/openai/v1',
        headers: expect.objectContaining({ 'x-test': 'true' }),
      });
      expect(openAIResponsesMock).toHaveBeenCalledWith('gpt-5-mini');
    });

    it('buildUrl prefers the per-model override endpoint over the provider default', () => {
      gateway = overrideGateway();

      expect(gateway.buildUrl('neon/gpt-5-mini')).toBe('https://ex.neon.tech/ai-gateway/openai/v1');
      expect(gateway.buildUrl('neon/claude-haiku-4-5')).toBe('https://ex.neon.tech/ai-gateway/mlflow/v1');
    });
  });

  describe('integration', () => {
    it('should handle full flow: fetch, buildUrl, buildHeaders', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          groq: {
            id: 'groq',
            name: 'Groq',
            models: {
              'llama-3.1-70b': { name: 'Llama 3.1 70B' },
              'mixtral-8x7b': { name: 'Mixtral 8x7B' },
            },
            env: ['GROQ_API_KEY'],
            api: 'https://api.groq.com/openai/v1',
            npm: '@ai-sdk/openai-compatible',
          },
        }),
      });

      const providers = await gateway.fetchProviders();
      expect(providers.groq).toBeDefined();

      const url = gateway.buildUrl('groq/llama-3.1-70b', { GROQ_API_KEY: 'gsk-test' });
      expect(url).toBe('https://api.groq.com/openai/v1');
    });

    it('should correctly identify all major providers', async () => {
      const majorProviders = {
        openai: { npm: '@ai-sdk/openai', api: 'https://api.openai.com/v1' },
        anthropic: { npm: '@ai-sdk/anthropic', api: 'https://api.anthropic.com/v1' },
        groq: { npm: '@ai-sdk/openai-compatible', api: 'https://api.groq.com/openai/v1' },
        cerebras: { npm: '@ai-sdk/cerebras' },
        xai: { npm: '@ai-sdk/openai-compatible' },
        mistral: { npm: '@ai-sdk/mistral', api: 'https://api.mistral.ai/v1' },
        google: { npm: '@ai-sdk/google' },
        togetherai: { npm: '@ai-sdk/togetherai' },
        deepinfra: { npm: '@ai-sdk/deepinfra' },
        perplexity: { npm: '@ai-sdk/openai-compatible', api: 'https://api.perplexity.ai' },
      };

      const mockData: Record<string, any> = {};
      for (const [id, info] of Object.entries(majorProviders)) {
        mockData[id] = {
          id,
          name: id.charAt(0).toUpperCase() + id.slice(1),
          models: { 'test-model': {} },
          env: [`${id.toUpperCase()}_API_KEY`],
          ...info,
        };
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const providers = await gateway.fetchProviders();

      // All these providers should be identified as OpenAI-compatible
      expect(providers.openai).toBeDefined();
      expect(providers.anthropic).toBeDefined();
      expect(providers.groq).toBeDefined();
      expect(providers.cerebras).toBeDefined();
      expect(providers.xai).toBeDefined();
      expect(providers.mistral).toBeDefined();
      expect(providers.google).toBeDefined();
      expect(providers.togetherai).toBeDefined();
      expect(providers.deepinfra).toBeDefined();
      expect(providers.perplexity).toBeDefined();
    });
  });

  describe('getApiKey', () => {
    const createGoogleGateway = () =>
      new ModelsDevGateway({
        google: {
          apiKeyEnvVar: ['GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
          name: 'Google',
          models: ['gemini-3.1-flash-lite'],
          gateway: 'models.dev',
        },
      });

    it('should prefer Google API key env var over legacy env var', async () => {
      vi.stubEnv('GOOGLE_API_KEY', 'google-key');
      vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'legacy-google-key');

      gateway = createGoogleGateway();

      await expect(gateway.getApiKey('google/gemini-3.1-flash-lite')).resolves.toBe('google-key');
    });

    it('should fall back to legacy Google Generative AI API key env var', async () => {
      vi.stubEnv('GOOGLE_API_KEY', '');
      vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'legacy-google-key');

      gateway = createGoogleGateway();

      await expect(gateway.getApiKey('google/gemini-3.1-flash-lite')).resolves.toBe('legacy-google-key');
    });
  });
});
