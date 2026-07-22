import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import type { DurableAgent } from '@mastra/core/agent/durable';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
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
  abortAgentThreadBodySchema,
  agentExecutionBodySchema,
  approveToolCallBodySchema,
  declineToolCallBodySchema,
  queueAgentMessageBodySchema,
  sendAgentMessageBodySchema,
  sendAgentSignalBodySchema,
  subscribeAgentThreadBodySchema,
  sendToolApprovalBodySchema,
} from '../schemas/agents';
import { AGENTS_ROUTES } from '../server-adapter/routes/agents';
import {
  GET_PROVIDERS_ROUTE,
  GENERATE_AGENT_ROUTE,
  GET_AGENT_BY_ID_ROUTE,
  LIST_AGENTS_ROUTE,
  STREAM_GENERATE_ROUTE,
  RESUME_STREAM_ROUTE,
  APPROVE_TOOL_CALL_ROUTE,
  DECLINE_TOOL_CALL_ROUTE,
  APPROVE_TOOL_CALL_GENERATE_ROUTE,
  DECLINE_TOOL_CALL_GENERATE_ROUTE,
  RECOVER_ROUTE,
  SEND_TOOL_APPROVAL_ROUTE,
  LIST_SUSPENDED_RUNS_ROUTE,
  QUEUE_AGENT_MESSAGE_ROUTE,
  SEND_AGENT_MESSAGE_ROUTE,
  SEND_AGENT_SIGNAL_ROUTE,
  ABORT_AGENT_THREAD_ROUTE,
  SUBSCRIBE_AGENT_THREAD_ROUTE,
  isProviderConnected,
  extractVersionOptions,
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

  it('should hide registry and default-gateway providers when AUTO_BLOCK_EXTERNAL_PROVIDERS is set, keeping only custom gateways', async () => {
    process.env.AUTO_BLOCK_EXTERNAL_PROVIDERS = 'true';

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

    const requestContext = new RequestContext();
    const abortSignal = new AbortController().signal;

    const result = await GET_PROVIDERS_ROUTE.handler({ mastra, requestContext, abortSignal });

    // External registry providers should be hidden
    expect(result.providers.find(p => p.id === 'openai')).toBeUndefined();
    expect(result.providers.find(p => p.id === 'anthropic')).toBeUndefined();

    // Built-in default gateways (models.dev, netlify, mastra) should be hidden
    expect(result.providers.some(p => p.id === 'mastra' || p.id.startsWith('netlify/'))).toBe(false);

    // The user-registered custom gateway provider should remain
    const customProvider = result.providers.find(p => p.id === 'test-gateway/custom-llm');
    expect(customProvider).toBeDefined();
    expect(customProvider?.name).toBe('Custom LLM');
  });

  it('should return no providers when AUTO_BLOCK_EXTERNAL_PROVIDERS is set and no custom gateway is registered', async () => {
    process.env.AUTO_BLOCK_EXTERNAL_PROVIDERS = '1';

    const mastra = new Mastra({});
    const requestContext = new RequestContext();
    const abortSignal = new AbortController().signal;

    const result = await GET_PROVIDERS_ROUTE.handler({ mastra, requestContext, abortSignal });

    expect(result.providers).toEqual([]);
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
  let mockDurableAgent: DurableAgent;
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

  describe('agent metadata serialization', () => {
    it('includes metadata in the list agents response', async () => {
      mockAgent = new Agent({
        id: 'metadata-agent',
        name: 'metadata-agent',
        instructions: 'test-instructions',
        model: {} as any,
        metadata: { type: 'support' },
      });

      mastra = new Mastra({
        agents: { 'metadata-agent': mockAgent },
        logger: false,
      });

      const result = await LIST_AGENTS_ROUTE.handler({
        mastra,
        requestContext: new RequestContext(),
      } as any);

      expect(result['metadata-agent']?.metadata).toEqual({ type: 'support' });
    });

    it('includes metadata in the get agent response', async () => {
      mockAgent = new Agent({
        id: 'metadata-agent',
        name: 'metadata-agent',
        instructions: 'test-instructions',
        model: {} as any,
        metadata: { type: 'support' },
      });
      vi.spyOn(mockAgent, 'listTools').mockResolvedValue({});
      vi.spyOn(mockAgent, 'getLLM').mockResolvedValue({
        getModel: () => undefined,
        getProvider: () => 'test-provider',
        getModelId: () => 'test-model',
      } as any);
      vi.spyOn(mockAgent, 'getDefaultGenerateOptionsLegacy').mockResolvedValue({});
      vi.spyOn(mockAgent, 'getDefaultStreamOptionsLegacy').mockResolvedValue({});
      vi.spyOn(mockAgent, 'getDefaultOptions').mockResolvedValue({});
      vi.spyOn(mockAgent, 'getModelList').mockResolvedValue(null);

      mastra = new Mastra({
        agents: { 'metadata-agent': mockAgent },
        logger: false,
      });

      const result = await GET_AGENT_BY_ID_ROUTE.handler({
        mastra,
        agentId: 'metadata-agent',
        requestContext: new RequestContext(),
      } as any);

      expect(result.metadata).toEqual({ type: 'support' });
    });
  });

  describe('agent model serialization', () => {
    it('lists an agent whose dynamic model is not selected without logging a warning', async () => {
      mockAgent = new Agent({
        id: 'dynamic-model-agent',
        name: 'dynamic-model-agent',
        instructions: 'test-instructions',
        model: () => {
          throw new Error('No model selected. Use /models to select a model first.');
        },
      });

      mastra = new Mastra({
        agents: { 'dynamic-model-agent': mockAgent },
        logger: false,
      });
      const warn = vi.fn();
      vi.spyOn(mastra, 'getLogger').mockReturnValue({ warn, error: vi.fn() } as any);

      const result = await LIST_AGENTS_ROUTE.handler({
        mastra,
        requestContext: new RequestContext(),
      } as any);

      expect(result['dynamic-model-agent']).toMatchObject({
        id: 'dynamic-model-agent',
        name: 'dynamic-model-agent',
      });
      expect(result['dynamic-model-agent']?.provider).toBeUndefined();
      expect(result['dynamic-model-agent']?.modelId).toBeUndefined();
      expect(warn).not.toHaveBeenCalled();
    });
  });

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

    it('strips a client-supplied actor before forwarding to agent.generate', async () => {
      const requestContext = createContextWithReservedKeys({ resourceId: 'user-a' });

      let capturedOptions: any;
      vi.spyOn(mockAgent, 'generate').mockImplementation(async (_messages, options) => {
        capturedOptions = options;
        return { text: 'ok' } as any;
      });

      await GENERATE_AGENT_ROUTE.handler({
        mastra,
        agentId: 'test-agent',
        requestContext,
        abortSignal: new AbortController().signal,
        messages: [{ role: 'user', content: 'test' }],
        // A client attempting to forge a privileged system actor over HTTP.
        actor: { actorKind: 'system', agentId: 'privileged-agent', permissions: ['*'] },
      } as any);

      // The forged actor must be stripped and never reach agent.generate.
      expect(capturedOptions).toBeDefined();
      expect(capturedOptions).not.toHaveProperty('actor');
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

    it('should accept memory without resource when context provides one (mapUserToResourceId)', async () => {
      const requestContext = createContextWithReservedKeys({ resourceId: 'user-a' });

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
          thread: 'new-thread',
          // no resource — server derives it from the request context
        },
      } as any);

      expect(capturedMemoryOption.resource).toBe('user-a');
    });

    it('should return 400 when memory is provided but no resource can be resolved', async () => {
      await expect(
        GENERATE_AGENT_ROUTE.handler({
          mastra,
          agentId: 'test-agent',
          requestContext: new RequestContext(),
          abortSignal: new AbortController().signal,
          messages: [{ role: 'user', content: 'test' }],
          memory: {
            thread: 'new-thread',
          },
        } as any),
      ).rejects.toThrow(
        expect.objectContaining({
          status: 400,
        }),
      );
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

    it('should accept memory without resource when context provides one (mapUserToResourceId)', async () => {
      const requestContext = createContextWithReservedKeys({ resourceId: 'user-a' });

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
          thread: 'new-stream-thread',
          // no resource — server derives it from the request context
        },
      } as any);

      expect(capturedMemoryOption.resource).toBe('user-a');
    });

    it('should return 400 when memory is provided but no resource can be resolved', async () => {
      await expect(
        STREAM_GENERATE_ROUTE.handler({
          mastra,
          agentId: 'test-agent',
          requestContext: new RequestContext(),
          abortSignal: new AbortController().signal,
          messages: [{ role: 'user', content: 'test' }],
          memory: {
            thread: 'new-stream-thread',
          },
        } as any),
      ).rejects.toThrow(
        expect.objectContaining({
          status: 400,
        }),
      );
    });
  });

  describe('agentExecutionBodySchema memory option', () => {
    it('accepts a memory option without resource', () => {
      const result = agentExecutionBodySchema.safeParse({
        messages: ['what was my last message?'],
        memory: { thread: 'test-thread' },
      });

      expect(result.success).toBe(true);
    });

    it('still accepts a memory option with resource', () => {
      const result = agentExecutionBodySchema.safeParse({
        messages: ['hi'],
        memory: { thread: 'test-thread', resource: 'user-1' },
      });

      expect(result.success).toBe(true);
    });

    it('still requires thread when memory is provided', () => {
      const result = agentExecutionBodySchema.safeParse({
        messages: ['hi'],
        memory: { resource: 'user-1' },
      });

      expect(result.success).toBe(false);
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
      await workflowsStore?.persistWorkflowSnapshot({
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
          timestamp: Date.now(),
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
        approved: true,
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
        defaultStatus: 'published',
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

  describe('durable tool approval authorization', () => {
    const approvalRoutes = [
      { name: 'approve stream', route: APPROVE_TOOL_CALL_ROUTE, method: 'approveToolCall' },
      { name: 'decline stream', route: DECLINE_TOOL_CALL_ROUTE, method: 'declineToolCall' },
      { name: 'approve generate', route: APPROVE_TOOL_CALL_GENERATE_ROUTE, method: 'approveToolCallGenerate' },
      { name: 'decline generate', route: DECLINE_TOOL_CALL_GENERATE_ROUTE, method: 'declineToolCallGenerate' },
    ] as const;

    beforeEach(() => {
      Object.defineProperty(mockAgent, 'agent', { value: mockAgent, configurable: true });
    });

    async function persistSuspendedDurableRun({
      resourceId,
      toolCallId = 'tool-call-1',
    }: {
      resourceId: string;
      toolCallId?: string;
    }) {
      const workflowsStore = await storage.getStore('workflows');
      await workflowsStore?.persistWorkflowSnapshot({
        workflowName: 'durable-agentic-loop',
        runId: 'durable-run-1',
        snapshot: {
          runId: 'durable-run-1',
          status: 'suspended',
          value: {},
          context: {
            input: {
              agentId: 'test-agent',
              state: { resourceId },
              requestContextEntries: { [MASTRA_RESOURCE_ID_KEY]: resourceId },
            },
            'tool-step': {
              status: 'suspended',
              suspendPayload: { requireToolApproval: { toolCallId } },
            },
          },
          activePaths: [],
          activeStepsPath: {},
          serializedStepGraph: [],
          suspendedPaths: {},
          resumeLabels: { [toolCallId]: { stepId: 'tool-step' } },
          waitingPaths: {},
          timestamp: Date.now(),
        } as any,
      });
    }

    it.each(approvalRoutes)('$name rejects a durable run owned by another resource', async ({ route, method }) => {
      await persistSuspendedDurableRun({ resourceId: 'user-b' });
      const execution = vi.spyOn(mockAgent as any, method).mockResolvedValue({
        fullStream: new ReadableStream(),
      });

      await expect(
        (route.handler as any)({
          mastra,
          agentId: 'test-agent',
          requestContext: createContextWithReservedKeys({ resourceId: 'user-a' }),
          abortSignal: new AbortController().signal,
          runId: 'durable-run-1',
          toolCallId: 'tool-call-1',
        }),
      ).rejects.toThrow(
        new HTTPException(403, { message: 'Access denied: durable run belongs to a different resource' }),
      );
      expect(execution).not.toHaveBeenCalled();
    });

    it.each(approvalRoutes)('$name rejects a tool call not suspended on the durable run', async ({ route, method }) => {
      await persistSuspendedDurableRun({ resourceId: 'user-a' });
      const execution = vi.spyOn(mockAgent as any, method).mockResolvedValue({
        fullStream: new ReadableStream(),
      });

      await expect(
        (route.handler as any)({
          mastra,
          agentId: 'test-agent',
          requestContext: createContextWithReservedKeys({ resourceId: 'user-a' }),
          abortSignal: new AbortController().signal,
          runId: 'durable-run-1',
          toolCallId: 'different-tool-call',
        }),
      ).rejects.toThrow(
        new HTTPException(403, { message: 'Access denied: tool call is not suspended on this durable run' }),
      );
      expect(execution).not.toHaveBeenCalled();
    });
  });

  describe('RECOVER_ROUTE', () => {
    beforeEach(() => {
      mockAgent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test-instructions',
        // Use a shape that satisfies `isSupportedLanguageModel` so background
        // durable-workflow initialization does not trigger an unhandled
        // `AGENT_GET_MODEL_MISSING_MODEL_INSTANCE` rejection from
        // `resolveModelConfig`.
        model: { specificationVersion: 'v2' } as any,
        memory: mockMemory,
      });
      mockDurableAgent = createDurableAgent({
        agent: mockAgent,
        id: 'test-durable-agent',
        name: 'test-durable-agent',
      });

      mastra = new Mastra({
        agents: {
          'test-agent': mockAgent,
          'test-durable-agent': mockDurableAgent,
        },
        storage,
        logger: false,
      });
    });

    async function persistDurableAgenticLoopRun({
      runId,
      resourceId,
      status = 'running',
    }: {
      runId: string;
      resourceId?: string;
      status?: 'running' | 'suspended' | 'pending';
    }) {
      const workflowsStore = await storage.getStore('workflows');
      await workflowsStore?.persistWorkflowSnapshot({
        workflowName: 'durable-agentic-loop',
        runId,
        resourceId,
        snapshot: {
          runId,
          status,
          value: {},
          context: {
            input: {
              agentId: 'test-durable-agent',
              __workflowKind: 'durable-agent',
            },
          } as any,
          activePaths: [],
          activeStepsPath: {},
          serializedStepGraph: [],
          suspendedPaths: {},
          resumeLabels: {},
          waitingPaths: {},
          timestamp: Date.now(),
        },
      });
    }

    it('should return 400 when runId is missing', async () => {
      const requestContext = createContextWithReservedKeys({});

      await expect(
        RECOVER_ROUTE.handler({
          mastra,
          agentId: 'test-agent',
          requestContext,
          abortSignal: new AbortController().signal,
        } as any),
      ).rejects.toThrow(new HTTPException(400, { message: 'Run id is required' }));
    });

    it('should return 400 when the target agent is not a durable agent', async () => {
      const requestContext = createContextWithReservedKeys({});

      await expect(
        RECOVER_ROUTE.handler({
          mastra,
          agentId: 'test-agent',
          requestContext,
          abortSignal: new AbortController().signal,
          runId: 'test-run-id',
        } as any),
      ).rejects.toThrow(
        new HTTPException(400, {
          message: 'Agent does not support recover. Only durable agents (createDurableAgent) can recover runs.',
        }),
      );
    });

    it('should return 403 when runId belongs to a different resource', async () => {
      // Add a recover method to make the agent look durable.
      (mockAgent as any).recover = vi.fn();

      await persistDurableAgenticLoopRun({ runId: 'recover-run-owned-by-b', resourceId: 'user-b' });

      const requestContext = createContextWithReservedKeys({ resourceId: 'user-a' });

      await expect(
        RECOVER_ROUTE.handler({
          mastra,
          agentId: 'test-durable-agent',
          requestContext,
          abortSignal: new AbortController().signal,
          runId: 'recover-run-owned-by-b',
        } as any),
      ).rejects.toThrow(
        new HTTPException(403, { message: 'Access denied: workflow run belongs to a different resource' }),
      );

      delete (mockAgent as any).recover;
    });

    it('should call agent.recover(runId, { abortSignal }) and return fullStream', async () => {
      const expectedStream = new ReadableStream();
      const recoverMock = vi.fn().mockResolvedValue({ fullStream: expectedStream });
      (mockDurableAgent as any).recover = recoverMock;

      await persistDurableAgenticLoopRun({ runId: 'recover-run-1' });

      const requestContext = createContextWithReservedKeys({});
      const abortController = new AbortController();

      const result = await RECOVER_ROUTE.handler({
        mastra,
        agentId: 'test-durable-agent',
        requestContext,
        abortSignal: abortController.signal,
        runId: 'recover-run-1',
      } as any);

      expect(recoverMock).toHaveBeenCalledWith('recover-run-1', { abortSignal: abortController.signal });
      expect(result).toBe(expectedStream);

      delete (mockAgent as any).recover;
    });

    it('should stash version overrides on requestContext before calling agent.recover()', async () => {
      const recoverMock = vi.fn().mockResolvedValue({ fullStream: new ReadableStream() });
      (mockAgent as any).recover = recoverMock;

      await persistDurableAgenticLoopRun({ runId: 'recover-run-versions' });

      const requestContext = createContextWithReservedKeys({});

      await RECOVER_ROUTE.handler({
        mastra,
        agentId: 'test-durable-agent',
        requestContext,
        abortSignal: new AbortController().signal,
        runId: 'recover-run-versions',
        versions: {
          agents: {
            'sub-agent': { versionId: 'version-1' },
          },
        },
      } as any);

      expect(requestContext.get(MASTRA_VERSIONS_KEY)).toEqual({
        agents: {
          'sub-agent': { versionId: 'version-1' },
        },
        defaultStatus: 'published',
      });

      delete (mockAgent as any).recover;
    });
  });

  describe('SIGNAL_ROUTES', () => {
    it('should register subscription approval routes with execute permissions', () => {
      const routeMetadata = AGENTS_ROUTES.map(route => ({
        path: route.path,
        method: route.method,
        requiresPermission: route.requiresPermission,
      }));

      expect(routeMetadata).toEqual(
        expect.arrayContaining([
          {
            path: '/agents/:agentId/send-tool-approval',
            method: 'POST',
            requiresPermission: 'agents:execute',
          },
        ]),
      );
    });

    it('should validate typed user-message signal contents and attributes', () => {
      const body = {
        signal: {
          type: 'user-message',
          contents: [
            { type: 'text', text: 'describe these files' },
            { type: 'file', data: 'data:image/png;base64,image-data', mediaType: 'image/png' },
            { type: 'file', data: 'file-data', mediaType: 'application/pdf', filename: 'brief.pdf' },
          ],
          attributes: { intent: 'follow-up', count: 1, urgent: false, empty: null },
          metadata: { source: 'studio' },
        },
        resourceId: 'user-a',
        threadId: 'signal-thread-from-context',
      };

      expect(sendAgentSignalBodySchema.safeParse(body).success).toBe(true);
    });

    it('should validate string user-message signal contents and reject legacy array wrappers', () => {
      expect(
        sendAgentSignalBodySchema.safeParse({
          signal: { type: 'user-message', contents: 'hello' },
          resourceId: 'user-a',
          threadId: 'thread-a',
        }).success,
      ).toBe(true);

      expect(
        sendAgentSignalBodySchema.safeParse({
          signal: { type: 'user-message', contents: ['hello', 'again'] },
          resourceId: 'user-a',
          threadId: 'thread-a',
        }).success,
      ).toBe(false);
    });

    it('should reject Mastra DB message shaped user-message signal contents', () => {
      expect(
        sendAgentSignalBodySchema.safeParse({
          signal: {
            type: 'user-message',
            contents: [
              {
                id: 'stored-message-1',
                role: 'user',
                createdAt: '2026-05-08T00:00:00.000Z',
                threadId: 'thread-a',
                resourceId: 'user-a',
                content: {
                  format: 2,
                  content: 'stored hello',
                  parts: [{ type: 'text', text: 'stored hello' }],
                  metadata: { source: 'memory' },
                },
              },
            ],
          },
          resourceId: 'user-a',
          threadId: 'thread-a',
        }).success,
      ).toBe(false);
    });

    it('should reject malformed user-message content parts', () => {
      expect(
        sendAgentSignalBodySchema.safeParse({
          signal: {
            type: 'user-message',
            contents: { role: 'user', content: [{ type: 'image' }] },
          },
          resourceId: 'user-a',
          threadId: 'thread-a',
        }).success,
      ).toBe(false);
    });

    it('should reject unknown signal types', () => {
      expect(
        sendAgentSignalBodySchema.safeParse({
          signal: { type: 'custom-reminder', tagName: 'custom-reminder', contents: 'use explicit category' },
          resourceId: 'user-a',
          threadId: 'thread-a',
        }).success,
      ).toBe(false);
    });

    it('should require non-user signals to use string contents', () => {
      expect(
        sendAgentSignalBodySchema.safeParse({
          signal: { type: 'system-reminder', contents: '<system-reminder>Use the tool result</system-reminder>' },
          resourceId: 'user-a',
          threadId: 'thread-a',
        }).success,
      ).toBe(true);

      expect(
        sendAgentSignalBodySchema.safeParse({
          signal: { type: 'system-reminder', contents: [{ role: 'user', content: 'not allowed' }] },
          resourceId: 'user-a',
          threadId: 'thread-a',
        }).success,
      ).toBe(false);
    });

    it('should accept run-targeted signal bodies with active behavior', () => {
      expect(
        sendAgentSignalBodySchema.safeParse({
          signal: { type: 'user-message', contents: 'pause here' },
          runId: 'run-123',
          ifActive: { behavior: 'persist' },
        }).success,
      ).toBe(true);
    });

    it('should reject idle behavior when targeting a run', () => {
      expect(
        sendAgentSignalBodySchema.safeParse({
          signal: { type: 'user-message', contents: 'pause here' },
          runId: 'run-123',
          resourceId: 'resource-123',
          threadId: 'thread-123',
          ifIdle: { behavior: 'wake' },
        }).success,
      ).toBe(false);

      expect(
        sendAgentMessageBodySchema.safeParse({
          message: 'pause here',
          runId: 'run-123',
          resourceId: 'resource-123',
          threadId: 'thread-123',
          ifIdle: { behavior: 'wake' },
        }).success,
      ).toBe(false);
    });

    it('should accept thread-targeted signal bodies with active and idle behavior', () => {
      expect(
        sendAgentSignalBodySchema.safeParse({
          signal: { type: 'system-reminder', contents: '<system-reminder>review PR comment</system-reminder>' },
          resourceId: 'resource-123',
          threadId: 'thread-123',
          ifActive: { behavior: 'discard' },
          ifIdle: {
            behavior: 'wake',
            streamOptions: {
              maxSteps: 3,
              instructions: 'Use the PR context.',
            },
          },
        }).success,
      ).toBe(true);
    });

    it('should validate message route string, parts, and object bodies', () => {
      expect(
        sendAgentMessageBodySchema.safeParse({
          message: 'hello',
          resourceId: 'user-a',
          threadId: 'thread-a',
        }).success,
      ).toBe(true);

      expect(
        sendAgentMessageBodySchema.safeParse({
          message: [
            { type: 'text', text: 'hello' },
            { type: 'file', data: 'file-data', mediaType: 'text/plain' },
          ],
          resourceId: 'user-a',
          threadId: 'thread-a',
        }).success,
      ).toBe(true);

      const parsedMessageBody = queueAgentMessageBodySchema.parse({
        message: {
          contents: 'hello',
          attributes: { source: 'test' },
          metadata: { client: 'sdk' },
          providerOptions: { mastra: { channel: 'web' } },
        },
        resourceId: 'user-a',
        threadId: 'thread-a',
        ifActive: { behavior: 'deliver', attributes: { delivery: 'active' } },
        ifIdle: {
          attributes: { delivery: 'idle' },
          streamOptions: { instructions: 'Use the fixture.' },
        },
      });
      expect(parsedMessageBody.ifActive?.attributes).toEqual({ delivery: 'active' });
      expect(parsedMessageBody.ifIdle?.attributes).toEqual({ delivery: 'idle' });
    });

    it('should reject malformed message route bodies', () => {
      expect(
        sendAgentMessageBodySchema.safeParse({
          message: ['hello', 'again'],
          resourceId: 'user-a',
          threadId: 'thread-a',
        }).success,
      ).toBe(false);

      expect(
        sendAgentMessageBodySchema.safeParse({
          message: { contents: [{ role: 'user', content: 'not allowed' }] },
          resourceId: 'user-a',
          threadId: 'thread-a',
        }).success,
      ).toBe(false);
    });

    it('should accept subscribe, abort, and tool approval bodies', () => {
      const body = {
        resourceId: 'resource-123',
        threadId: 'thread-123',
      };
      const toolCallBody = {
        runId: 'run-123',
        toolCallId: 'tool-call-123',
      };
      const subscriptionToolCallBody = {
        resourceId: 'resource-123',
        threadId: 'thread-123',
        toolCallId: 'tool-call-123',
        approved: true,
      };

      expect(subscribeAgentThreadBodySchema.safeParse(body).success).toBe(true);
      expect(abortAgentThreadBodySchema.safeParse(body).success).toBe(true);
      expect(approveToolCallBodySchema.safeParse(toolCallBody).success).toBe(true);
      expect(declineToolCallBodySchema.safeParse(toolCallBody).success).toBe(true);
      expect(sendToolApprovalBodySchema.safeParse(subscriptionToolCallBody).success).toBe(true);
      expect(sendToolApprovalBodySchema.safeParse(toolCallBody).success).toBe(false);
    });

    it('should approve a tool call for thread subscriptions with a JSON ack', async () => {
      (mockAgent as any).sendToolApproval = vi.fn(async params => ({
        accepted: true,
        runId: 'run-123',
        toolCallId: params.toolCallId,
      }));

      const result = await SEND_TOOL_APPROVAL_ROUTE.handler({
        mastra,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
        abortSignal: new AbortController().signal,
        resourceId: 'resource-123',
        threadId: 'thread-123',
        toolCallId: 'tool-call-123',
        approved: true,
        streamOptions: {
          actor: { actorKind: 'system', agentId: 'forged-agent' },
          requestContext: { organizationId: 'forged-org' },
        },
      } as any);

      expect(result).toEqual({ accepted: true, runId: 'run-123', toolCallId: 'tool-call-123' });
      expect((mockAgent as any).sendToolApproval).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: 'resource-123',
          threadId: 'thread-123',
          toolCallId: 'tool-call-123',
          approved: true,
        }),
      );
      const forwardedOptions = (mockAgent as any).sendToolApproval.mock.calls[0][0].streamOptions;
      expect(forwardedOptions).not.toHaveProperty('actor');
      expect(forwardedOptions.requestContext.get('organizationId')).toBeUndefined();
    });

    it('should decline a tool call for thread subscriptions with a JSON ack', async () => {
      (mockAgent as any).sendToolApproval = vi.fn(async params => ({
        accepted: true,
        runId: 'run-123',
        toolCallId: params.toolCallId,
      }));

      const result = await SEND_TOOL_APPROVAL_ROUTE.handler({
        mastra,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
        abortSignal: new AbortController().signal,
        resourceId: 'resource-123',
        threadId: 'thread-123',
        toolCallId: 'tool-call-123',
        approved: false,
      } as any);

      expect(result).toEqual({ accepted: true, runId: 'run-123', toolCallId: 'tool-call-123' });
      expect((mockAgent as any).sendToolApproval).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: 'resource-123',
          threadId: 'thread-123',
          toolCallId: 'tool-call-123',
          approved: false,
        }),
      );
    });

    it('should reject subscription tool approval for a thread owned by another resource', async () => {
      await mockMemory.createThread({
        threadId: 'approval-thread-owned-by-b',
        resourceId: 'user-b',
        title: 'Approval Thread B',
      });
      (mockAgent as any).sendToolApproval = vi.fn();

      await expect(
        SEND_TOOL_APPROVAL_ROUTE.handler({
          mastra,
          agentId: 'test-agent',
          requestContext: createContextWithReservedKeys({ resourceId: 'user-a' }),
          abortSignal: new AbortController().signal,
          resourceId: 'user-a',
          threadId: 'approval-thread-owned-by-b',
          toolCallId: 'tool-call-123',
          approved: true,
        } as any),
      ).rejects.toThrow(new HTTPException(403, { message: 'Access denied: thread belongs to a different resource' }));
      expect((mockAgent as any).sendToolApproval).not.toHaveBeenCalled();
    });

    it('should reject subscription tool decline for a thread owned by another resource', async () => {
      await mockMemory.createThread({
        threadId: 'decline-thread-owned-by-b',
        resourceId: 'user-b',
        title: 'Decline Thread B',
      });
      (mockAgent as any).sendToolApproval = vi.fn();

      await expect(
        SEND_TOOL_APPROVAL_ROUTE.handler({
          mastra,
          agentId: 'test-agent',
          requestContext: createContextWithReservedKeys({ resourceId: 'user-a' }),
          abortSignal: new AbortController().signal,
          resourceId: 'user-a',
          threadId: 'decline-thread-owned-by-b',
          toolCallId: 'tool-call-123',
          approved: true,
        } as any),
      ).rejects.toThrow(new HTTPException(403, { message: 'Access denied: thread belongs to a different resource' }));
      expect((mockAgent as any).sendToolApproval).not.toHaveBeenCalled();
    });

    it('should approve subscription tool calls using context resource and thread values', async () => {
      await mockMemory.createThread({
        threadId: 'approval-thread-from-context',
        resourceId: 'user-a',
        title: 'Approval Thread A',
      });
      (mockAgent as any).sendToolApproval = vi.fn(async params => ({
        accepted: true,
        runId: 'run-123',
        toolCallId: params.toolCallId,
      }));

      await SEND_TOOL_APPROVAL_ROUTE.handler({
        mastra,
        agentId: 'test-agent',
        requestContext: createContextWithReservedKeys({
          resourceId: 'user-a',
          threadId: 'approval-thread-from-context',
        }),
        abortSignal: new AbortController().signal,
        resourceId: 'user-b',
        threadId: 'client-thread-ignored',
        toolCallId: 'tool-call-123',
        approved: true,
      } as any);

      expect((mockAgent as any).sendToolApproval).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: 'user-a',
          threadId: 'approval-thread-from-context',
          toolCallId: 'tool-call-123',
        }),
      );
    });

    it('should list suspended runs with filters passed through', async () => {
      const run = {
        runId: 'run-123',
        status: 'suspended',
        threadId: 'thread-123',
        resourceId: 'resource-123',
        suspendedAt: new Date(),
        toolCalls: [
          { toolCallId: 'tool-call-123', toolName: 'findUserTool', args: { name: 'Dero' }, requiresApproval: true },
        ],
      };
      (mockAgent as any).listSuspendedRuns = vi.fn(async () => ({ runs: [run], total: 1 }));
      await mockMemory.createThread({
        threadId: 'thread-123',
        resourceId: 'resource-123',
        title: 'Thread 123',
      });

      const fromDate = new Date('2026-01-01');
      const result = await LIST_SUSPENDED_RUNS_ROUTE.handler({
        mastra,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
        threadId: 'thread-123',
        resourceId: 'resource-123',
        fromDate,
        perPage: 10,
        page: 0,
      } as any);

      expect(result).toEqual({ runs: [run], total: 1 });
      expect((mockAgent as any).listSuspendedRuns).toHaveBeenCalledWith({
        threadId: 'thread-123',
        resourceId: 'resource-123',
        fromDate,
        toDate: undefined,
        perPage: 10,
        page: 0,
      });
    });

    it('should scope suspended-run listing to context resource and thread values', async () => {
      (mockAgent as any).listSuspendedRuns = vi.fn(async () => ({ runs: [], total: 0 }));
      await mockMemory.createThread({
        threadId: 'thread-a',
        resourceId: 'user-a',
        title: 'Thread A',
      });

      await LIST_SUSPENDED_RUNS_ROUTE.handler({
        mastra,
        agentId: 'test-agent',
        requestContext: createContextWithReservedKeys({ resourceId: 'user-a', threadId: 'thread-a' }),
        threadId: 'client-thread-ignored',
        resourceId: 'user-b',
      } as any);

      expect((mockAgent as any).listSuspendedRuns).toHaveBeenCalledWith(
        expect.objectContaining({ threadId: 'thread-a', resourceId: 'user-a' }),
      );
    });

    it('should return 403 when listing suspended runs for a thread owned by a different resource', async () => {
      (mockAgent as any).listSuspendedRuns = vi.fn(async () => ({ runs: [], total: 0 }));
      await mockMemory.createThread({
        threadId: 'suspended-thread-owned-by-b',
        resourceId: 'user-b',
        title: 'Thread B',
      });

      await expect(
        LIST_SUSPENDED_RUNS_ROUTE.handler({
          mastra,
          agentId: 'test-agent',
          requestContext: createContextWithReservedKeys({ resourceId: 'user-a' }),
          threadId: 'suspended-thread-owned-by-b',
        } as any),
      ).rejects.toThrow(new HTTPException(403, { message: 'Access denied: thread belongs to a different resource' }));

      expect((mockAgent as any).listSuspendedRuns).not.toHaveBeenCalled();
    });

    it('should return 403 when a thread filter is requested but the agent has no memory', async () => {
      (mockAgent as any).listSuspendedRuns = vi.fn(async () => ({ runs: [], total: 0 }));
      const getMemorySpy = vi.spyOn(mockAgent, 'getMemory').mockResolvedValue(undefined as any);

      await expect(
        LIST_SUSPENDED_RUNS_ROUTE.handler({
          mastra,
          agentId: 'test-agent',
          requestContext: createContextWithReservedKeys({ resourceId: 'user-a' }),
          threadId: 'some-thread',
        } as any),
      ).rejects.toThrow(
        new HTTPException(403, {
          message: 'Access denied: agent has no memory configured to validate thread ownership',
        }),
      );

      expect((mockAgent as any).listSuspendedRuns).not.toHaveBeenCalled();
      getMemorySpy.mockRestore();
    });

    it('should return 403 when a thread filter is requested but the thread does not exist', async () => {
      (mockAgent as any).listSuspendedRuns = vi.fn(async () => ({ runs: [], total: 0 }));

      await expect(
        LIST_SUSPENDED_RUNS_ROUTE.handler({
          mastra,
          agentId: 'test-agent',
          requestContext: createContextWithReservedKeys({ resourceId: 'user-a' }),
          threadId: 'nonexistent-thread',
        } as any),
      ).rejects.toThrow(new HTTPException(403, { message: 'Access denied: thread not found' }));

      expect((mockAgent as any).listSuspendedRuns).not.toHaveBeenCalled();
    });

    it('should send a signal using context resource and thread values', async () => {
      await mockMemory.createThread({
        threadId: 'signal-thread-from-context',
        resourceId: 'user-a',
        title: 'Signal Thread',
      });
      const requestContext = createContextWithReservedKeys({
        resourceId: 'user-a',
        threadId: 'signal-thread-from-context',
      });
      let capturedSignal: any;
      let capturedTarget: any;

      (mockAgent as any).sendSignal = vi.fn((signal, target) => {
        capturedSignal = signal;
        capturedTarget = target;
        return {
          accepted: Promise.resolve({ action: 'deliver', runId: 'signal-run-id' }),
        };
      });

      const result = await SEND_AGENT_SIGNAL_ROUTE.handler({
        mastra,
        agentId: 'test-agent',
        requestContext,
        signal: { type: 'user-message', contents: 'hello', attributes: { source: 'test', attempt: 1 } },
        resourceId: 'user-b',
        threadId: 'client-thread',
      } as any);

      expect(result).toEqual({ accepted: true, runId: 'signal-run-id' });
      expect(capturedSignal).toEqual({
        type: 'user-message',
        contents: 'hello',
        attributes: { source: 'test', attempt: 1 },
      });
      expect(capturedTarget).toMatchObject({
        resourceId: 'user-a',
        threadId: 'signal-thread-from-context',
      });
    });

    it('should send a message using context resource and thread values', async () => {
      await mockMemory.createThread({
        threadId: 'message-thread-from-context',
        resourceId: 'user-a',
        title: 'Message Thread',
      });
      const requestContext = createContextWithReservedKeys({
        resourceId: 'user-a',
        threadId: 'message-thread-from-context',
      });
      let capturedMessage: any;
      let capturedTarget: any;

      (mockAgent as any).sendMessage = vi.fn((message, target) => {
        capturedMessage = message;
        capturedTarget = target;
        return {
          accepted: Promise.resolve({ action: 'deliver', runId: 'message-run-id' }),
          signal: { id: 'signal-id' },
        };
      });

      const result = await SEND_AGENT_MESSAGE_ROUTE.handler({
        mastra,
        agentId: 'test-agent',
        requestContext,
        message: { contents: 'hello', attributes: { source: 'test' }, metadata: { client: 'sdk' } },
        resourceId: 'user-b',
        threadId: 'client-thread',
      } as any);

      expect(result).toEqual({ accepted: true, runId: 'message-run-id', signal: { id: 'signal-id' } });
      expect(capturedMessage).toEqual({
        contents: 'hello',
        attributes: { source: 'test' },
        metadata: { client: 'sdk' },
      });
      expect(capturedTarget).toMatchObject({
        resourceId: 'user-a',
        threadId: 'message-thread-from-context',
      });
    });

    it.each([
      { route: SEND_AGENT_MESSAGE_ROUTE, method: 'sendMessage' },
      { route: QUEUE_AGENT_MESSAGE_ROUTE, method: 'queueMessage' },
    ] as const)('should normalize idle stream options for $method', async ({ route, method }) => {
      await mockMemory.createThread({
        threadId: 'queue-message-thread-with-context',
        resourceId: 'user-a',
        title: 'Queue Message Thread With Context',
      });
      const requestContext = createContextWithReservedKeys({ resourceId: 'user-a' });
      let capturedTarget: any;

      (mockAgent as any)[method] = vi.fn((_message: unknown, target: unknown) => {
        capturedTarget = target;
        return {
          accepted: Promise.resolve({ action: 'deliver', runId: 'queued-message-run-id' }),
        };
      });

      const result = await (route.handler as any)({
        mastra,
        agentId: 'test-agent',
        requestContext,
        message: 'hello',
        resourceId: 'user-a',
        threadId: 'queue-message-thread-with-context',
        ifIdle: {
          attributes: { delivery: 'queued' },
          streamOptions: {
            instructions: 'Use the fixture.',
            actor: { actorKind: 'system', agentId: 'forged-agent' },
            requestContext: {
              fixture: 'text-stream',
              [MASTRA_RESOURCE_ID_KEY]: 'user-b',
              organizationId: 'forged-org',
            },
            versions: {
              agents: {
                'sub-agent': { versionId: 'version-1' },
              },
            },
          },
        },
      } as any);

      expect(result).toEqual({ accepted: true, runId: 'queued-message-run-id' });
      expect(capturedTarget.ifIdle.attributes).toEqual({ delivery: 'queued' });
      expect(capturedTarget.ifIdle.streamOptions.instructions).toBe('Use the fixture.');
      expect(capturedTarget.ifIdle.streamOptions).not.toHaveProperty('actor');
      expect(capturedTarget.ifIdle.streamOptions.requestContext).toBe(requestContext);
      expect(capturedTarget.ifIdle.streamOptions.requestContext.get('fixture')).toBe('text-stream');
      expect(capturedTarget.ifIdle.streamOptions.requestContext.get(MASTRA_RESOURCE_ID_KEY)).toBe('user-a');
      expect(capturedTarget.ifIdle.streamOptions.requestContext.get('organizationId')).toBeUndefined();
      expect(capturedTarget.ifIdle.streamOptions.requestContext.get(MASTRA_VERSIONS_KEY)).toEqual({
        agents: {
          'sub-agent': { versionId: 'version-1' },
        },
        defaultStatus: 'published',
      });
    });

    it('should merge idle stream request context before waking a thread with a signal', async () => {
      await mockMemory.createThread({
        threadId: 'signal-thread-with-context',
        resourceId: 'user-a',
        title: 'Signal Thread With Context',
      });
      const requestContext = createContextWithReservedKeys({ resourceId: 'user-a' });
      let capturedTarget: any;

      (mockAgent as any).sendSignal = vi.fn((_signal, target) => {
        capturedTarget = target;
        return {
          accepted: Promise.resolve({ action: 'deliver', runId: 'signal-run-with-context' }),
        };
      });

      const result = await SEND_AGENT_SIGNAL_ROUTE.handler({
        mastra,
        agentId: 'test-agent',
        requestContext,
        signal: { type: 'user-message', contents: 'hello' },
        resourceId: 'user-a',
        threadId: 'signal-thread-with-context',
        ifIdle: {
          streamOptions: {
            instructions: 'Use the fixture.',
            actor: { actorKind: 'system', agentId: 'forged-agent' },
            requestContext: {
              fixture: 'text-stream',
              [MASTRA_RESOURCE_ID_KEY]: 'user-b',
              organizationId: 'forged-org',
            },
          },
        },
      } as any);

      expect(result).toMatchObject({ accepted: true, runId: 'signal-run-with-context' });
      expect(capturedTarget.ifIdle.streamOptions.instructions).toBe('Use the fixture.');
      expect(capturedTarget.ifIdle.streamOptions).not.toHaveProperty('actor');
      expect(capturedTarget.ifIdle.streamOptions.requestContext).toBe(requestContext);
      expect(capturedTarget.ifIdle.streamOptions.requestContext.get('fixture')).toBe('text-stream');
      expect(capturedTarget.ifIdle.streamOptions.requestContext.get(MASTRA_RESOURCE_ID_KEY)).toBe('user-a');
      expect(capturedTarget.ifIdle.streamOptions.requestContext.get('organizationId')).toBeUndefined();
    });

    it('maps a rejected accepted promise (USER MastraError) to a 400', async () => {
      await mockMemory.createThread({
        threadId: 'signal-thread-reject-user',
        resourceId: 'user-a',
        title: 'Signal Thread Reject User',
      });
      const requestContext = createContextWithReservedKeys({ resourceId: 'user-a' });

      (mockAgent as any).sendSignal = vi.fn(() => ({
        accepted: Promise.reject(
          new MastraError({
            category: ErrorCategory.USER,
            domain: ErrorDomain.MASTRA_SERVER,
            id: 'NO_MODEL_SELECTED',
            text: 'No model selected',
          }),
        ),
      }));

      await expect(
        SEND_AGENT_SIGNAL_ROUTE.handler({
          mastra,
          agentId: 'test-agent',
          requestContext,
          signal: { type: 'user-message', contents: 'hello' },
          resourceId: 'user-a',
          threadId: 'signal-thread-reject-user',
        } as any),
      ).rejects.toThrow(new HTTPException(400, { message: 'No model selected' }));
    });

    it('maps a rejected accepted promise (non-USER error) to a 500', async () => {
      await mockMemory.createThread({
        threadId: 'signal-thread-reject-system',
        resourceId: 'user-a',
        title: 'Signal Thread Reject System',
      });
      const requestContext = createContextWithReservedKeys({ resourceId: 'user-a' });

      (mockAgent as any).sendSignal = vi.fn(() => ({
        accepted: Promise.reject(new Error('lease backend exploded')),
      }));

      await expect(
        SEND_AGENT_SIGNAL_ROUTE.handler({
          mastra,
          agentId: 'test-agent',
          requestContext,
          signal: { type: 'user-message', contents: 'hello' },
          resourceId: 'user-a',
          threadId: 'signal-thread-reject-system',
        } as any),
      ).rejects.toMatchObject({ status: 500 });
    });

    it('should reject sending a message to a thread owned by a different resource', async () => {
      await mockMemory.createThread({
        threadId: 'message-thread-owned-by-b',
        resourceId: 'user-b',
        title: 'Thread B',
      });
      const requestContext = createContextWithReservedKeys({ resourceId: 'user-a' });

      await expect(
        SEND_AGENT_MESSAGE_ROUTE.handler({
          mastra,
          agentId: 'test-agent',
          requestContext,
          message: 'hello',
          resourceId: 'user-a',
          threadId: 'message-thread-owned-by-b',
        } as any),
      ).rejects.toThrow(new HTTPException(403, { message: 'Access denied: thread belongs to a different resource' }));
    });

    it('should reject sending a signal to a thread owned by a different resource', async () => {
      await mockMemory.createThread({
        threadId: 'signal-thread-owned-by-b',
        resourceId: 'user-b',
        title: 'Thread B',
      });
      const requestContext = createContextWithReservedKeys({ resourceId: 'user-a' });

      await expect(
        SEND_AGENT_SIGNAL_ROUTE.handler({
          mastra,
          agentId: 'test-agent',
          requestContext,
          signal: { type: 'user-message', contents: 'hello' },
          resourceId: 'user-a',
          threadId: 'signal-thread-owned-by-b',
        } as any),
      ).rejects.toThrow(new HTTPException(403, { message: 'Access denied: thread belongs to a different resource' }));
    });

    it('should subscribe to a thread and stream future run chunks', async () => {
      await mockMemory.createThread({
        threadId: 'subscribe-thread-from-context',
        resourceId: 'user-a',
        title: 'Subscribe Thread',
      });
      const requestContext = createContextWithReservedKeys({
        resourceId: 'user-a',
        threadId: 'subscribe-thread-from-context',
      });
      let capturedTarget: any;
      const abort = vi.fn(() => true);
      const unsubscribe = vi.fn();
      const chunk = {
        type: 'text-delta',
        runId: 'subscribed-run-id',
        from: 'AGENT',
        payload: { id: 'text-1', text: 'hello' },
      };

      (mockAgent as any).subscribeToThread = vi.fn(async target => {
        capturedTarget = target;
        return {
          activeRunId: () => null,
          abort,
          unsubscribe,
          stream: (async function* () {
            yield chunk;
            await new Promise(() => {});
          })(),
        } as any;
      });

      const stream = (await SUBSCRIBE_AGENT_THREAD_ROUTE.handler({
        mastra,
        agentId: 'test-agent',
        requestContext,
        abortSignal: new AbortController().signal,
        resourceId: 'user-b',
        threadId: 'client-thread',
      } as any)) as ReadableStream;

      expect(capturedTarget).toEqual({ resourceId: 'user-a', threadId: 'subscribe-thread-from-context' });
      const reader = stream.getReader();
      await expect(reader.read()).resolves.toEqual({ value: chunk, done: false });
      expect(abort).not.toHaveBeenCalled();
      expect(unsubscribe).not.toHaveBeenCalled();
      await reader.cancel();
      expect(abort).not.toHaveBeenCalled();
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('should emit heartbeat comments while a subscription stream is idle', async () => {
      vi.useFakeTimers();
      try {
        await mockMemory.createThread({
          threadId: 'subscribe-thread-heartbeat',
          resourceId: 'user-a',
          title: 'Subscribe Heartbeat',
        });
        const abort = vi.fn(() => true);
        const unsubscribe = vi.fn();

        (mockAgent as any).subscribeToThread = vi.fn(async () => ({
          activeRunId: () => null,
          abort,
          unsubscribe,
          stream: (async function* () {
            await new Promise(() => {});
          })(),
        }));

        const stream = (await SUBSCRIBE_AGENT_THREAD_ROUTE.handler({
          mastra,
          agentId: 'test-agent',
          requestContext: createContextWithReservedKeys({ resourceId: 'user-a' }),
          abortSignal: new AbortController().signal,
          resourceId: 'user-a',
          threadId: 'subscribe-thread-heartbeat',
        } as any)) as ReadableStream;

        const reader = stream.getReader();
        const read = reader.read();
        await vi.advanceTimersByTimeAsync(25_000);

        await expect(read).resolves.toEqual({ value: ': heartbeat\n\n', done: false });
        await reader.cancel();
      } finally {
        vi.useRealTimers();
      }
    });

    it('should clear heartbeat timers when an idle subscription stream is aborted', async () => {
      vi.useFakeTimers();
      try {
        await mockMemory.createThread({
          threadId: 'subscribe-thread-abort-heartbeat',
          resourceId: 'user-a',
          title: 'Subscribe Abort Heartbeat',
        });
        const abortController = new AbortController();
        const abort = vi.fn(() => true);
        const unsubscribe = vi.fn();

        (mockAgent as any).subscribeToThread = vi.fn(async () => ({
          activeRunId: () => null,
          abort,
          unsubscribe,
          stream: (async function* () {
            await new Promise(() => {});
          })(),
        }));

        const stream = (await SUBSCRIBE_AGENT_THREAD_ROUTE.handler({
          mastra,
          agentId: 'test-agent',
          requestContext: createContextWithReservedKeys({ resourceId: 'user-a' }),
          abortSignal: abortController.signal,
          resourceId: 'user-a',
          threadId: 'subscribe-thread-abort-heartbeat',
        } as any)) as ReadableStream;

        const reader = stream.getReader();
        abortController.abort();
        await Promise.resolve();

        expect(abort).not.toHaveBeenCalled();
        expect(unsubscribe).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
        await vi.advanceTimersByTimeAsync(25_000);
        await expect(reader.read()).resolves.toEqual({ value: undefined, done: true });
      } finally {
        vi.useRealTimers();
      }
    });

    it('should abort an active thread run without unsubscribing listeners', async () => {
      await mockMemory.createThread({
        threadId: 'abort-thread-owned-by-context',
        resourceId: 'user-a',
        title: 'Abort Thread',
      });
      const requestContext = createContextWithReservedKeys({
        resourceId: 'user-a',
        threadId: 'abort-thread-owned-by-context',
      });
      const abortThreadStream = vi.fn(() => true);
      (mockAgent as any).abortThreadStream = abortThreadStream;

      await expect(
        ABORT_AGENT_THREAD_ROUTE.handler({
          mastra,
          agentId: 'test-agent',
          requestContext,
          resourceId: 'ignored-resource',
          threadId: 'ignored-thread',
        } as any),
      ).resolves.toEqual({ aborted: true });

      expect(abortThreadStream).toHaveBeenCalledWith({
        resourceId: 'user-a',
        threadId: 'abort-thread-owned-by-context',
      });
    });

    it('should reject subscribing to a thread owned by a different resource', async () => {
      await mockMemory.createThread({
        threadId: 'subscribe-thread-owned-by-b',
        resourceId: 'user-b',
        title: 'Thread B',
      });
      const requestContext = createContextWithReservedKeys({ resourceId: 'user-a' });

      await expect(
        SUBSCRIBE_AGENT_THREAD_ROUTE.handler({
          mastra,
          agentId: 'test-agent',
          requestContext,
          abortSignal: new AbortController().signal,
          resourceId: 'user-a',
          threadId: 'subscribe-thread-owned-by-b',
        } as any),
      ).rejects.toThrow(new HTTPException(403, { message: 'Access denied: thread belongs to a different resource' }));
    });
  });
});

