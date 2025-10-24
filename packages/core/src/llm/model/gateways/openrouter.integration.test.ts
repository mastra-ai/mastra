import { describe, it, expect } from 'vitest';
import { OpenRouterGateway } from './openrouter.js';

// This is an integration test that hits the real OpenRouter API
// Requires OPENROUTER_API_KEY to be set in environment
// Run with: pnpm test openrouter.integration.test.ts
describe('OpenRouterGateway - Real API Integration', () => {
  const gateway = new OpenRouterGateway();

  it('should fetch real data from OpenRouter and validate shape', async () => {
    if (!process.env.OPENROUTER_API_KEY) {
      console.warn('Skipping OpenRouter integration test - OPENROUTER_API_KEY not set');
      return;
    }

    const providers = await gateway.fetchProviders();

    // Basic structure validation
    expect(providers).toBeDefined();
    expect(typeof providers).toBe('object');
    expect(Object.keys(providers).length).toBeGreaterThan(0);

    // OpenRouter should return a single provider
    expect(Object.keys(providers)).toEqual(['openrouter']);
    expect(providers['openrouter']).toBeDefined();

    const openrouterConfig = providers['openrouter'];

    console.log(`\nFetched OpenRouter provider with ${openrouterConfig.models.length} models`);

    // Check required fields
    expect(openrouterConfig.url).toBe('https://openrouter.ai/api/v1');
    expect(openrouterConfig.apiKeyEnvVar).toBe('OPENROUTER_API_KEY');
    expect(openrouterConfig.apiKeyHeader).toBe('Authorization');
    expect(openrouterConfig.name).toBe('OpenRouter');
    expect(openrouterConfig.gateway).toBe('openrouter');
    expect(openrouterConfig.docUrl).toBe('https://openrouter.ai/docs');
    expect(Array.isArray(openrouterConfig.models)).toBe(true);
    expect(openrouterConfig.models.length).toBeGreaterThan(0);

    // Check that models are sorted
    const sortedModels = [...openrouterConfig.models].sort();
    expect(openrouterConfig.models).toEqual(sortedModels);

    // Check that models include provider prefixes (e.g., "openai/gpt-4", "anthropic/claude-3-sonnet")
    const hasOpenAIModels = openrouterConfig.models.some(m => m.startsWith('openai/'));
    const hasAnthropicModels = openrouterConfig.models.some(m => m.startsWith('anthropic/'));
    expect(hasOpenAIModels).toBe(true);
    expect(hasAnthropicModels).toBe(true);

    // Log some statistics
    console.log(`\nStatistics:`);
    console.log(`- Total models: ${openrouterConfig.models.length}`);
    console.log(`- Sample models: ${openrouterConfig.models.slice(0, 5).join(', ')}...`);
  }, 30000); // 30 second timeout for real API call

  it('should correctly build URLs for OpenRouter models', async () => {
    const url = await gateway.buildUrl('openrouter/openai/gpt-4o');
    expect(url).toBe('https://openrouter.ai/api/v1');
  });

  it('should correctly get API key from environment', async () => {
    if (!process.env.OPENROUTER_API_KEY) {
      console.warn('Skipping API key test - OPENROUTER_API_KEY not set');
      return;
    }

    const apiKey = await gateway.getApiKey('openrouter/openai/gpt-4o');
    expect(apiKey).toBe(process.env.OPENROUTER_API_KEY);
  });

  it('should throw error when API key is missing', async () => {
    const originalKey = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    try {
      await expect(gateway.getApiKey('openrouter/openai/gpt-4o')).rejects.toThrow(
        'Missing OPENROUTER_API_KEY environment variable',
      );
    } finally {
      if (originalKey) {
        process.env.OPENROUTER_API_KEY = originalKey;
      }
    }
  });

  it('should cache provider results on subsequent calls', async () => {
    if (!process.env.OPENROUTER_API_KEY) {
      console.warn('Skipping caching test - OPENROUTER_API_KEY not set');
      return;
    }

    // First call
    const start1 = Date.now();
    const providers1 = await gateway.fetchProviders();
    const duration1 = Date.now() - start1;

    // Second call (should be cached)
    const start2 = Date.now();
    const providers2 = await gateway.fetchProviders();
    const duration2 = Date.now() - start2;

    console.log(`\nCaching test:`);
    console.log(`- First call: ${duration1}ms`);
    console.log(`- Second call: ${duration2}ms (cached)`);

    // Cached call should be significantly faster
    expect(duration2).toBeLessThan(duration1 / 2);

    // Results should be identical
    expect(providers1).toEqual(providers2);
  }, 60000); // 60 second timeout for two API calls

  it('should have correct gateway properties', () => {
    expect(gateway.name).toBe('openrouter');
    expect(gateway.prefix).toBe('openrouter');
  });

  it('should work with Agent class', async () => {
    if (!process.env.OPENROUTER_API_KEY) {
      console.warn('Skipping Agent integration test - OPENROUTER_API_KEY not set');
      return;
    }

    const { Agent } = await import('../../../agent/index.js');

    const agent = new Agent({
      name: 'my-agent',
      instructions: 'You are a helpful assistant',
      model: 'openrouter/anthropic/claude-3.5-haiku',
    });

    expect(agent).toBeDefined();
    expect(agent.name).toBe('my-agent');

    // Test basic generation
    const result = await agent.generate('Say hello in exactly 3 words');

    expect(result).toBeDefined();
    expect(result.text).toBeDefined();
    expect(typeof result.text).toBe('string');
    console.log('Agent response:', result.text);
  }, 30000); // 30 second timeout for real API call
});
