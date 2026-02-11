import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Agent } from '../../agent/index.js';
import { createMockModel } from '../../test-utils/llm-mock.js';

// Mock the @openrouter/ai-sdk-provider-v5 module BEFORE importing it
vi.mock('@openrouter/ai-sdk-provider-v5', async () => {
  return {
    createOpenRouter: vi.fn(),
  };
});

// Now import the mocked module
const { createOpenRouter } = await import('@openrouter/ai-sdk-provider-v5');

describe('ModelRouter - OpenRouter Headers Support', () => {
  beforeEach(() => {
    // Set up environment variable for OpenRouter
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';

    // Setup mock implementation to return a provider with chatModel
    vi.mocked(createOpenRouter).mockReturnValue(
      vi.fn((_modelId: string) => {
        // Return a mock LanguageModelV2 instance
        return createMockModel({
          mockText: 'Hello from OpenRouter!',
        });
      }) as any,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENROUTER_API_KEY;
  });

  describe('Headers passing', () => {
    it('should pass headers to createOpenRouter when using string model id', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'You are a helpful assistant.',
        model: {
          id: 'openrouter/anthropic/claude-3-5-sonnet-20241022',
          headers: {
            'HTTP-Referer': 'http://my-service/',
            'X-Title': 'my-application-name',
          },
        },
      });

      await agent.generate('test', { maxSteps: 1 });

      // Verify createOpenRouter was called with the headers
      expect(createOpenRouter).toHaveBeenCalledWith({
        apiKey: 'test-openrouter-key',
        headers: {
          'HTTP-Referer': 'http://my-service/',
          'X-Title': 'my-application-name',
        },
      });

      // Verify the returned function was called with the model ID
      const mockProviderFn = vi.mocked(createOpenRouter).mock.results[0].value;
      expect(mockProviderFn).toHaveBeenCalledWith('anthropic/claude-3-5-sonnet-20241022');
    });

    it('should pass headers when using providerId/modelId format', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'You are a helpful assistant.',
        model: {
          providerId: 'openrouter/openai',
          modelId: 'gpt-4o',
          headers: {
            'HTTP-Referer': 'https://myapp.com',
            'X-Title': 'MyApp',
          },
        },
      });

      await agent.generate('test', { maxSteps: 1 });

      // Verify createOpenRouter was called with the headers
      expect(createOpenRouter).toHaveBeenCalledWith({
        apiKey: 'test-openrouter-key',
        headers: {
          'HTTP-Referer': 'https://myapp.com',
          'X-Title': 'MyApp',
        },
      });
    });

    it('should work without headers (backward compatibility)', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'You are a helpful assistant.',
        model: 'openrouter/anthropic/claude-3-5-sonnet-20241022',
      });

      await agent.generate('test', { maxSteps: 1 });

      // Verify createOpenRouter was called without headers
      expect(createOpenRouter).toHaveBeenCalledWith({
        apiKey: 'test-openrouter-key',
        headers: undefined,
      });
    });

    it('should pass custom API key along with headers', async () => {
      const customApiKey = 'custom-openrouter-key-123';
      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'You are a helpful assistant.',
        model: {
          id: 'openrouter/meta-llama/llama-3.1-8b-instruct',
          apiKey: customApiKey,
          headers: {
            'HTTP-Referer': 'https://example.com',
            'X-Title': 'Example App',
          },
        },
      });

      await agent.generate('test', { maxSteps: 1 });

      // Verify createOpenRouter was called with custom API key and headers
      expect(createOpenRouter).toHaveBeenCalledWith({
        apiKey: customApiKey,
        headers: {
          'HTTP-Referer': 'https://example.com',
          'X-Title': 'Example App',
        },
      });
    });

    it('should handle multiple header fields', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'You are a helpful assistant.',
        model: {
          id: 'openrouter/google/gemini-pro',
          headers: {
            'HTTP-Referer': 'https://myapp.com',
            'X-Title': 'My Application',
            'X-Custom-Header': 'custom-value',
            'X-User-ID': 'user-123',
          },
        },
      });

      await agent.generate('test', { maxSteps: 1 });

      // Verify all headers were passed
      expect(createOpenRouter).toHaveBeenCalledWith({
        apiKey: 'test-openrouter-key',
        headers: {
          'HTTP-Referer': 'https://myapp.com',
          'X-Title': 'My Application',
          'X-Custom-Header': 'custom-value',
          'X-User-ID': 'user-123',
        },
      });
    });

    it('should support dynamic model config function with headers', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'You are a helpful assistant.',
        model: () => ({
          id: 'openrouter/anthropic/claude-3-5-sonnet-20241022',
          headers: {
            'HTTP-Referer': 'https://dynamic.com',
            'X-Title': 'Dynamic App',
          },
        }),
      });

      await agent.generate('test', { maxSteps: 1 });

      // Verify headers were passed from dynamic config
      expect(createOpenRouter).toHaveBeenCalledWith({
        apiKey: 'test-openrouter-key',
        headers: {
          'HTTP-Referer': 'https://dynamic.com',
          'X-Title': 'Dynamic App',
        },
      });
    });
  });

  describe('Model caching with headers', () => {
    it('should create different model instances for different headers', async () => {
      const agent1 = new Agent({
        id: 'agent-1',
        name: 'agent-1',
        instructions: 'Agent 1',
        model: {
          id: 'openrouter/anthropic/claude-3-5-sonnet-20241022',
          headers: {
            'X-Title': 'App1',
          },
        },
      });

      const agent2 = new Agent({
        id: 'agent-2',
        name: 'agent-2',
        instructions: 'Agent 2',
        model: {
          id: 'openrouter/anthropic/claude-3-5-sonnet-20241022',
          headers: {
            'X-Title': 'App2',
          },
        },
      });

      await agent1.generate('test', { maxSteps: 1 });
      await agent2.generate('test', { maxSteps: 1 });

      // Both should have been called with different headers
      expect(createOpenRouter).toHaveBeenCalledTimes(2);
      expect(createOpenRouter).toHaveBeenNthCalledWith(1, {
        apiKey: 'test-openrouter-key',
        headers: {
          'X-Title': 'App1',
        },
      });
      expect(createOpenRouter).toHaveBeenNthCalledWith(2, {
        apiKey: 'test-openrouter-key',
        headers: {
          'X-Title': 'App2',
        },
      });
    });

    it('should reuse model instance for same headers', async () => {
      const sharedHeaders = {
        'HTTP-Referer': 'https://shared.com',
        'X-Title': 'Shared App',
      };

      const agent1 = new Agent({
        id: 'agent-1',
        name: 'agent-1',
        instructions: 'Agent 1',
        model: {
          id: 'openrouter/anthropic/claude-3-5-sonnet-20241022',
          headers: sharedHeaders,
        },
      });

      const agent2 = new Agent({
        id: 'agent-2',
        name: 'agent-2',
        instructions: 'Agent 2',
        model: {
          id: 'openrouter/anthropic/claude-3-5-sonnet-20241022',
          headers: sharedHeaders,
        },
      });

      await agent1.generate('test', { maxSteps: 1 });
      await agent2.generate('test', { maxSteps: 1 });

      // Should only be called once since headers are the same
      expect(createOpenRouter).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error handling', () => {
    it('should pass headers even when using custom API key (no env var needed)', async () => {
      delete process.env.OPENROUTER_API_KEY;

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'You are a helpful assistant.',
        model: {
          id: 'openrouter/anthropic/claude-3-5-sonnet-20241022',
          apiKey: 'custom-key-no-env',
          headers: {
            'HTTP-Referer': 'http://my-service/',
            'X-Title': 'my-application-name',
          },
        },
      });

      // Should not throw during agent creation
      expect(agent).toBeDefined();

      // Should work with custom API key
      await agent.generate('test', { maxSteps: 1 });

      // Verify headers were passed even without env var
      expect(createOpenRouter).toHaveBeenCalledWith({
        apiKey: 'custom-key-no-env',
        headers: {
          'HTTP-Referer': 'http://my-service/',
          'X-Title': 'my-application-name',
        },
      });
    });
  });
});