describe('extractVersionOptions', () => {
  it('should return undefined when no requestContext or bodyRequestContext', () => {
    expect(extractVersionOptions()).toBeUndefined();
    expect(extractVersionOptions(undefined, undefined)).toBeUndefined();
  });

  it('should extract agentVersionId from server RequestContext', () => {
    const ctx = new RequestContext();
    ctx.set('agentVersionId', 'version-from-server');
    expect(extractVersionOptions(ctx)).toEqual({ versionId: 'version-from-server' });
  });

  it('should extract agentVersionId from body requestContext', () => {
    const bodyCtx = { agentVersionId: 'version-from-body' };
    expect(extractVersionOptions(undefined, bodyCtx)).toEqual({ versionId: 'version-from-body' });
  });

  it('should prefer server RequestContext over body requestContext', () => {
    const serverCtx = new RequestContext();
    serverCtx.set('agentVersionId', 'server-version');
    const bodyCtx = { agentVersionId: 'body-version' };
    expect(extractVersionOptions(serverCtx, bodyCtx)).toEqual({ versionId: 'server-version' });
  });

  it('should fall back to body when server RequestContext has no agentVersionId', () => {
    const serverCtx = new RequestContext();
    const bodyCtx = { agentVersionId: 'body-version' };
    expect(extractVersionOptions(serverCtx, bodyCtx)).toEqual({ versionId: 'body-version' });
  });

  it('should return undefined for empty string agentVersionId in server context', () => {
    const serverCtx = new RequestContext();
    serverCtx.set('agentVersionId', '');
    expect(extractVersionOptions(serverCtx)).toBeUndefined();
  });

  it('should return undefined for empty string agentVersionId in body context', () => {
    expect(extractVersionOptions(undefined, { agentVersionId: '' })).toBeUndefined();
  });

  it('should return undefined for non-string agentVersionId values', () => {
    const serverCtx = new RequestContext();
    serverCtx.set('agentVersionId', 42);
    expect(extractVersionOptions(serverCtx)).toBeUndefined();

    expect(extractVersionOptions(undefined, { agentVersionId: 42 })).toBeUndefined();
    expect(extractVersionOptions(undefined, { agentVersionId: true })).toBeUndefined();
    expect(extractVersionOptions(undefined, { agentVersionId: null })).toBeUndefined();
  });

  it('should skip empty server context and use body when server value is non-string', () => {
    const serverCtx = new RequestContext();
    serverCtx.set('agentVersionId', 123);
    const bodyCtx = { agentVersionId: 'valid-body-version' };
    expect(extractVersionOptions(serverCtx, bodyCtx)).toEqual({ versionId: 'valid-body-version' });
  });

  it('should handle body requestContext without agentVersionId key', () => {
    expect(extractVersionOptions(undefined, { otherKey: 'value' })).toBeUndefined();
    expect(extractVersionOptions(undefined, {})).toBeUndefined();
  });
});
