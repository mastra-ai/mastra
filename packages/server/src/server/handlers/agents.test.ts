import { Agent } from '@mastra/core/agent';
import { PROVIDER_REGISTRY } from '@mastra/core/llm';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HTTPException } from '../http-exception';
import { GET_PROVIDERS_ROUTE, GENERATE_AGENT_ROUTE, STREAM_GENERATE_ROUTE } from './agents';

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
    const result = await GET_PROVIDERS_ROUTE.handler({});

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

    const result = await GET_PROVIDERS_ROUTE.handler({});

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

    const result = await GET_PROVIDERS_ROUTE.handler({});

    const openaiProvider = result.providers.find(p => p.id === 'openai');
    const anthropicProvider = result.providers.find(p => p.id === 'anthropic');
    const googleProvider = result.providers.find(p => p.id === 'google');

    // All should be disconnected
    expect(openaiProvider?.connected).toBe(false);
    expect(anthropicProvider?.connected).toBe(false);
    expect(googleProvider?.connected).toBe(false);
  });

  it('should include the correct env var name for each provider', async () => {
    const result = await GET_PROVIDERS_ROUTE.handler({});

    const openaiProvider = result.providers.find(p => p.id === 'openai');
    const anthropicProvider = result.providers.find(p => p.id === 'anthropic');

    expect(openaiProvider?.envVar).toBe('OPENAI_API_KEY');
    expect(anthropicProvider?.envVar).toBe('ANTHROPIC_API_KEY');
  });

  it('should include models for each provider', async () => {
    const result = await GET_PROVIDERS_ROUTE.handler({});

    const openaiProvider = result.providers.find(p => p.id === 'openai');

    // OpenAI should have models
    expect(openaiProvider?.models).toBeDefined();
    expect(openaiProvider?.models.length).toBeGreaterThan(0);

    // Should include common OpenAI models
    expect(openaiProvider?.models).toContain('gpt-4');
    expect(openaiProvider?.models).toContain('gpt-3.5-turbo');
  });

  it('should match the structure of PROVIDER_REGISTRY', async () => {
    const result = await GET_PROVIDERS_ROUTE.handler({});

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

// ============================================================================
// Authorization Tests
// ============================================================================

describe('Agent Routes Authorization', () => {
  let storage: InMemoryStore;
  let mockMemory: MockMemory;
  let mockAgent: Agent;
  let mastra: Mastra;

  beforeEach(() => {
    storage = new InMemoryStore();
    mockMemory = new MockMemory({ storage });

    mockAgent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'test-instructions',
      model: {} as any,
      memory: mockMemory,
    });

    mastra = new Mastra({
      agents: { 'test-agent': mockAgent },
      logger: false,
    });
  });

  /**
   * Creates a test context with reserved keys set (simulating middleware behavior)
   */
  function createContextWithReservedKeys({
    resourceId,
    threadId,
  }: {
    resourceId?: string;
    threadId?: string;
  }) {
    const requestContext = new RequestContext();
    if (resourceId) {
      requestContext.set(MASTRA_RESOURCE_ID_KEY, resourceId);
    }
    if (threadId) {
      requestContext.set(MASTRA_THREAD_ID_KEY, threadId);
    }
    return requestContext;
  }

  describe('GENERATE_AGENT_ROUTE', () => {
    it('should return 403 when memory option specifies thread owned by different resource', async () => {
      // Create a thread owned by user-b
      await mockMemory.createThread({
        threadId: 'thread-owned-by-b',
        resourceId: 'user-b',
        title: 'Thread B',
      });

      // User-a (via middleware) tries to access thread owned by user-b
      const requestContext = createContextWithReservedKeys({ resourceId: 'user-a' });

      await expect(
        GENERATE_AGENT_ROUTE.handler({
          mastra,
          agentId: 'test-agent',
          requestContext,
          abortSignal: new AbortController().signal,
          messages: [{ role: 'user', content: 'test' }],
          memory: {
            thread: 'thread-owned-by-b',
            resource: 'user-a', // Client tries to use their resource ID
          },
        } as any),
      ).rejects.toThrow(new HTTPException(403, { message: 'Access denied: thread belongs to a different resource' }));
    });

    it('should override client-provided resource with context value', async () => {
      // Create a thread owned by user-a
      await mockMemory.createThread({
        threadId: 'thread-owned-by-a',
        resourceId: 'user-a',
        title: 'Thread A',
      });

      const requestContext = createContextWithReservedKeys({ resourceId: 'user-a' });

      // Mock agent.generate to capture the memory option
      let capturedMemoryOption: any;
      vi.spyOn(mockAgent, 'generate').mockImplementation(async (_messages, options) => {
        capturedMemoryOption = options?.memory;
        return { text: 'mocked response' } as any;
      });

      await GENERATE_AGENT_ROUTE.handler({
        mastra,
        agentId: 'test-agent',
        requestContext,
        abortSignal: new AbortController().signal,
        messages: [{ role: 'user', content: 'test' }],
        memory: {
          thread: 'thread-owned-by-a',
          resource: 'user-b', // Client tries to use different resource ID
        },
      } as any);

      // The resource should be overridden to user-a (from context)
      expect(capturedMemoryOption.resource).toBe('user-a');
    });

    it('should allow access when thread belongs to the same resource', async () => {
      // Create a thread owned by user-a
      await mockMemory.createThread({
        threadId: 'thread-owned-by-a',
        resourceId: 'user-a',
        title: 'Thread A',
      });

      const requestContext = createContextWithReservedKeys({ resourceId: 'user-a' });

      // Mock agent.generate
      vi.spyOn(mockAgent, 'generate').mockResolvedValue({ text: 'mocked response' } as any);

      // Should not throw
      await expect(
        GENERATE_AGENT_ROUTE.handler({
          mastra,
          agentId: 'test-agent',
          requestContext,
          abortSignal: new AbortController().signal,
          messages: [{ role: 'user', content: 'test' }],
          memory: {
            thread: 'thread-owned-by-a',
            resource: 'user-a',
          },
        } as any),
      ).resolves.toBeDefined();
    });
  });

  describe('STREAM_GENERATE_ROUTE', () => {
    it('should return 403 when memory option specifies thread owned by different resource', async () => {
      // Create a thread owned by user-b
      await mockMemory.createThread({
        threadId: 'stream-thread-owned-by-b',
        resourceId: 'user-b',
        title: 'Thread B',
      });

      // User-a (via middleware) tries to access thread owned by user-b
      const requestContext = createContextWithReservedKeys({ resourceId: 'user-a' });

      await expect(
        STREAM_GENERATE_ROUTE.handler({
          mastra,
          agentId: 'test-agent',
          requestContext,
          abortSignal: new AbortController().signal,
          messages: [{ role: 'user', content: 'test' }],
          memory: {
            thread: 'stream-thread-owned-by-b',
            resource: 'user-a',
          },
        } as any),
      ).rejects.toThrow(new HTTPException(403, { message: 'Access denied: thread belongs to a different resource' }));
    });

    it('should override client-provided resource with context value', async () => {
      // Create a thread owned by user-a
      await mockMemory.createThread({
        threadId: 'stream-thread-owned-by-a',
        resourceId: 'user-a',
        title: 'Thread A',
      });

      const requestContext = createContextWithReservedKeys({ resourceId: 'user-a' });

      // Mock agent.stream to capture the memory option
      let capturedMemoryOption: any;
      vi.spyOn(mockAgent, 'stream').mockImplementation(async (_messages, options) => {
        capturedMemoryOption = options?.memory;
        return { fullStream: new ReadableStream() } as any;
      });

      await STREAM_GENERATE_ROUTE.handler({
        mastra,
        agentId: 'test-agent',
        requestContext,
        abortSignal: new AbortController().signal,
        messages: [{ role: 'user', content: 'test' }],
        memory: {
          thread: 'stream-thread-owned-by-a',
          resource: 'user-b', // Client tries to use different resource ID
        },
      } as any);

      // The resource should be overridden to user-a (from context)
      expect(capturedMemoryOption.resource).toBe('user-a');
    });
  });
});
