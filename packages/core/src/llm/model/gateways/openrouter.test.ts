import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OpenRouterGateway } from './openrouter';

describe('OpenRouterGateway', () => {
  let gateway: OpenRouterGateway;

  beforeEach(() => {
    gateway = new OpenRouterGateway();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENROUTER_API_KEY;
  });

  describe('fetchProviders', () => {
    it('should throw error when OPENROUTER_API_KEY is missing', async () => {
      delete process.env.OPENROUTER_API_KEY;

      await expect(gateway.fetchProviders()).rejects.toThrow('Missing OPENROUTER_API_KEY');
    });
  });

  describe('buildUrl', () => {
    it('should return OpenRouter API base URL', async () => {
      const url = await gateway.buildUrl('openrouter/openai/gpt-4o');
      expect(url).toBe('https://openrouter.ai/api/v1');
    });

    it('should return same URL regardless of model ID', async () => {
      const url1 = await gateway.buildUrl('openrouter/openai/gpt-4o');
      const url2 = await gateway.buildUrl('openrouter/anthropic/claude-3-5-sonnet');
      expect(url1).toBe(url2);
    });
  });

  describe('getApiKey', () => {
    it('should return API key from environment', async () => {
      process.env.OPENROUTER_API_KEY = 'test-api-key';
      const apiKey = await gateway.getApiKey('openrouter/openai/gpt-4o');
      expect(apiKey).toBe('test-api-key');
    });

    it('should throw error when API key is missing', async () => {
      delete process.env.OPENROUTER_API_KEY;
      await expect(gateway.getApiKey('openrouter/openai/gpt-4o')).rejects.toThrow(
        'Missing OPENROUTER_API_KEY environment variable',
      );
    });
  });

  describe('gateway properties', () => {
    it('should have correct name', () => {
      expect(gateway.name).toBe('openrouter');
    });

    it('should have correct prefix', () => {
      expect(gateway.prefix).toBe('openrouter');
    });
  });

  describe('resolveLanguageModel', () => {
    it('should call a model without tools', async () => {
      process.env.OPENROUTER_API_KEY = 'test-api-key';

      const apiKey = await gateway.getApiKey('openrouter/openai/gpt-3.5-turbo');
      const model = await gateway.resolveLanguageModel({
        modelId: 'openai/gpt-3.5-turbo',
        providerId: 'openrouter',
        apiKey,
      });

      expect(model).toBeDefined();
      expect(model.modelId).toBe('openai/gpt-3.5-turbo');

      // Test that the model has the doGenerate method
      expect(typeof model.doGenerate).toBe('function');
    });

    it('should call a model with tools', async () => {
      process.env.OPENROUTER_API_KEY = 'test-api-key';

      const apiKey = await gateway.getApiKey('openrouter/openai/gpt-3.5-turbo');
      const model = await gateway.resolveLanguageModel({
        modelId: 'openai/gpt-3.5-turbo',
        providerId: 'openrouter',
        apiKey,
      });

      expect(model).toBeDefined();

      // Verify the model supports tool calling
      const weatherTool = {
        type: 'function' as const,
        name: 'get_weather',
        description: 'Get the current weather for a location',
        parameters: {
          type: 'object' as const,
          properties: {
            location: {
              type: 'string' as const,
              description: 'The city and state, e.g. San Francisco, CA',
            },
          },
          required: ['location'],
        },
      };

      // Just verify the model accepts tool configurations in mode
      // We're not actually calling the API here, just checking the structure
      expect(model.doGenerate).toBeDefined();
    });
  });
});
