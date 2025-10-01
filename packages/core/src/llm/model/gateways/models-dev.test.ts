import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ModelsDevGateway } from './models-dev.js';

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
        // No API URL in the mock, should use override
        npm: '@ai-sdk/openai-compatible',
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

      // cerebras and fireworks-ai use @ai-sdk/openai-compatible
      expect(providers.cerebras).toBeDefined();
      expect(providers['fireworks-ai']).toBeDefined(); // Provider IDs keep hyphens
      expect(providers.cerebras.url).toBe('https://api.cerebras.ai/v1/chat/completions');
    });

    it('should apply OPENAI_COMPATIBLE_OVERRIDES', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      });

      const providers = await gateway.fetchProviders();

      // OpenAI should be included even though it uses @ai-sdk/openai
      expect(providers.openai).toBeDefined();
      expect(providers.openai.url).toBe('https://api.openai.com/v1/chat/completions');

      // Anthropic should have special headers
      expect(providers.anthropic).toBeDefined();
      expect(providers.anthropic.apiKeyHeader).toBe('x-api-key');
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

    it('should ensure URLs end with /chat/completions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      });

      const providers = await gateway.fetchProviders();

      // All URLs should end with /chat/completions
      expect(providers.openai.url).toMatch(/\/chat\/completions$/);
      expect(providers.anthropic.url).toMatch(/\/chat\/completions$/);
      expect(providers['fireworks-ai'].url).toMatch(/\/chat\/completions$/);
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

    it('should return correct URL for known providers', () => {
      const url = gateway.buildUrl('openai/gpt-4', { OPENAI_API_KEY: 'sk-test' });
      expect(url).toBe('https://api.openai.com/v1/chat/completions');
    });

    it('should return false for unknown providers', () => {
      const url = gateway.buildUrl('unknown/model', { UNKNOWN_API_KEY: 'test' });
      expect(url).toBe(false);
    });

    it('should return URL even when API key is missing', () => {
      const url = gateway.buildUrl('openai/gpt-4', {});
      expect(url).toBe('https://api.openai.com/v1/chat/completions');
    });

    it('should use custom base URL from env vars', () => {
      const url = gateway.buildUrl('openai/gpt-4', {
        OPENAI_API_KEY: 'sk-test',
        OPENAI_BASE_URL: 'https://custom.openai.proxy/v1/chat/completions',
      });
      expect(url).toBe('https://custom.openai.proxy/v1/chat/completions');
    });

    it('should return false for invalid model ID format', () => {
      const url = gateway.buildUrl('invalid-format', { OPENAI_API_KEY: 'sk-test' });
      expect(url).toBe(false);
    });
  });

  describe('buildHeaders', () => {
    beforeEach(async () => {
      // Set up gateway with mock data including Anthropic
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
          anthropic: {
            id: 'anthropic',
            name: 'Anthropic',
            models: { 'claude-3': {} },
            env: ['ANTHROPIC_API_KEY'],
            api: 'https://api.anthropic.com/v1',
          },
        }),
      });
      await gateway.fetchProviders();
    });

    it('should build correct Authorization header for standard providers', () => {
      const headers = gateway.buildHeaders('openai/gpt-4', { OPENAI_API_KEY: 'sk-test' });
      expect(headers).toEqual({
        Authorization: 'Bearer sk-test',
      });
    });

    it('should build correct headers for Anthropic', () => {
      const headers = gateway.buildHeaders('anthropic/claude-3', { ANTHROPIC_API_KEY: 'ant-test' });
      expect(headers).toEqual({
        'x-api-key': 'ant-test',
        'anthropic-version': '2023-06-01',
      });
    });

    it('should return empty object when provider unknown', () => {
      const headers = gateway.buildHeaders('unknown/model', { UNKNOWN_API_KEY: 'test' });
      expect(headers).toEqual({});
    });

    it('should return empty object when API key missing', () => {
      const headers = gateway.buildHeaders('openai/gpt-4', {});
      expect(headers).toEqual({});
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
      expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');

      const headers = gateway.buildHeaders('groq/llama-3.1-70b', { GROQ_API_KEY: 'gsk-test' });
      expect(headers).toEqual({
        Authorization: 'Bearer gsk-test',
      });
    });

    it('should correctly identify all major OpenAI-compatible providers', async () => {
      const majorProviders = {
        openai: { npm: '@ai-sdk/openai', api: 'https://api.openai.com/v1' },
        anthropic: { npm: '@ai-sdk/anthropic', api: 'https://api.anthropic.com/v1' },
        groq: { npm: '@ai-sdk/openai-compatible', api: 'https://api.groq.com/openai/v1' },
        cerebras: { npm: '@ai-sdk/openai-compatible' },
        xai: { npm: '@ai-sdk/openai-compatible' },
        mistral: { npm: '@ai-sdk/mistral', api: 'https://api.mistral.ai/v1' },
        google: { npm: '@ai-sdk/google' },
        togetherai: { npm: '@ai-sdk/openai-compatible', api: 'https://api.together.xyz/v1' },
        deepinfra: { npm: '@ai-sdk/openai-compatible', api: 'https://api.deepinfra.com/v1/openai' },
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
});
