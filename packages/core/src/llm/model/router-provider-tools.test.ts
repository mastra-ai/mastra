import type { LanguageModelV3, LanguageModelV3CallOptions } from '@ai-sdk/provider-v6';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prepareToolsAndToolChoice } from '../../stream/aisdk/v5/compat/prepare-tools';
import type { ModelSpecVersion } from '../../stream/aisdk/v5/compat/prepare-tools';
import { MastraModelGateway } from './gateways/base';
import type { ProviderConfig, GatewayLanguageModel } from './gateways/base';
import { ModelRouterLanguageModel } from './router';

/**
 * Regression test for https://github.com/mastra-ai/mastra/issues/13667
 *
 * When a custom gateway returns a V3 (AI SDK v6) model via .responses(),
 * the ModelRouterLanguageModel hardcodes specificationVersion='v2'.
 * This causes provider tools (like openai.tools.webSearch()) to be prepared
 * with type='provider-defined' instead of type='provider', which AI SDK v6
 * rejects — resulting in empty tools.
 *
 * The fix: the router remaps 'provider-defined' → 'provider' in tool options
 * when delegating to a V3 model in doGenerate/doStream.
 */

// Mock V3 language model (as returned by .responses())
function createMockV3Model(): LanguageModelV3 {
  return {
    specificationVersion: 'v3',
    provider: 'openai',
    modelId: 'gpt-4o',
    defaultObjectGenerationMode: 'json',
    supportsStructuredOutputs: true,
    supportsImageUrls: true,
    supportedUrls: {},
    doGenerate: vi.fn().mockResolvedValue({
      text: 'mock response',
      content: [{ type: 'text', text: 'mock response' }],
      usage: { promptTokens: 10, completionTokens: 5 },
      finishReason: 'stop',
      request: {},
      response: { id: 'test', modelId: 'gpt-4o' },
    }),
    doStream: vi.fn().mockResolvedValue({
      stream: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
      response: { id: 'test', modelId: 'gpt-4o' },
    }),
  };
}

// Custom gateway that returns a V3 model (simulating .responses())
class V3Gateway extends MastraModelGateway {
  readonly id = 'v3-gateway';
  readonly name = 'V3 Gateway';

  private mockModel: LanguageModelV3;

  constructor(mockModel: LanguageModelV3) {
    super();
    this.mockModel = mockModel;
  }

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    return {
      openai: {
        name: 'OpenAI',
        models: ['gpt-4o'],
        apiKeyEnvVar: 'OPENAI_API_KEY',
        gateway: 'v3-gateway',
      },
    };
  }

  buildUrl(): string {
    return 'https://api.openai.com';
  }

  async getApiKey(): Promise<string> {
    return 'test-api-key';
  }

  async resolveLanguageModel(): Promise<GatewayLanguageModel> {
    return this.mockModel;
  }
}

