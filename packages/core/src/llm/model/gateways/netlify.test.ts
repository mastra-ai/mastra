import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NetlifyGateway } from './netlify';

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

    it('should return unprefixed provider IDs (prefixing happens in generate script)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockNetlifyResponse,
      });

      const providers = await gateway.fetchProviders();

      // Provider IDs should be unprefixed at this level
      expect(providers['openai']).toBeDefined();
      expect(providers['anthropic']).toBeDefined();
      expect(providers['gemini']).toBeDefined();

      // Should NOT have prefixed IDs at this level
      expect(providers['netlify/openai']).toBeUndefined();
      expect(providers['netlify/anthropic']).toBeUndefined();
      expect(providers['netlify/gemini']).toBeUndefined();
    });

    it('should convert Netlify format to standard ProviderConfig format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockNetlifyResponse,
      });

      const providers = await gateway.fetchProviders();

      const openaiConfig = providers['openai']!;
      expect(openaiConfig).toBeDefined();
      expect(openaiConfig.url).toBe('NETLIFY_SITE_URL_PLACEHOLDER/openai');
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

      const openaiModels = providers['openai']!.models;
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
    it('should return false when only domain is provided (token exchange required)', async () => {
      const url = await gateway.buildUrl('netlify/openai/gpt-4o', {
        NETLIFY_SITE_DOMAIN: 'example-site.netlify.app',
        NETLIFY_API_KEY: 'netlify-key',
      });
      expect(url).toBe(false); // Token exchange is required
    });

    it('should use token exchange when site ID and token are provided', async () => {
      const mockTokenResponse = {
        token: 'site-specific-token',
        url: 'https://site-id.netlify.app/.netlify/ai/',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      const url = await gateway.buildUrl('netlify/openai/gpt-4o', {
        NETLIFY_SITE_ID: 'site-id-123',
        NETLIFY_TOKEN: 'nfp_token',
      });

      expect(url).toBe('https://site-id.netlify.app/.netlify/ai/completions');
      expect(mockFetch).toHaveBeenCalledWith('https://api.netlify.com/api/v1/sites/site-id-123/ai-gateway/token', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer nfp_token',
        },
      });
    });

    it('should return false for non-Netlify model IDs', async () => {
      const url = await gateway.buildUrl('openai/gpt-4o', {
        NETLIFY_SITE_DOMAIN: 'example-site.netlify.app',
        NETLIFY_API_KEY: 'netlify-key',
      });
      expect(url).toBe(false);
    });

    it('should return false when no site ID is available', async () => {
      const url = await gateway.buildUrl('netlify/openai/gpt-4o', {
        NETLIFY_TOKEN: 'nfp_token',
      });
      expect(url).toBe(false);
    });

    it('should return false when no Netlify token is available', async () => {
      const url = await gateway.buildUrl('netlify/openai/gpt-4o', {
        NETLIFY_SITE_ID: 'site-id-123',
      });
      expect(url).toBe(false);
    });

    it('should return false when only provider API key is available (token required)', async () => {
      const url = await gateway.buildUrl('netlify/openai/gpt-4o', {
        OPENAI_API_KEY: 'sk-test',
      });
      expect(url).toBe(false); // Token exchange is required
    });

    it('should handle token exchange with custom domain in response', async () => {
      const mockTokenResponse = {
        token: 'site-token',
        url: 'https://custom-domain.com/.netlify/ai/',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      const url = await gateway.buildUrl('netlify/openai/gpt-4o', {
        NETLIFY_SITE_ID: 'site-id-custom',
        NETLIFY_TOKEN: 'nfp_token',
      });
      expect(url).toBe('https://custom-domain.com/.netlify/ai/completions');
    });

    it('should handle URLs with trailing slashes in token response', async () => {
      const mockTokenResponse = {
        token: 'site-token',
        url: 'https://example-site.netlify.app/.netlify/ai/', // Already has trailing slash
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      const url = await gateway.buildUrl('netlify/openai/gpt-4o', {
        NETLIFY_SITE_ID: 'site-id-slash',
        NETLIFY_TOKEN: 'nfp_token',
      });
      expect(url).toBe('https://example-site.netlify.app/.netlify/ai/completions');
    });

    it('should handle token fetch failure gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const url = await gateway.buildUrl('netlify/openai/gpt-4o', {
        NETLIFY_SITE_ID: 'site-id-fail',
        NETLIFY_TOKEN: 'invalid-token',
      });
      expect(url).toBe(false); // Should return false on error
    });

    it('should return false for invalid model ID format', async () => {
      const url = await gateway.buildUrl('netlify/invalid', {
        NETLIFY_SITE_DOMAIN: 'example-site.netlify.app',
        NETLIFY_API_KEY: 'netlify-key',
      });
      expect(url).toBe(false);
    });
  });

  describe('buildHeaders', () => {
    it('should throw error when credentials are missing', async () => {
      await expect(gateway.buildHeaders('netlify/openai/gpt-4o', {})).rejects.toThrow(
        'NETLIFY_SITE_ID and NETLIFY_TOKEN are required',
      );
    });

    it('should fetch token and return headers', async () => {
      const mockTokenResponse = {
        token: 'fetched-token',
        url: 'https://site-id.netlify.app/.netlify/ai/',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      const headers = await gateway.buildHeaders('netlify/openai/gpt-4o', {
        NETLIFY_SITE_ID: 'site-id-456',
        NETLIFY_TOKEN: 'nfp_token',
      });

      expect(headers).toEqual({
        Authorization: 'Bearer fetched-token',
      });
    });

    it('should return empty object for non-Netlify model IDs', async () => {
      const headers = await gateway.buildHeaders('openai/gpt-4o', {
        NETLIFY_SITE_ID: 'site-id',
        NETLIFY_TOKEN: 'token',
      });
      expect(headers).toEqual({});
    });

    it('should throw error when no token or credentials available', async () => {
      await expect(gateway.buildHeaders('netlify/openai/gpt-4o', {})).rejects.toThrow(
        'NETLIFY_SITE_ID and NETLIFY_TOKEN are required for Netlify AI Gateway',
      );
    });

    it('should throw error when token fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(
        gateway.buildHeaders('netlify/openai/gpt-4o', {
          NETLIFY_SITE_ID: 'site-id',
          NETLIFY_TOKEN: 'invalid-token',
        }),
      ).rejects.toThrow('Failed to get Netlify AI Gateway token');
    });

    it('should use cached token when making multiple calls', async () => {
      // First call fetches token
      const mockTokenResponse = {
        token: 'cached-token',
        url: 'https://site.netlify.app/.netlify/ai/',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      const envVars = {
        NETLIFY_SITE_ID: 'site-id',
        NETLIFY_TOKEN: 'nfp_token',
      };

      const headers1 = await gateway.buildHeaders('netlify/openai/gpt-4o', envVars);
      expect(headers1).toEqual({
        Authorization: 'Bearer cached-token',
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should use cached token
      const headers2 = await gateway.buildHeaders('netlify/openai/gpt-4o', envVars);
      expect(headers2).toEqual({
        Authorization: 'Bearer cached-token',
      });
      // Should still only have been called once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('integration', () => {
    it('should handle full flow: fetch, buildUrl, buildHeaders', async () => {
      // Mock fetchProviders call
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
      expect(providers['openai']).toBeDefined();

      // Mock token exchange for buildUrl
      const mockTokenResponse = {
        token: 'site-token',
        url: 'https://my-site.netlify.app/.netlify/ai/',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      const envVars = {
        NETLIFY_SITE_ID: 'site-id-test',
        NETLIFY_TOKEN: 'nfp_test',
      };

      const url = await gateway.buildUrl('netlify/openai/gpt-4o', envVars);
      expect(url).toBe('https://my-site.netlify.app/.netlify/ai/completions');

      // buildHeaders should use the same cached token (no additional fetch)
      const headers = await gateway.buildHeaders('netlify/openai/gpt-4o', envVars);
      expect(headers).toEqual({
        Authorization: 'Bearer site-token',
      });

      // Should only have fetched once (cached for second call)
      expect(mockFetch).toHaveBeenCalledTimes(2); // 1 for providers, 1 for token
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

      // Check all providers are present (unprefixed at this level)
      expect(Object.keys(providers)).toEqual(['openai', 'anthropic', 'gemini']);

      // Verify each provider's configuration
      expect(providers['openai']!.models).toContain('gpt-4o');
      expect(providers['anthropic']!.models).toContain('claude-3-5-haiku-20241022');
      expect(providers['gemini']!.models).toContain('gemini-2.5-flash');
    });
  });
});
