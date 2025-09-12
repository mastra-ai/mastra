import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NetlifyGateway } from './netlify.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('NetlifyGateway', () => {
  let gateway: NetlifyGateway;

  beforeEach(() => {
    gateway = new NetlifyGateway();
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchProviders', () => {
    const mockNetlifyResponse = {
      providers: {
        openai: {
          token_env_var: 'OPENAI_API_KEY',
          url_env_var: 'OPENAI_BASE_URL',
          models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo', 'o1', 'o1-mini'],
        },
        anthropic: {
          token_env_var: 'ANTHROPIC_API_KEY',
          url_env_var: 'ANTHROPIC_BASE_URL',
          models: ['claude-3-5-haiku-20241022', 'claude-3-7-sonnet-20250219'],
        },
        gemini: {
          token_env_var: 'GEMINI_API_KEY',
          url_env_var: 'GOOGLE_GEMINI_BASE_URL',
          models: ['gemini-2.5-flash', 'gemini-1.5-pro'],
        },
      },
    };

    it('should fetch and parse providers from Netlify API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockNetlifyResponse,
      });

      const providers = await gateway.fetchProviders();

      expect(mockFetch).toHaveBeenCalledWith('https://api.netlify.com/api/v1/ai-gateway/providers');
      expect(providers).toBeDefined();
      expect(Object.keys(providers).length).toBe(3);
    });

    it('should prefix all provider IDs with "netlify/"', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockNetlifyResponse,
      });

      const providers = await gateway.fetchProviders();

      // All provider IDs should start with "netlify/"
      expect(providers['netlify/openai']).toBeDefined();
      expect(providers['netlify/anthropic']).toBeDefined();
      expect(providers['netlify/gemini']).toBeDefined();

      // Original IDs without prefix should not exist
      expect(providers['openai']).toBeUndefined();
      expect(providers['anthropic']).toBeUndefined();
      expect(providers['gemini']).toBeUndefined();
    });

    it('should convert Netlify format to standard ProviderConfig format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockNetlifyResponse,
      });

      const providers = await gateway.fetchProviders();

      const openaiConfig = providers['netlify/openai'];
      expect(openaiConfig).toBeDefined();
      expect(openaiConfig.url).toBe('https://api.netlify.com/api/v1/ai-gateway/openai/chat/completions');
      expect(openaiConfig.apiKeyEnvVar).toBe('OPENAI_API_KEY');
      expect(openaiConfig.apiKeyHeader).toBe('Authorization');
      expect(openaiConfig.name).toBe('Openai (via Netlify)');
      expect(openaiConfig.models).toEqual(['gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini']);
    });

    it('should sort model IDs alphabetically', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockNetlifyResponse,
      });

      const providers = await gateway.fetchProviders();

      const openaiModels = providers['netlify/openai'].models;
      const sortedModels = [...openaiModels].sort();
      expect(openaiModels).toEqual(sortedModels);
    });

    it('should handle API fetch errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      await expect(gateway.fetchProviders()).rejects.toThrow('Failed to fetch from Netlify: Internal Server Error');
    });
  });

  describe('buildUrl', () => {
    it('should return correct URL for Netlify-prefixed model IDs', () => {
      const url = gateway.buildUrl('netlify/openai/gpt-4o', {
        NETLIFY_API_KEY: 'netlify-key',
      });
      expect(url).toBe('https://api.netlify.com/api/v1/ai-gateway/openai/chat/completions');
    });

    it('should return false for non-Netlify model IDs', () => {
      const url = gateway.buildUrl('openai/gpt-4o', {
        NETLIFY_API_KEY: 'netlify-key',
      });
      expect(url).toBe(false);
    });

    it('should return false when no API key is available', () => {
      const url = gateway.buildUrl('netlify/openai/gpt-4o', {});
      expect(url).toBe(false);
    });

    it('should accept provider API key when Netlify key is missing', () => {
      const url = gateway.buildUrl('netlify/openai/gpt-4o', {
        OPENAI_API_KEY: 'sk-test',
      });
      expect(url).toBe('https://api.netlify.com/api/v1/ai-gateway/openai/chat/completions');
    });

    it('should use custom Netlify gateway URL from env vars', () => {
      const url = gateway.buildUrl('netlify/openai/gpt-4o', {
        NETLIFY_API_KEY: 'netlify-key',
        NETLIFY_AI_GATEWAY_URL: 'https://custom.netlify.gateway',
      });
      expect(url).toBe('https://custom.netlify.gateway/openai/chat/completions');
    });

    it('should return false for invalid model ID format', () => {
      const url = gateway.buildUrl('netlify/invalid', {
        NETLIFY_API_KEY: 'netlify-key',
      });
      expect(url).toBe(false);
    });
  });

  describe('buildHeaders', () => {
    it('should build Authorization header with Netlify API key', () => {
      const headers = gateway.buildHeaders('netlify/openai/gpt-4o', {
        NETLIFY_API_KEY: 'netlify-key',
      });
      expect(headers).toEqual({
        Authorization: 'Bearer netlify-key',
      });
    });

    it('should fall back to provider API key when Netlify key is missing', () => {
      const headers = gateway.buildHeaders('netlify/openai/gpt-4o', {
        OPENAI_API_KEY: 'sk-test',
      });
      expect(headers).toEqual({
        Authorization: 'Bearer sk-test',
      });
    });

    it('should return empty object for non-Netlify model IDs', () => {
      const headers = gateway.buildHeaders('openai/gpt-4o', {
        NETLIFY_API_KEY: 'netlify-key',
      });
      expect(headers).toEqual({});
    });

    it('should return empty object when no API key is available', () => {
      const headers = gateway.buildHeaders('netlify/openai/gpt-4o', {});
      expect(headers).toEqual({});
    });

    it('should map provider names to correct env vars', () => {
      // Test OpenAI
      let headers = gateway.buildHeaders('netlify/openai/gpt-4o', {
        OPENAI_API_KEY: 'sk-openai',
      });
      expect(headers.Authorization).toBe('Bearer sk-openai');

      // Test Anthropic
      headers = gateway.buildHeaders('netlify/anthropic/claude-3', {
        ANTHROPIC_API_KEY: 'ant-key',
      });
      expect(headers.Authorization).toBe('Bearer ant-key');

      // Test Gemini
      headers = gateway.buildHeaders('netlify/gemini/gemini-pro', {
        GEMINI_API_KEY: 'gem-key',
      });
      expect(headers.Authorization).toBe('Bearer gem-key');
    });

    it('should prefer Netlify API key over provider key', () => {
      const headers = gateway.buildHeaders('netlify/openai/gpt-4o', {
        NETLIFY_API_KEY: 'netlify-key',
        OPENAI_API_KEY: 'sk-openai',
      });
      expect(headers).toEqual({
        Authorization: 'Bearer netlify-key',
      });
    });
  });

  describe('integration', () => {
    it('should handle full flow: fetch, buildUrl, buildHeaders', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          providers: {
            openai: {
              token_env_var: 'OPENAI_API_KEY',
              url_env_var: 'OPENAI_BASE_URL',
              models: ['gpt-4o'],
            },
          },
        }),
      });

      const providers = await gateway.fetchProviders();
      expect(providers['netlify/openai']).toBeDefined();

      const url = gateway.buildUrl('netlify/openai/gpt-4o', {
        NETLIFY_API_KEY: 'netlify-test',
      });
      expect(url).toBe('https://api.netlify.com/api/v1/ai-gateway/openai/chat/completions');

      const headers = gateway.buildHeaders('netlify/openai/gpt-4o', {
        NETLIFY_API_KEY: 'netlify-test',
      });
      expect(headers).toEqual({
        Authorization: 'Bearer netlify-test',
      });
    });

    it('should correctly handle all three providers from Netlify', async () => {
      const fullResponse = {
        providers: {
          openai: {
            token_env_var: 'OPENAI_API_KEY',
            url_env_var: 'OPENAI_BASE_URL',
            models: ['gpt-4o', 'o1'],
          },
          anthropic: {
            token_env_var: 'ANTHROPIC_API_KEY',
            url_env_var: 'ANTHROPIC_BASE_URL',
            models: ['claude-3-5-haiku-20241022'],
          },
          gemini: {
            token_env_var: 'GEMINI_API_KEY',
            url_env_var: 'GOOGLE_GEMINI_BASE_URL',
            models: ['gemini-2.5-flash'],
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => fullResponse,
      });

      const providers = await gateway.fetchProviders();

      // Check all providers are present with correct prefixes
      expect(Object.keys(providers)).toEqual(['netlify/openai', 'netlify/anthropic', 'netlify/gemini']);

      // Verify each provider's configuration
      expect(providers['netlify/openai'].models).toContain('gpt-4o');
      expect(providers['netlify/anthropic'].models).toContain('claude-3-5-haiku-20241022');
      expect(providers['netlify/gemini'].models).toContain('gemini-2.5-flash');
    });
  });
});
