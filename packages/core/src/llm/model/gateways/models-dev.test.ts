import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v5';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ModelsDevGateway } from './models-dev.js';

vi.mock('@ai-sdk/openai-v5', async importOriginal => {
  const original = (await importOriginal()) as any;
  const mockChat = vi.fn().mockReturnValue({ modelId: 'mock-openai-chat', provider: 'openai' });
  const mockResponses = vi.fn().mockReturnValue({ modelId: 'mock-openai-responses', provider: 'openai' });
  return {
    ...original,
    createOpenAI: vi.fn().mockReturnValue({ chat: mockChat, responses: mockResponses }),
  };
});

vi.mock('@ai-sdk/openai-compatible-v5', async importOriginal => {
  const original = (await importOriginal()) as any;
  const mockChatModel = vi.fn().mockReturnValue({ modelId: 'mock-compat-chat', provider: 'openai-compatible' });
  return {
    ...original,
    createOpenAICompatible: vi.fn().mockReturnValue({ chatModel: mockChatModel }),
  };
});

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('ModelsDevGateway', () => {
  let gateway: ModelsDevGateway;

  beforeEach(() => {
    gateway = new ModelsDevGateway();
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
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

    it('should return false for invalid model ID format', () => {
      expect(() => gateway.buildUrl('invalid-format', { OPENAI_API_KEY: 'sk-test' })).toThrow();
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

  describe('resolveLanguageModel', () => {
    it('should use createOpenAI (not openai-compatible) for vercel provider', async () => {
      const gateway = new ModelsDevGateway({
        vercel: {
          url: 'https://ai-gateway.vercel.sh/v1',
          apiKeyEnvVar: 'AI_GATEWAY_API_KEY',
          name: 'Vercel',
          models: ['gpt-4o'],
          gateway: 'models.dev',
        },
      });

      const model = await gateway.resolveLanguageModel({
        modelId: 'gpt-4o',
        providerId: 'vercel',
        apiKey: 'test-key',
      });

      expect(createOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-key',
        baseURL: 'https://ai-gateway.vercel.sh/v1',
        headers: undefined,
      });
      expect(model).toEqual({ modelId: 'mock-openai-chat', provider: 'openai' });
      // Ensure openai-compatible was NOT used
      expect(createOpenAICompatible).not.toHaveBeenCalled();
    });

    it('should pass headers through to createOpenAI for vercel provider', async () => {
      const gateway = new ModelsDevGateway({
        vercel: {
          url: 'https://ai-gateway.vercel.sh/v1',
          apiKeyEnvVar: 'AI_GATEWAY_API_KEY',
          name: 'Vercel',
          models: ['gpt-4o'],
          gateway: 'models.dev',
        },
      });

      await gateway.resolveLanguageModel({
        modelId: 'gpt-4o',
        providerId: 'vercel',
        apiKey: 'test-key',
        headers: { 'x-custom': 'value' },
      });

      expect(createOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-key',
        baseURL: 'https://ai-gateway.vercel.sh/v1',
        headers: { 'x-custom': 'value' },
      });
    });

    it('should throw when vercel provider has no baseURL', async () => {
      const gateway = new ModelsDevGateway({
        vercel: {
          apiKeyEnvVar: 'AI_GATEWAY_API_KEY',
          name: 'Vercel',
          models: ['gpt-4o'],
          gateway: 'models.dev',
          // No url
        },
      });

      await expect(
        gateway.resolveLanguageModel({
          modelId: 'gpt-4o',
          providerId: 'vercel',
          apiKey: 'test-key',
        }),
      ).rejects.toThrow('No API URL found for vercel/gpt-4o');
    });

    it('should use createOpenAICompatible for unknown providers (not vercel)', async () => {
      const gateway = new ModelsDevGateway({
        'some-provider': {
          url: 'https://api.some-provider.com/v1',
          apiKeyEnvVar: 'SOME_PROVIDER_API_KEY',
          name: 'Some Provider',
          models: ['model-1'],
          gateway: 'models.dev',
        },
      });

      await gateway.resolveLanguageModel({
        modelId: 'model-1',
        providerId: 'some-provider',
        apiKey: 'test-key',
      });

      expect(createOpenAICompatible).toHaveBeenCalledWith({
        name: 'some-provider',
        apiKey: 'test-key',
        baseURL: 'https://api.some-provider.com/v1',
        supportsStructuredOutputs: true,
      });
    });
  });
});
