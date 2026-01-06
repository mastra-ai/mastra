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
    process.env.NETLIFY_TOKEN = 'ok';
    const mockNetlifyResponse = {
      providers: {
        openai: {
          token_env_var: 'NETLIFY_TOKEN',
          models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo', 'o1', 'o1-mini'],
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
      expect(Object.keys(providers).length).toBe(1);
      expect(providers['netlify']).toBeDefined();
    });

    it('should return netlify provider with models prefixed by upstream provider', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockNetlifyResponse,
      });

      const providers = await gateway.fetchProviders();

      // Should have a single 'netlify' provider
      expect(providers['netlify']).toBeDefined();
      expect(providers['netlify'].models).toContain('openai/gpt-4o');
    });

    it('should convert Netlify format to standard ProviderConfig format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockNetlifyResponse,
      });

      const providers = await gateway.fetchProviders();

      const netlifyConfig = providers['netlify']!;
      expect(netlifyConfig).toBeDefined();
      expect(netlifyConfig.apiKeyEnvVar).toEqual(['NETLIFY_TOKEN', 'NETLIFY_SITE_ID']);
      expect(netlifyConfig.apiKeyHeader).toBe('Authorization');
      expect(netlifyConfig.name).toBe('Netlify');
      expect(netlifyConfig.gateway).toBe('netlify');
      expect(netlifyConfig.models.length).toBeGreaterThan(0);
    });

    it('should include all models from all providers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockNetlifyResponse,
      });

      const providers = await gateway.fetchProviders();

      const netlifyModels = providers['netlify']!.models;
      expect(netlifyModels.length).toBe(5);
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

      expect(url).toBe('https://site-id.netlify.app/.netlify/ai');
      expect(mockFetch).toHaveBeenCalledWith('https://api.netlify.com/api/v1/sites/site-id-123/ai-gateway/token', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer nfp_token',
        },
      });
    });

    it('should throw error when no site ID is available', async () => {
      await expect(
        gateway.buildUrl('netlify/openai/gpt-4o', {
          NETLIFY_TOKEN: 'nfp_token',
        }),
      ).rejects.toThrow('Missing NETLIFY_SITE_ID');
    });

    it('should throw error when only provider API key is available (token required)', async () => {
      await expect(
        gateway.buildUrl('netlify/openai/gpt-4o', {
          OPENAI_API_KEY: 'sk-test',
        }),
      ).rejects.toThrow('Missing NETLIFY_SITE_ID environment variable required for model: netlify/openai/gpt-4o');
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
      expect(url).toBe('https://custom-domain.com/.netlify/ai');
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
      expect(url).toBe('https://example-site.netlify.app/.netlify/ai');
    });

    it('should throw error on token fetch failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(
        gateway.buildUrl('netlify/openai/gpt-4o', {
          NETLIFY_SITE_ID: 'site-id-fail',
          NETLIFY_TOKEN: 'invalid-token',
        }),
      ).rejects.toThrow('Failed to get Netlify AI Gateway token');
    });

    it('should return false for invalid model ID format', async () => {
      await expect(() =>
        gateway.buildUrl('netlify/invalid', {
          NETLIFY_SITE_DOMAIN: 'example-site.netlify.app',
          NETLIFY_API_KEY: 'netlify-key',
        }),
      ).rejects.toThrow();
    });
  });

  describe('integration', () => {
    it('should handle full flow: fetch, buildUrl, buildHeaders', async () => {
      process.env.NETLIFY_TOKEN = 'ok';

      // Mock fetchProviders call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          providers: {
            openai: {
              token_env_var: 'NETLIFY_TOKEN',
              models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo', 'o1', 'o1-mini'],
            },
          },
        }),
      });

      const providers = await gateway.fetchProviders();
      expect(providers['netlify']).toBeDefined();
      expect(providers['netlify'].models).toContain('openai/gpt-4o');

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
      expect(url).toBe('https://my-site.netlify.app/.netlify/ai');

      // Should only have fetched once (cached for second call)
      expect(mockFetch).toHaveBeenCalledTimes(2); // 1 for providers, 1 for token
    });
  });
});
