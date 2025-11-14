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

    // The implementation returns a single 'netlify' provider with all models
    expect(Object.keys(providers)).toEqual(['netlify']);
    expect(providers['netlify']).toBeDefined();

    // Validate the netlify provider has the expected shape
    const netlifyProvider = providers['netlify'];

    // Check required fields
    // Note: Netlify provider doesn't have a static URL - it's dynamically constructed via token exchange
    expect(netlifyProvider.url).toBeUndefined();

    expect(netlifyProvider.apiKeyEnvVar, 'Provider netlify missing apiKeyEnvVar').toBeDefined();
    expect(Array.isArray(netlifyProvider.apiKeyEnvVar)).toBe(true);
    expect(netlifyProvider.apiKeyEnvVar).toEqual(['NETLIFY_TOKEN', 'NETLIFY_SITE_ID']);

    expect(netlifyProvider.apiKeyHeader, 'Provider netlify missing apiKeyHeader').toBeDefined();
    expect(netlifyProvider.apiKeyHeader).toBe('Authorization'); // Netlify uses standard auth

    expect(netlifyProvider.name, 'Provider netlify missing name').toBeDefined();
    expect(typeof netlifyProvider.name).toBe('string');
    expect(netlifyProvider.name).toContain('Netlify');

    expect(netlifyProvider.gateway, 'Provider netlify missing gateway').toBeDefined();
    expect(netlifyProvider.gateway).toBe('netlify');

    expect(netlifyProvider.models, 'Provider netlify missing models').toBeDefined();
    expect(Array.isArray(netlifyProvider.models)).toBe(true);
    expect(netlifyProvider.models.length, 'Provider netlify has no models').toBeGreaterThan(0);

    // Check that models from all three upstream providers are included
    // Models are prefixed with provider ID (e.g., 'openai/gpt-4o')
    const hasOpenAIModels = netlifyProvider.models.some(m => m.startsWith('openai/'));
    const hasAnthropicModels = netlifyProvider.models.some(m => m.startsWith('anthropic/'));
    const hasGeminiModels = netlifyProvider.models.some(m => m.startsWith('gemini/'));

    expect(hasOpenAIModels).toBe(true);
    expect(hasAnthropicModels).toBe(true);
    expect(hasGeminiModels).toBe(true);

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
});
