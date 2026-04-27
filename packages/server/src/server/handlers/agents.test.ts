import { Agent } from '@mastra/core/agent';
import { PROVIDER_REGISTRY } from '@mastra/core/llm';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import {
  MASTRA_RESOURCE_ID_KEY,
  MASTRA_THREAD_ID_KEY,
  MASTRA_VERSIONS_KEY,
  RequestContext,
} from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HTTPException } from '../http-exception';
import {
  GET_PROVIDERS_ROUTE,
  GENERATE_AGENT_ROUTE,
  STREAM_GENERATE_ROUTE,
  RESUME_STREAM_ROUTE,
  isProviderConnected,
} from './agents';

// Mock the PROVIDER_REGISTRY before importing anything that uses it
vi.mock('@mastra/core/llm', async () => {
  const actual = await vi.importActual('@mastra/core/llm');
  return {
    ...actual,
    PROVIDER_REGISTRY: new Proxy(
      {},
      {
        get(target, prop) {
          // Use the mocked registry if it exists, otherwise fall back to actual
          const mockRegistry = (global as any).__MOCK_PROVIDER_REGISTRY__;
          if (mockRegistry && prop in mockRegistry) {
            return mockRegistry[prop];
          }
          return (actual as any).PROVIDER_REGISTRY[prop];
        },
        ownKeys() {
          const mockRegistry = (global as any).__MOCK_PROVIDER_REGISTRY__;
          if (mockRegistry) {
            const actualKeys = Object.keys((actual as any).PROVIDER_REGISTRY);
            const mockKeys = Object.keys(mockRegistry);
            return [...new Set([...actualKeys, ...mockKeys])];
          }
          return Object.keys((actual as any).PROVIDER_REGISTRY);
        },
        has(target, prop) {
          const mockRegistry = (global as any).__MOCK_PROVIDER_REGISTRY__;
          if (mockRegistry && prop in mockRegistry) {
            return true;
          }
          return prop in (actual as any).PROVIDER_REGISTRY;
        },
        getOwnPropertyDescriptor(target, prop) {
          const mockRegistry = (global as any).__MOCK_PROVIDER_REGISTRY__;
          if (mockRegistry && prop in mockRegistry) {
            return {
              enumerable: true,
              configurable: true,
            };
          }
          return Object.getOwnPropertyDescriptor((actual as any).PROVIDER_REGISTRY, prop);
        },
      },
    ),
  };
});

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
    // Clear mock registry to prevent cross-test contamination
    delete (global as any).__MOCK_PROVIDER_REGISTRY__;
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
    // Ensure Google is not connected
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

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
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

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
      expect(provider.envVar).toEqual(registryEntry.apiKeyEnvVar);
      // Models should match (converting readonly to regular array)
      expect(provider.models).toEqual([...registryEntry.models]);
    });
  });

  it('should include custom gateway providers alongside default providers when mastra has gateways', async () => {
    // Create a mock gateway that returns custom providers
    const mockGateway = {
      id: 'test-gateway',
      name: 'Test Gateway',
      getId: () => 'test-gateway',
      fetchProviders: vi.fn().mockResolvedValue({
        'custom-llm': {
          name: 'Custom LLM',
          models: ['custom-model-1', 'custom-model-2'],
          apiKeyEnvVar: 'CUSTOM_LLM_API_KEY',
          gateway: 'test-gateway',
        },
      }),
      buildUrl: vi.fn(),
      getApiKey: vi.fn(),
      resolveLanguageModel: vi.fn(),
    };

    const mastra = new Mastra({
      gateways: {
        'test-gateway': mockGateway,
      },
    });

    process.env.CUSTOM_LLM_API_KEY = 'test-key';

    const requestContext = new RequestContext();
    const abortSignal = new AbortController().signal;

    const result = await GET_PROVIDERS_ROUTE.handler({ mastra, requestContext, abortSignal });

    // Should include default providers from PROVIDER_REGISTRY
    const defaultProvider = result.providers.find(p => p.id === 'openai');
    expect(defaultProvider).toBeDefined();

    // Should also include the custom gateway provider
    const customProvider = result.providers.find(p => p.id === 'test-gateway/custom-llm');
    expect(customProvider).toBeDefined();
    expect(customProvider?.name).toBe('Custom LLM');
    expect(customProvider?.models).toEqual(['custom-model-1', 'custom-model-2']);
    expect(customProvider?.connected).toBe(true);

    // Cleanup
    delete process.env.CUSTOM_LLM_API_KEY;
  });

  it('should correctly show custom gateway providers as connected', async () => {
    // Mock a custom gateway provider in the registry
    (global as any).__MOCK_PROVIDER_REGISTRY__ = {
      'acme/acme-openai': {
        name: 'ACME OpenAI',
        models: ['gpt-4'],
        apiKeyEnvVar: 'ACME_OPENAI_API_KEY',
        gateway: 'acme',
      },
    };

    // Set the API key
    process.env.ACME_OPENAI_API_KEY = 'test-key';

    const result = await GET_PROVIDERS_ROUTE.handler({});

    // Should include the custom gateway provider
    const customProvider = result.providers.find(p => p.id === 'acme/acme-openai');
    expect(customProvider).toBeDefined();
    expect(customProvider?.name).toBe('ACME OpenAI');
    expect(customProvider?.connected).toBe(true); // This is the key assertion for issue #11732

    // Cleanup
    delete (global as any).__MOCK_PROVIDER_REGISTRY__;
    delete process.env.ACME_OPENAI_API_KEY;
  });
});

