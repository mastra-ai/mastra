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

    // Provider IDs should NOT have the netlify/ prefix (prefixing happens in generate script)
    for (const providerId of Object.keys(providers)) {
      expect(providerId.startsWith('netlify/')).toBe(false);
      // Should be plain provider names
      expect(['openai', 'anthropic', 'gemini'].includes(providerId)).toBe(true);
    }

    // Validate each provider has the expected shape
    for (const [providerId, config] of Object.entries(providers)) {
      // Check required fields
      expect(config.url, `Provider ${providerId} missing url`).toBeDefined();
      expect(typeof config.url).toBe('string');
      // URL is a placeholder that will be replaced dynamically
      expect(config.url).toContain('NETLIFY_SITE_URL_PLACEHOLDER');

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
    const expectedProviders = ['openai', 'anthropic', 'gemini'];
    for (const provider of expectedProviders) {
      expect(providers[provider], `Expected provider ${provider} not found`).toBeDefined();
    }

    // Validate specific provider configurations
    if (providers['openai']) {
      const openai = providers['openai'];
      expect(openai.url).toBe('NETLIFY_SITE_URL_PLACEHOLDER/openai');
      expect(openai.apiKeyEnvVar).toBe('OPENAI_API_KEY');
      expect(openai.models.some(m => m.includes('gpt'))).toBe(true);
      // o1 models might not always be available, just check for any model
      expect(openai.models.length).toBeGreaterThan(0);
    }

    if (providers['anthropic']) {
      const anthropic = providers['anthropic'];
      expect(anthropic.url).toBe('NETLIFY_SITE_URL_PLACEHOLDER/anthropic');
      expect(anthropic.apiKeyEnvVar).toBe('ANTHROPIC_API_KEY');
      expect(anthropic.models.some(m => m.includes('claude'))).toBe(true);
    }

    if (providers['gemini']) {
      const gemini = providers['gemini'];
      expect(gemini.url).toBe('NETLIFY_SITE_URL_PLACEHOLDER/gemini');
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

    // Test error when missing required credentials
    const insufficientEnvVars = {
      OPENAI_API_KEY: 'sk-test', // Provider key alone is not enough
    };

    if (providers['openai']) {
      const url = await gateway.buildUrl('netlify/openai/gpt-4o', insufficientEnvVars);
      expect(url).toBe(false); // Should return false without site ID and token

      // buildHeaders should throw error without proper credentials
      await expect(gateway.buildHeaders('netlify/openai/gpt-4o', insufficientEnvVars)).rejects.toThrow(
        'NETLIFY_SITE_ID and NETLIFY_TOKEN are required',
      );
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

  it('should return false for non-Netlify model IDs', async () => {
    // These should all return false since they don't have the netlify/ prefix
    const testEnvVars = {
      NETLIFY_SITE_ID: 'test-site-id',
      NETLIFY_TOKEN: 'test-token',
    };

    expect(await gateway.buildUrl('openai/gpt-4o', testEnvVars)).toBe(false);
    expect(await gateway.buildUrl('anthropic/claude-3', testEnvVars)).toBe(false);
    expect(await gateway.buildUrl('gemini/gemini-pro', testEnvVars)).toBe(false);

    expect(await gateway.buildHeaders('openai/gpt-4o', testEnvVars)).toEqual({});
    expect(await gateway.buildHeaders('anthropic/claude-3', testEnvVars)).toEqual({});
    expect(await gateway.buildHeaders('gemini/gemini-pro', testEnvVars)).toEqual({});
  });
});
