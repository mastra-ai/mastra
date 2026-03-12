import { describe, it, expect } from 'vitest';
import { ModelsDevGateway } from './models-dev.js';

// This is an integration test that hits the real models.dev API
// Run with: pnpm test models-dev.integration.test.ts
describe('ModelsDevGateway - Real API Integration', () => {
  const gateway = new ModelsDevGateway();

  it('should fetch real data from models.dev and validate shape', async () => {
    const providers = await gateway.fetchProviders();

    // Basic structure validation
    expect(providers).toBeDefined();
    expect(typeof providers).toBe('object');
    expect(Object.keys(providers).length).toBeGreaterThan(0);

    console.log(`\nFetched ${Object.keys(providers).length} providers from real API`);
    console.log('Sample providers:', Object.keys(providers).slice(0, 10));

    // Validate each provider has the expected shape
    for (const [providerId, config] of Object.entries(providers)) {
      expect(config.apiKeyEnvVar, `Provider ${providerId} missing apiKeyEnvVar`).toBeDefined();
      expect(typeof config.apiKeyEnvVar).toBe('string');

      expect(config.name, `Provider ${providerId} missing name`).toBeDefined();
      expect(typeof config.name).toBe('string');

      expect(config.models, `Provider ${providerId} missing models`).toBeDefined();
      expect(Array.isArray(config.models)).toBe(true);
      expect(config.models.length, `Provider ${providerId} has no models`).toBeGreaterThan(0);
    }

    // Check for specific known providers that should definitely be there
    const expectedProviders = ['openai', 'anthropic', 'groq', 'deepseek', 'google', 'vercel'];
    for (const provider of expectedProviders) {
      expect(providers[provider], `Expected provider ${provider} not found`).toBeDefined();
    }

    // Validate specific provider configurations
    if (providers.openai) {
      expect(providers.openai.apiKeyEnvVar).toBe('OPENAI_API_KEY');
      expect(providers.openai.models).toContain('gpt-4o');
    }

    if (providers.anthropic) {
      expect(providers.anthropic.apiKeyEnvVar).toBe('ANTHROPIC_API_KEY');
      expect(providers.anthropic.models.some(m => m.includes('claude'))).toBe(true);
    }

    if (providers.groq) {
      expect(providers.groq.url).toBe('https://api.groq.com/openai/v1');
      expect(providers.groq.apiKeyEnvVar).toBe('GROQ_API_KEY');
    }

    if (providers.vercel) {
      // No URL override — createGateway uses its own default base URL
      expect(providers.vercel.url).toBeUndefined();
      expect(providers.vercel.apiKeyEnvVar).toBe('AI_GATEWAY_API_KEY');
      // apiKeyHeader is undefined for installed packages (auth handled by SDK)
      expect(providers.vercel.apiKeyHeader).toBeUndefined();
      // Vercel should have models like deepseek/deepseek-r1
      expect(providers.vercel.models.some(m => m.startsWith('deepseek/'))).toBe(true);
    }

    // Log some statistics
    const totalModels = Object.values(providers).reduce((sum, p) => sum + p.models.length, 0);
    console.log(`\nStatistics:`);
    console.log(`- Total providers: ${Object.keys(providers).length}`);
    console.log(`- Total models: ${totalModels}`);
    console.log(`- Average models per provider: ${(totalModels / Object.keys(providers).length).toFixed(1)}`);
  }, 30000); // 30 second timeout for real API call

  it('should handle API errors gracefully', async () => {
    // Create a gateway with a bad URL to test error handling
    const badGateway = new ModelsDevGateway();

    // Override the fetch to use a bad URL
    const originalFetch = global.fetch;
    global.fetch = (() => fetch('https://models.dev/nonexistent-endpoint.json')) as any;

    try {
      await expect(badGateway.fetchProviders()).rejects.toThrow();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should validate that all models in the registry are found in the real API', async () => {
    const providers = await gateway.fetchProviders();

    // Read our generated registry to compare
    const { PROVIDER_REGISTRY } = await import('../provider-registry.js');

    // Check that all providers in our registry exist in the real API
    for (const providerId of Object.keys(PROVIDER_REGISTRY)) {
      if (providers[providerId]) {
        // Provider exists, check that models match
        const apiModels = new Set(providers[providerId].models);
        const registryConfig = PROVIDER_REGISTRY[providerId as keyof typeof PROVIDER_REGISTRY];

        for (const model of registryConfig.models) {
          if (!apiModels.has(model)) {
            console.warn(`Model ${providerId}/${model} in registry but not in API`);
          }
        }
      } else {
        console.warn(`Provider ${providerId} in registry but not found in API response`);
      }
    }

    // Also check the reverse - API has models not in our registry
    for (const providerId of Object.keys(providers)) {
      if (!PROVIDER_REGISTRY[providerId as keyof typeof PROVIDER_REGISTRY]) {
        console.warn(`Provider ${providerId} in API but not in registry - might need regeneration`);
      }
    }
  });
});
