import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Agent } from '../../agent/index.js';
import { createMockModel } from '../../test-utils/llm-mock.js';

// Mock the @ai-sdk/openai-compatible-v5 module BEFORE importing it
vi.mock('@ai-sdk/openai-compatible-v5', async () => {
  return {
    createOpenAICompatible: vi.fn(),
  };
});

// Now import the mocked module
const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible-v5');

describe('ModelRouter - Custom Provider Support', () => {
  beforeEach(() => {
    // Setup mock implementation to return a MockProvider instance
    vi.mocked(createOpenAICompatible).mockReturnValue({
      chatModel: vi.fn((_modelId: string) => {
        // Return a mock LanguageModelV2 instance
        return createMockModel({
          mockText: 'Hello from mock!',
        });
      }),
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Mock verification', () => {
    it('should call createOpenAICompatible with correct parameters', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'You are a helpful assistant.',
        model: {
          providerId: 'my-custom-provider',
          modelId: 'my-model',
          url: 'http://fake-test-server-that-does-not-exist.local:9999/v1',
          apiKey: 'test-key',
        },
      });

      await agent.generate('test', { maxSteps: 1 });

      // Verify createOpenAICompatible was called with the right params
      expect(createOpenAICompatible).toHaveBeenCalledWith({
        name: 'my-custom-provider',
        apiKey: 'test-key',
        baseURL: 'http://fake-test-server-that-does-not-exist.local:9999/v1',
        headers: undefined,
        supportsStructuredOutputs: true,
      });

      // Verify chatModel was called with the modelId
      const mockInstance = vi.mocked(createOpenAICompatible).mock.results[0].value;
      expect(mockInstance.chatModel).toHaveBeenCalledWith('my-model');
    });
  });

  describe('Unknown provider with custom URL', () => {
    it('should allow unknown provider when URL is provided', async () => {
      // This should NOT throw an error during agent creation or execution
      // even though "ollama" is not in the provider registry
      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'You are a helpful assistant.',
        model: {
          providerId: 'ollama',
          modelId: 'llama3.2',
          url: 'http://localhost:11434/v1',
          apiKey: 'not-needed-for-ollama',
        },
      });

      expect(agent).toBeDefined();
      expect(agent.name).toBe('test-agent');
    });

    it('should allow unknown provider with id format when URL is provided', async () => {
      // This should also work with the id: "provider/model" format
      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'You are a helpful assistant.',
        model: {
          id: 'ollama/llama3.2',
          url: 'http://localhost:11434/v1',
          apiKey: 'not-needed-for-ollama',
        },
      });

      expect(agent).toBeDefined();
      expect(agent.name).toBe('test-agent');
    });

    it('should allow any custom provider name when URL is provided', async () => {
      // Test with various custom provider names
      const customProviders = ['my-custom-provider', 'local-llm', 'custom-ai-service', 'test-provider-123'];

      for (const providerId of customProviders) {
        const agent = new Agent({
          id: 'test-agent',
          name: 'test-agent',
          instructions: 'You are a helpful assistant.',
          model: {
            providerId,
            modelId: 'test-model',
            url: 'http://localhost:8080/v1',
            apiKey: 'test-key',
          },
        });

        expect(agent).toBeDefined();
      }
    });

    it('should work with LMStudio provider', async () => {
      // LMStudio is in the registry but this tests the custom URL path
      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'You are a helpful assistant.',
        model: {
          providerId: 'lmstudio',
          modelId: 'custom-model',
          url: 'http://localhost:1234/v1',
          apiKey: 'not-needed',
        },
      });

      expect(agent).toBeDefined();
    });

    it('should handle custom headers with unknown provider', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'You are a helpful assistant.',
        model: {
          id: 'custom-provider/custom-model',
          url: 'http://localhost:8080/v1',
          apiKey: 'test-key',
          headers: {
            'X-Custom-Header': 'custom-value',
          },
        },
      });

      expect(agent).toBeDefined();
    });

    it('should NOT throw error when streaming with unknown provider and custom URL', async () => {
      // This is the main test case from the Slack conversation
      // When a URL is provided, the router should NOT try to validate the provider
      // against the registry, and should NOT call gateway.getApiKey()

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'You are a helpful assistant.',
        model: {
          providerId: 'ollama',
          modelId: 'llama3.2',
          url: 'http://fake-ollama-server.local:9999/v1',
          apiKey: 'not-needed-for-ollama',
        },
      });

      // With the mock in place, this should succeed without any errors
      const result = await agent.generate('test', { maxSteps: 1 });
      expect(result).toBeDefined();
    });
  });

  describe('Unknown provider without custom URL', () => {
    it('should throw helpful error for unknown provider without URL during stream', async () => {
      // This SHOULD throw an error when trying to stream because there's no URL and the provider is unknown
      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'You are a helpful assistant.',
        model: {
          providerId: 'unknown-provider',
          modelId: 'unknown-model',
          // No URL provided
        },
      });

      // The error should happen when trying to use the agent
      await expect(async () => {
        await agent.generate('test');
      }).rejects.toThrow(/Could not find config for provider unknown-provider/);
    });

    it('should throw helpful error for unknown provider in id format without URL during stream', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'You are a helpful assistant.',
        model: 'unknown-provider/unknown-model',
      });

      // The error should happen when trying to use the agent
      await expect(async () => {
        await agent.generate('test');
      }).rejects.toThrow(/Could not find config for provider unknown-provider/);
    });
  });
});