describe('isProviderConnected', () => {
  // Store original env and registry
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env before each test
    process.env = { ...originalEnv };
    // Clear all API keys
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
    // Clear mock registry to prevent cross-test contamination
    delete (global as any).__MOCK_PROVIDER_REGISTRY__;
  });

  describe('Standard provider lookup', () => {
    it('should return true for a connected standard provider', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      expect(isProviderConnected('openai')).toBe(true);
    });

    it('should return false for a disconnected standard provider', () => {
      delete process.env.OPENAI_API_KEY;
      expect(isProviderConnected('openai')).toBe(false);
    });

    it('should handle provider IDs with suffixes', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      expect(isProviderConnected('openai.chat')).toBe(true);
    });

    it('should return false for non-existent provider', () => {
      expect(isProviderConnected('nonexistent-provider')).toBe(false);
    });
  });

  describe('Custom gateway provider lookup', () => {
    it('should find provider when stored with gateway prefix', () => {
      // Mock a custom gateway provider in the registry
      (global as any).__MOCK_PROVIDER_REGISTRY__ = {
        'acme/acme-openai': {
          name: 'ACME OpenAI',
          models: ['gpt-4'],
          apiKeyEnvVar: 'ACME_OPENAI_API_KEY',
          gateway: 'acme',
        },
      };

      // Set the API key
      process.env.ACME_OPENAI_API_KEY = 'test-key';

      // Should find the provider even though we're looking for "acme-openai"
      // but it's stored as "acme/acme-openai"
      expect(isProviderConnected('acme-openai')).toBe(true);

      // Cleanup
      delete (global as any).__MOCK_PROVIDER_REGISTRY__;
      delete process.env.ACME_OPENAI_API_KEY;
    });

    it('should return false when gateway provider exists but API key is not set', () => {
      // Mock a custom gateway provider in the registry
      (global as any).__MOCK_PROVIDER_REGISTRY__ = {
        'acme/acme-openai': {
          name: 'ACME OpenAI',
          models: ['gpt-4'],
          apiKeyEnvVar: 'ACME_OPENAI_API_KEY',
          gateway: 'acme',
        },
      };

      // Don't set the API key
      delete process.env.ACME_OPENAI_API_KEY;

      // Should return false because API key is not set
      expect(isProviderConnected('acme-openai')).toBe(false);

      // Cleanup
      delete (global as any).__MOCK_PROVIDER_REGISTRY__;
    });

    it('should handle multiple custom gateway providers with same base name', () => {
      // Mock multiple custom gateway providers
      (global as any).__MOCK_PROVIDER_REGISTRY__ = {
        'gateway1/custom-provider': {
          name: 'Gateway 1 Provider',
          models: ['model-1'],
          apiKeyEnvVar: 'GATEWAY1_API_KEY',
          gateway: 'gateway1',
        },
        'gateway2/custom-provider': {
          name: 'Gateway 2 Provider',
          models: ['model-2'],
          apiKeyEnvVar: 'GATEWAY2_API_KEY',
          gateway: 'gateway2',
        },
      };

      // Set only gateway1's API key
      process.env.GATEWAY1_API_KEY = 'test-key';
      delete process.env.GATEWAY2_API_KEY;

      // Should find the first matching gateway provider
      // This is expected behavior - it finds the first match
      expect(isProviderConnected('custom-provider')).toBe(true);

      // Cleanup
      delete (global as any).__MOCK_PROVIDER_REGISTRY__;
      delete process.env.GATEWAY1_API_KEY;
    });

    it('should not match providers that already contain a slash', () => {
      // Mock a custom gateway provider
      (global as any).__MOCK_PROVIDER_REGISTRY__ = {
        'acme/acme-openai': {
          name: 'ACME OpenAI',
          models: ['gpt-4'],
          apiKeyEnvVar: 'ACME_OPENAI_API_KEY',
          gateway: 'acme',
        },
      };

      // Set the API key so the only reason for failure is the lookup logic
      process.env.ACME_OPENAI_API_KEY = 'test-key';

      // If provider ID already contains a slash, it should try direct lookup only
      // Since 'acme/acme-openai' is in the registry but we're using direct lookup,
      // it should actually be found
      expect(isProviderConnected('acme/acme-openai')).toBe(true);
      // This one won't be found because it's not in the registry
      expect(isProviderConnected('different/acme-openai')).toBe(false);

      // Cleanup
      delete (global as any).__MOCK_PROVIDER_REGISTRY__;
      delete process.env.ACME_OPENAI_API_KEY;
    });
  });

  describe('Provider with multiple API keys', () => {
    it('should return true only when all required env vars are set', () => {
      // Mock a provider that requires multiple API keys
      (global as any).__MOCK_PROVIDER_REGISTRY__ = {
        'multi-key-provider': {
          name: 'Multi Key Provider',
          models: ['model-1'],
          apiKeyEnvVar: ['API_KEY_1', 'API_KEY_2'],
          gateway: 'test',
        },
      };

      // Set only one key
      process.env.API_KEY_1 = 'key1';
      delete process.env.API_KEY_2;
      expect(isProviderConnected('multi-key-provider')).toBe(false);

      // Set both keys
      process.env.API_KEY_1 = 'key1';
      process.env.API_KEY_2 = 'key2';
      expect(isProviderConnected('multi-key-provider')).toBe(true);

      // Cleanup
      delete (global as any).__MOCK_PROVIDER_REGISTRY__;
      delete process.env.API_KEY_1;
      delete process.env.API_KEY_2;
    });
  });

  describe('Issue #11732 - Exact scenario from bug report', () => {
    it('should correctly detect connected provider for custom gateway in both API endpoints', () => {
      // Simulate exact scenario from issue:
      // - Custom gateway: acme
      // - Provider stored in registry as: acme/acme-openai
      // - Model router ID: acme/acme-openai/gpt-4.1
      // - Model.provider extracted by router: acme-openai (without gateway prefix)

      (global as any).__MOCK_PROVIDER_REGISTRY__ = {
        'acme/acme-openai': {
          name: 'ACME OpenAI',
          models: ['gpt-4.1'],
          apiKeyEnvVar: 'ACME_OPENAI_API_KEY',
          gateway: 'acme',
        },
      };

      process.env.ACME_OPENAI_API_KEY = 'test-key';

      // Test 1: /api/agents/providers should show connected: true
      // This endpoint calls isProviderConnected('acme/acme-openai') - the full registry key
      expect(isProviderConnected('acme/acme-openai')).toBe(true);

      // Test 2: Enhance prompt endpoint (via findConnectedModel) should detect the provider
      // This endpoint calls isProviderConnected('acme-openai') - from model.provider
      expect(isProviderConnected('acme-openai')).toBe(true);

      // Both should return true, fixing the "No model with a configured API key found" error

      // Cleanup
      delete (global as any).__MOCK_PROVIDER_REGISTRY__;
      delete process.env.ACME_OPENAI_API_KEY;
    });

    it('should handle the disconnected case correctly', () => {
      (global as any).__MOCK_PROVIDER_REGISTRY__ = {
        'acme/acme-openai': {
          name: 'ACME OpenAI',
          models: ['gpt-4.1'],
          apiKeyEnvVar: 'ACME_OPENAI_API_KEY',
          gateway: 'acme',
        },
      };

      // Don't set the API key
      delete process.env.ACME_OPENAI_API_KEY;

      // Both lookups should return false when API key is not set
      expect(isProviderConnected('acme/acme-openai')).toBe(false);
      expect(isProviderConnected('acme-openai')).toBe(false);

      // Cleanup
      delete (global as any).__MOCK_PROVIDER_REGISTRY__;
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
      storage,
      logger: false,
    });
  });

  /**
   * Creates a test context with reserved keys set (simulating middleware behavior)
   */
  function createContextWithReservedKeys({ resourceId, threadId }: { resourceId?: string; threadId?: string }) {
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

  describe('requestContext passthrough', () => {
    it('GENERATE_AGENT_ROUTE should pass requestContext to agent.generate()', async () => {
      const requestContext = createContextWithReservedKeys({});
      requestContext.set('custom-key', 'custom-value');

      // Mock agent.generate to capture the full options
      let capturedOptions: any;
      vi.spyOn(mockAgent, 'generate').mockImplementation(async (_messages, options) => {
        capturedOptions = options;
        return { text: 'mocked response' } as any;
      });

      await GENERATE_AGENT_ROUTE.handler({
        mastra,
        agentId: 'test-agent',
        requestContext,
        abortSignal: new AbortController().signal,
        messages: [{ role: 'user', content: 'test' }],
      } as any);

      // Verify requestContext was passed through
      expect(capturedOptions.requestContext).toBeDefined();
      expect(capturedOptions.requestContext.get('custom-key')).toBe('custom-value');
    });

    it('STREAM_GENERATE_ROUTE should pass requestContext to agent.stream()', async () => {
      const requestContext = createContextWithReservedKeys({});
      requestContext.set('custom-key', 'stream-value');

      // Mock agent.stream to capture the full options
      let capturedOptions: any;
      vi.spyOn(mockAgent, 'stream').mockImplementation(async (_messages, options) => {
        capturedOptions = options;
        return { fullStream: new ReadableStream() } as any;
      });

      await STREAM_GENERATE_ROUTE.handler({
        mastra,
        agentId: 'test-agent',
        requestContext,
        abortSignal: new AbortController().signal,
        messages: [{ role: 'user', content: 'test' }],
      } as any);

      // Verify requestContext was passed through
      expect(capturedOptions.requestContext).toBeDefined();
      expect(capturedOptions.requestContext.get('custom-key')).toBe('stream-value');
    });
  });

  describe('RESUME_STREAM_ROUTE', () => {
    async function persistAgenticLoopRun({ runId, resourceId }: { runId: string; resourceId?: string }) {
      const workflowsStore = await storage.getStore('workflows');
      await workflowsStore.persistWorkflowSnapshot({
        workflowName: 'agentic-loop',
        runId,
        resourceId,
        snapshot: {
          runId,
          status: 'suspended',
          value: {},
          context: {},
          activePaths: [],
          activeStepsPath: {},
          serializedStepGraph: [],
          suspendedPaths: {},
          resumeLabels: {},
          waitingPaths: {},
        },
      });
    }

    it('should return 400 when runId is missing', async () => {
      const requestContext = createContextWithReservedKeys({});

      await expect(
        RESUME_STREAM_ROUTE.handler({
          mastra,
          agentId: 'test-agent',
          requestContext,
          abortSignal: new AbortController().signal,
          resumeData: { approved: true },
        } as any),
      ).rejects.toThrow(new HTTPException(400, { message: 'Run id is required' }));
    });

    it('should return 403 when memory option specifies thread owned by different resource', async () => {
      await mockMemory.createThread({
        threadId: 'resume-thread-owned-by-b',
        resourceId: 'user-b',
        title: 'Thread B',
      });

      const requestContext = createContextWithReservedKeys({ resourceId: 'user-a' });

      await expect(
        RESUME_STREAM_ROUTE.handler({
          mastra,
          agentId: 'test-agent',
          requestContext,
          abortSignal: new AbortController().signal,
          runId: 'test-run-id',
          resumeData: { step: 'next' },
          memory: {
            thread: 'resume-thread-owned-by-b',
            resource: 'user-a',
          },
        } as any),
      ).rejects.toThrow(new HTTPException(403, { message: 'Access denied: thread belongs to a different resource' }));
    });

    it('should return 403 when runId belongs to a different resource', async () => {
      await persistAgenticLoopRun({ runId: 'resume-run-owned-by-b', resourceId: 'user-b' });

      const requestContext = createContextWithReservedKeys({ resourceId: 'user-a' });

      await expect(
        RESUME_STREAM_ROUTE.handler({
          mastra,
          agentId: 'test-agent',
          requestContext,
          abortSignal: new AbortController().signal,
          runId: 'resume-run-owned-by-b',
          resumeData: { step: 'next' },
        } as any),
      ).rejects.toThrow(
        new HTTPException(403, { message: 'Access denied: workflow run belongs to a different resource' }),
      );
    });

    it('should override client-provided resource with context value', async () => {
      await mockMemory.createThread({
        threadId: 'resume-thread-owned-by-a',
        resourceId: 'user-a',
        title: 'Thread A',
      });

      const requestContext = createContextWithReservedKeys({ resourceId: 'user-a' });

      let capturedOptions: any;
      vi.spyOn(mockAgent, 'resumeStream').mockImplementation(async (_resumeData, options) => {
        capturedOptions = options;
        return { fullStream: new ReadableStream() } as any;
      });

      await RESUME_STREAM_ROUTE.handler({
        mastra,
        agentId: 'test-agent',
        requestContext,
        abortSignal: new AbortController().signal,
        runId: 'test-run-id',
        resumeData: { step: 'next' },
        memory: {
          thread: 'resume-thread-owned-by-a',
          resource: 'user-b',
        },
      } as any);

      expect(capturedOptions.memory.resource).toBe('user-a');
    });

    it('should use reserved requestContext memory keys when body memory is omitted', async () => {
      await mockMemory.createThread({
        threadId: 'resume-thread-from-context',
        resourceId: 'user-a',
        title: 'Thread A',
      });
      await persistAgenticLoopRun({ runId: 'resume-run-from-context', resourceId: 'user-a' });

      const requestContext = createContextWithReservedKeys({
        resourceId: 'user-a',
        threadId: 'resume-thread-from-context',
      });

      let capturedOptions: any;
      vi.spyOn(mockAgent, 'resumeStream').mockImplementation(async (_resumeData, options) => {
        capturedOptions = options;
        return { fullStream: new ReadableStream() } as any;
      });

      await RESUME_STREAM_ROUTE.handler({
        mastra,
        agentId: 'test-agent',
        requestContext,
        abortSignal: new AbortController().signal,
        runId: 'resume-run-from-context',
        resumeData: { step: 'next' },
      } as any);

      expect(capturedOptions.memory).toMatchObject({
        resource: 'user-a',
        thread: 'resume-thread-from-context',
      });
      expect(capturedOptions.requestContext).toBe(requestContext);
      expect(capturedOptions.runId).toBe('resume-run-from-context');
    });

    it('should pass resumeData, runId, and toolCallId to agent.resumeStream()', async () => {
      const requestContext = createContextWithReservedKeys({});

      let capturedResumeData: any;
      let capturedOptions: any;
      vi.spyOn(mockAgent, 'resumeStream').mockImplementation(async (resumeData, options) => {
        capturedResumeData = resumeData;
        capturedOptions = options;
        return { fullStream: new ReadableStream() } as any;
      });

      await RESUME_STREAM_ROUTE.handler({
        mastra,
        agentId: 'test-agent',
        requestContext,
        abortSignal: new AbortController().signal,
        runId: 'test-run-id',
        resumeData: { workflowResult: 'approved' },
        toolCallId: 'tool-call-123',
      } as any);

      expect(capturedResumeData).toEqual({ workflowResult: 'approved' });
      expect(capturedOptions.runId).toBe('test-run-id');
      expect(capturedOptions.toolCallId).toBe('tool-call-123');
    });

    it('should pass requestContext to agent.resumeStream()', async () => {
      const requestContext = createContextWithReservedKeys({});
      requestContext.set('custom-key', 'resume-value');

      let capturedOptions: any;
      vi.spyOn(mockAgent, 'resumeStream').mockImplementation(async (_resumeData, options) => {
        capturedOptions = options;
        return { fullStream: new ReadableStream() } as any;
      });

      await RESUME_STREAM_ROUTE.handler({
        mastra,
        agentId: 'test-agent',
        requestContext,
        abortSignal: new AbortController().signal,
        runId: 'test-run-id',
        resumeData: { step: 'next' },
      } as any);

      expect(capturedOptions.requestContext).toBeDefined();
      expect(capturedOptions.requestContext.get('custom-key')).toBe('resume-value');
    });

    it('should stash version overrides on requestContext before calling agent.resumeStream()', async () => {
      const requestContext = createContextWithReservedKeys({});

      let capturedOptions: any;
      vi.spyOn(mockAgent, 'resumeStream').mockImplementation(async (_resumeData, options) => {
        capturedOptions = options;
        return { fullStream: new ReadableStream() } as any;
      });

      await RESUME_STREAM_ROUTE.handler({
        mastra,
        agentId: 'test-agent',
        requestContext,
        abortSignal: new AbortController().signal,
        runId: 'test-run-id',
        resumeData: { step: 'next' },
        versions: {
          agents: {
            'sub-agent': { versionId: 'version-1' },
          },
        },
      } as any);

      expect(capturedOptions.requestContext.get(MASTRA_VERSIONS_KEY)).toEqual({
        agents: {
          'sub-agent': { versionId: 'version-1' },
        },
      });
    });

    it('should pass abortSignal to agent.resumeStream()', async () => {
      const requestContext = createContextWithReservedKeys({});
      const abortController = new AbortController();

      let capturedOptions: any;
      vi.spyOn(mockAgent, 'resumeStream').mockImplementation(async (_resumeData, options) => {
        capturedOptions = options;
        return { fullStream: new ReadableStream() } as any;
      });

      await RESUME_STREAM_ROUTE.handler({
        mastra,
        agentId: 'test-agent',
        requestContext,
        abortSignal: abortController.signal,
        runId: 'test-run-id',
        resumeData: { step: 'next' },
      } as any);

      expect(capturedOptions.abortSignal).toBe(abortController.signal);
    });

    it('should work without toolCallId (optional)', async () => {
      const requestContext = createContextWithReservedKeys({});

      let capturedOptions: any;
      vi.spyOn(mockAgent, 'resumeStream').mockImplementation(async (_resumeData, options) => {
        capturedOptions = options;
        return { fullStream: new ReadableStream() } as any;
      });

      await RESUME_STREAM_ROUTE.handler({
        mastra,
        agentId: 'test-agent',
        requestContext,
        abortSignal: new AbortController().signal,
        runId: 'test-run-id',
        resumeData: { customData: 'value' },
      } as any);

      expect(capturedOptions.toolCallId).toBeUndefined();
      expect(capturedOptions.runId).toBe('test-run-id');
    });

    it('should return fullStream from agent.resumeStream()', async () => {
      const requestContext = createContextWithReservedKeys({});
      const expectedStream = new ReadableStream();

      vi.spyOn(mockAgent, 'resumeStream').mockResolvedValue({
        fullStream: expectedStream,
      } as any);

      const result = await RESUME_STREAM_ROUTE.handler({
        mastra,
        agentId: 'test-agent',
        requestContext,
        abortSignal: new AbortController().signal,
        runId: 'test-run-id',
        resumeData: { step: 'next' },
      } as any);

      expect(result).toBe(expectedStream);
    });
  });
});