describe('ModelRouterLanguageModel with V3 gateway and provider tools (#13667)', () => {
  let mockV3Model: LanguageModelV3;
  let gateway: V3Gateway;

  beforeEach(() => {
    // Clear cached model instances between tests
    // @ts-expect-error accessing private static field for test cleanup
    ModelRouterLanguageModel.modelInstances = new Map();
    // @ts-expect-error accessing private static field for test cleanup
    ModelRouterLanguageModel.webSocketFetches = new Map();

    mockV3Model = createMockV3Model();
    gateway = new V3Gateway(mockV3Model);
  });

  it('router specificationVersion remains v2 (tools are remapped in doGenerate/doStream instead)', () => {
    const router = new ModelRouterLanguageModel({ id: 'v3-gateway/openai/gpt-4o' as `${string}/${string}` }, [gateway]);

    // The router still reports v2 — the fix remaps tools inside doGenerate/doStream
    expect(router.specificationVersion).toBe('v2');
  });

  it('tool preparation from execute.ts still produces v2 format (remapping happens in router)', () => {
    const router = new ModelRouterLanguageModel({ id: 'v3-gateway/openai/gpt-4o' as `${string}/${string}` }, [gateway]);

    // execute.ts determines targetVersion from model.specificationVersion
    const targetVersion: ModelSpecVersion = router.specificationVersion === 'v3' ? 'v3' : 'v2';

    const providerTool = {
      id: 'openai.web_search',
      type: 'provider-defined',
      args: { search_context_size: 'medium' },
    };

    const result = prepareToolsAndToolChoice({
      tools: { web_search: providerTool as any },
      toolChoice: undefined,
      activeTools: undefined,
      targetVersion,
    });

    // Tools are still prepared as v2 format here — the router remaps them later
    expect(result.tools).toHaveLength(1);
    expect(result.tools![0]).toMatchObject({
      type: 'provider-defined',
    });
  });

  it('should remap provider tools from provider-defined to provider when routing to V3 model via doStream', async () => {
    const router = new ModelRouterLanguageModel({ id: 'v3-gateway/openai/gpt-4o' as `${string}/${string}` }, [gateway]);

    // Simulate what execute.ts does: prepare tools with v2 format
    const providerTool = {
      id: 'openai.web_search',
      type: 'provider-defined',
      args: { search_context_size: 'medium' },
    };

    const preparedTools = prepareToolsAndToolChoice({
      tools: { web_search: providerTool as any },
      toolChoice: undefined,
      activeTools: undefined,
      targetVersion: 'v2',
    });

    // Call doStream which resolves to V3 model internally
    await router.doStream({
      inputFormat: 'messages',
      mode: { type: 'regular', tools: preparedTools.tools, toolChoice: preparedTools.toolChoice },
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Search the web' }] }],
    });

    // Verify the tools passed to the underlying V3 model have been remapped
    const doStreamCall = (mockV3Model.doStream as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(doStreamCall).toBeDefined();

    const passedOptions = doStreamCall[0] as LanguageModelV3CallOptions;
    const passedTools = passedOptions.mode?.type === 'regular' ? passedOptions.mode.tools : undefined;

    expect(passedTools).toBeDefined();
    expect(passedTools).toHaveLength(1);
    expect(passedTools![0].type).toBe('provider');
    expect((passedTools![0] as any).id).toBe('openai.web_search');
    expect((passedTools![0] as any).args).toEqual({ search_context_size: 'medium' });
  });

  it('should remap provider tools from provider-defined to provider when routing to V3 model via doGenerate', async () => {
    const router = new ModelRouterLanguageModel({ id: 'v3-gateway/openai/gpt-4o' as `${string}/${string}` }, [gateway]);

    const providerTool = {
      id: 'openai.web_search',
      type: 'provider-defined',
      args: {},
    };

    const preparedTools = prepareToolsAndToolChoice({
      tools: { web_search: providerTool as any },
      toolChoice: undefined,
      activeTools: undefined,
      targetVersion: 'v2',
    });

    await router.doGenerate({
      inputFormat: 'messages',
      mode: { type: 'regular', tools: preparedTools.tools, toolChoice: preparedTools.toolChoice },
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Search the web' }] }],
    });

    // Verify the tools passed to the underlying V3 model have been remapped
    const doGenerateCall = (mockV3Model.doGenerate as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(doGenerateCall).toBeDefined();

    const passedOptions = doGenerateCall[0] as LanguageModelV3CallOptions;
    const passedTools = passedOptions.mode?.type === 'regular' ? passedOptions.mode.tools : undefined;

    expect(passedTools).toBeDefined();
    expect(passedTools).toHaveLength(1);
    expect(passedTools![0].type).toBe('provider');
  });

  it('should not remap function tools when routing to V3 model', async () => {
    const router = new ModelRouterLanguageModel({ id: 'v3-gateway/openai/gpt-4o' as `${string}/${string}` }, [gateway]);

    // Regular function tools should pass through unchanged
    const functionTool = {
      type: 'function' as const,
      name: 'calculator',
      description: 'A calculator',
      inputSchema: { type: 'object', properties: {} },
    };

    await router.doStream({
      inputFormat: 'messages',
      mode: { type: 'regular', tools: [functionTool], toolChoice: { type: 'auto' } },
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Calculate something' }] }],
    });

    const doStreamCall = (mockV3Model.doStream as ReturnType<typeof vi.fn>).mock.calls[0];
    const passedOptions = doStreamCall[0] as LanguageModelV3CallOptions;
    const passedTools = passedOptions.mode?.type === 'regular' ? passedOptions.mode.tools : undefined;

    expect(passedTools).toHaveLength(1);
    expect(passedTools![0].type).toBe('function');
  });

  it('should handle mixed provider and function tools when routing to V3 model', async () => {
    const router = new ModelRouterLanguageModel({ id: 'v3-gateway/openai/gpt-4o' as `${string}/${string}` }, [gateway]);

    const tools = [
      {
        type: 'provider-defined' as const,
        name: 'web_search',
        id: 'openai.web_search',
        args: {},
      },
      {
        type: 'function' as const,
        name: 'calculator',
        description: 'A calculator',
        inputSchema: { type: 'object', properties: {} },
      },
    ];

    await router.doStream({
      inputFormat: 'messages',
      mode: { type: 'regular', tools: tools as any, toolChoice: { type: 'auto' } },
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Search and calculate' }] }],
    });

    const doStreamCall = (mockV3Model.doStream as ReturnType<typeof vi.fn>).mock.calls[0];
    const passedOptions = doStreamCall[0] as LanguageModelV3CallOptions;
    const passedTools = passedOptions.mode?.type === 'regular' ? passedOptions.mode.tools : undefined;

    expect(passedTools).toHaveLength(2);
    expect(passedTools![0].type).toBe('provider'); // remapped from 'provider-defined'
    expect(passedTools![1].type).toBe('function'); // unchanged
  });
});
