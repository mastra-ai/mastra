import { PROVIDER_REGISTRY } from '@mastra/core/llm';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getProvidersHandler } from './agents';

describe('getProvidersHandler', () => {
  // Store original env
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  it('should return all providers from the registry', async () => {
    const result = await getProvidersHandler();

    expect(result).toHaveProperty('providers');
    expect(Array.isArray(result.providers)).toBe(true);

    // Should have at least some providers
    expect(result.providers.length).toBeGreaterThan(0);

    // Each provider should have the expected structure
    result.providers.forEach(provider => {
      expect(provider).toHaveProperty('id');
      expect(provider).toHaveProperty('name');
      expect(provider).toHaveProperty('envVar');
      expect(provider).toHaveProperty('connected');
      expect(provider).toHaveProperty('models');
      expect(Array.isArray(provider.models)).toBe(true);
    });
  });

  it('should correctly detect connected providers when env vars are set', async () => {
    // Set some API keys
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.ANTHROPIC_API_KEY = 'test-key';

    const result = await getProvidersHandler();

    const openaiProvider = result.providers.find(p => p.id === 'openai');
    const anthropicProvider = result.providers.find(p => p.id === 'anthropic');
    const googleProvider = result.providers.find(p => p.id === 'google');

    // OpenAI and Anthropic should be connected
    expect(openaiProvider?.connected).toBe(true);
    expect(anthropicProvider?.connected).toBe(true);

    // Google should not be connected (no env var set)
    expect(googleProvider?.connected).toBe(false);
  });

  it('should correctly detect disconnected providers when env vars are not set', async () => {
    // Clear all API keys
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    const result = await getProvidersHandler();

    const openaiProvider = result.providers.find(p => p.id === 'openai');
    const anthropicProvider = result.providers.find(p => p.id === 'anthropic');
    const googleProvider = result.providers.find(p => p.id === 'google');

    // All should be disconnected
    expect(openaiProvider?.connected).toBe(false);
    expect(anthropicProvider?.connected).toBe(false);
    expect(googleProvider?.connected).toBe(false);
  });

  it('should include the correct env var name for each provider', async () => {
    const result = await getProvidersHandler();

    const openaiProvider = result.providers.find(p => p.id === 'openai');
    const anthropicProvider = result.providers.find(p => p.id === 'anthropic');

    expect(openaiProvider?.envVar).toBe('OPENAI_API_KEY');
    expect(anthropicProvider?.envVar).toBe('ANTHROPIC_API_KEY');
  });

  it('should include models for each provider', async () => {
    const result = await getProvidersHandler();

    const openaiProvider = result.providers.find(p => p.id === 'openai');

    // OpenAI should have models
    expect(openaiProvider?.models).toBeDefined();
    expect(openaiProvider?.models.length).toBeGreaterThan(0);

    // Should include common OpenAI models
    expect(openaiProvider?.models).toContain('gpt-4');
    expect(openaiProvider?.models).toContain('gpt-3.5-turbo');
  });

  it('should match the structure of PROVIDER_REGISTRY', async () => {
    const result = await getProvidersHandler();

    // Number of providers should match the registry
    const registryProviderCount = Object.keys(PROVIDER_REGISTRY).length;
    expect(result.providers.length).toBe(registryProviderCount);

    // Each provider in the result should exist in the registry
    result.providers.forEach(provider => {
      const registryEntry = PROVIDER_REGISTRY[provider.id as keyof typeof PROVIDER_REGISTRY];
      expect(registryEntry).toBeDefined();
      expect(provider.name).toBe(registryEntry.name);
      expect(provider.envVar).toBe(registryEntry.apiKeyEnvVar);
      // Models should match (converting readonly to regular array)
      expect(provider.models).toEqual([...registryEntry.models]);
    });
  });
});
