import { describe, it, expect } from 'vitest';
import { NetlifyGateway } from './netlify.js';

// This is an integration test that hits the real Netlify API
// Run with: pnpm test netlify.integration.test.ts
describe('NetlifyGateway - Real API Integration', () => {
  const gateway = new NetlifyGateway();

  it('should fetch real data from Netlify and validate shape', async () => {
    const providers = await gateway.fetchProviders();

    // Basic structure validation
    expect(providers).toBeDefined();
    expect(typeof providers).toBe('object');
    expect(Object.keys(providers).length).toBeGreaterThan(0);

    console.log(`\nFetched ${Object.keys(providers).length} providers from Netlify API`);
    console.log('Providers:', Object.keys(providers));

    // All provider IDs should have the netlify/ prefix
    for (const providerId of Object.keys(providers)) {
      expect(providerId.startsWith('netlify/')).toBe(true);
    }

    // Validate each provider has the expected shape
    for (const [providerId, config] of Object.entries(providers)) {
      // Check required fields
      expect(config.url, `Provider ${providerId} missing url`).toBeDefined();
      expect(typeof config.url).toBe('string');
      expect(config.url).toMatch(/^https?:\/\//);
      expect(config.url).toContain('netlify.com/api/v1/ai-gateway');
      expect(config.url).toMatch(/\/chat\/completions$/);

      expect(config.apiKeyEnvVar, `Provider ${providerId} missing apiKeyEnvVar`).toBeDefined();
      expect(typeof config.apiKeyEnvVar).toBe('string');

      expect(config.apiKeyHeader, `Provider ${providerId} missing apiKeyHeader`).toBeDefined();
      expect(config.apiKeyHeader).toBe('Authorization'); // Netlify uses standard auth

      expect(config.name, `Provider ${providerId} missing name`).toBeDefined();
      expect(typeof config.name).toBe('string');
      expect(config.name).toContain('(via Netlify)');

      expect(config.models, `Provider ${providerId} missing models`).toBeDefined();
      expect(Array.isArray(config.models)).toBe(true);
      expect(config.models.length, `Provider ${providerId} has no models`).toBeGreaterThan(0);

      // Models should be sorted
      const sortedModels = [...config.models].sort();
      expect(config.models).toEqual(sortedModels);
    }

    // Check for specific known providers that Netlify supports
    const expectedProviders = ['netlify/openai', 'netlify/anthropic', 'netlify/gemini'];
    for (const provider of expectedProviders) {
      expect(providers[provider], `Expected provider ${provider} not found`).toBeDefined();
    }

    // Validate specific provider configurations
    if (providers['netlify/openai']) {
      const openai = providers['netlify/openai'];
      expect(openai.url).toBe('https://api.netlify.com/api/v1/ai-gateway/openai/chat/completions');
      expect(openai.apiKeyEnvVar).toBe('OPENAI_API_KEY');
      expect(openai.models.some(m => m.includes('gpt-4o'))).toBe(true);
      expect(openai.models.some(m => m.includes('o1'))).toBe(true);
    }

    if (providers['netlify/anthropic']) {
      const anthropic = providers['netlify/anthropic'];
      expect(anthropic.url).toBe('https://api.netlify.com/api/v1/ai-gateway/anthropic/chat/completions');
      expect(anthropic.apiKeyEnvVar).toBe('ANTHROPIC_API_KEY');
      expect(anthropic.models.some(m => m.includes('claude'))).toBe(true);
    }

    if (providers['netlify/gemini']) {
      const gemini = providers['netlify/gemini'];
      expect(gemini.url).toBe('https://api.netlify.com/api/v1/ai-gateway/gemini/chat/completions');
      expect(gemini.apiKeyEnvVar).toBe('GEMINI_API_KEY');
      expect(gemini.models.some(m => m.includes('gemini'))).toBe(true);
    }

    // Log some statistics
    const totalModels = Object.values(providers).reduce((sum, p) => sum + p.models.length, 0);
    console.log(`\nStatistics:`);
    console.log(`- Total providers: ${Object.keys(providers).length}`);
    console.log(`- Total models: ${totalModels}`);
    console.log(`- Average models per provider: ${(totalModels / Object.keys(providers).length).toFixed(1)}`);

    // Log models for each provider
    for (const [providerId, config] of Object.entries(providers)) {
      console.log(`\n${providerId}: ${config.models.length} models`);
      console.log(`  Sample models: ${config.models.slice(0, 3).join(', ')}${config.models.length > 3 ? '...' : ''}`);
    }
  }, 30000); // 30 second timeout for real API call

  it('should correctly build URLs and headers for Netlify models', async () => {
    const providers = await gateway.fetchProviders();

    // Test with Netlify API key
    const testEnvVars = {
      NETLIFY_API_KEY: 'netlify-test-key',
      OPENAI_API_KEY: 'sk-test',
      ANTHROPIC_API_KEY: 'ant-test',
      GEMINI_API_KEY: 'gem-test',
    };

    // Test OpenAI via Netlify
    if (providers['netlify/openai']) {
      const url = gateway.buildUrl('netlify/openai/gpt-4o', testEnvVars);
      expect(url).toBe('https://api.netlify.com/api/v1/ai-gateway/openai/chat/completions');

      const headers = gateway.buildHeaders('netlify/openai/gpt-4o', testEnvVars);
      expect(headers).toEqual({ Authorization: 'Bearer netlify-test-key' });
    }

    // Test Anthropic via Netlify
    if (providers['netlify/anthropic']) {
      const url = gateway.buildUrl('netlify/anthropic/claude-3-5-haiku-20241022', testEnvVars);
      expect(url).toBe('https://api.netlify.com/api/v1/ai-gateway/anthropic/chat/completions');

      const headers = gateway.buildHeaders('netlify/anthropic/claude-3-5-haiku-20241022', testEnvVars);
      expect(headers).toEqual({ Authorization: 'Bearer netlify-test-key' });
    }

    // Test fallback to provider API key when Netlify key is missing
    const providerOnlyEnvVars = {
      OPENAI_API_KEY: 'sk-test',
    };

    if (providers['netlify/openai']) {
      const url = gateway.buildUrl('netlify/openai/gpt-4o', providerOnlyEnvVars);
      expect(url).toBe('https://api.netlify.com/api/v1/ai-gateway/openai/chat/completions');

      const headers = gateway.buildHeaders('netlify/openai/gpt-4o', providerOnlyEnvVars);
      expect(headers).toEqual({ Authorization: 'Bearer sk-test' });
    }
  });

  it('should handle API errors gracefully', async () => {
    // Create a gateway with a bad URL to test error handling
    const badGateway = new NetlifyGateway();

    // Override the fetch to use a bad URL
    const originalFetch = global.fetch;
    global.fetch = (() => fetch('https://api.netlify.com/api/v1/nonexistent-endpoint')) as any;

    try {
      await expect(badGateway.fetchProviders()).rejects.toThrow();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should return false for non-Netlify model IDs', () => {
    // These should all return false since they don't have the netlify/ prefix
    const testEnvVars = { NETLIFY_API_KEY: 'test' };

    expect(gateway.buildUrl('openai/gpt-4o', testEnvVars)).toBe(false);
    expect(gateway.buildUrl('anthropic/claude-3', testEnvVars)).toBe(false);
    expect(gateway.buildUrl('gemini/gemini-pro', testEnvVars)).toBe(false);

    expect(gateway.buildHeaders('openai/gpt-4o', testEnvVars)).toEqual({});
    expect(gateway.buildHeaders('anthropic/claude-3', testEnvVars)).toEqual({});
    expect(gateway.buildHeaders('gemini/gemini-pro', testEnvVars)).toEqual({});
  });
});
