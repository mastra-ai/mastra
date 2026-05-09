import type { LanguageModelV3 } from '@ai-sdk/provider-v6';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { RequestContext } from '../../request-context';
import { prepareToolsAndToolChoice } from '../../stream/aisdk/v5/compat/prepare-tools';
import type { ModelSpecVersion } from '../../stream/aisdk/v5/compat/prepare-tools';
import { createTool } from '../../tools/tool';
import { makeCoreTool } from '../../utils';
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
    (ModelRouterLanguageModel as any)._clearCachesForTests();

    mockV3Model = createMockV3Model();
    gateway = new V3Gateway(mockV3Model);
  });

  it('router specificationVersion remains v2 (tools are remapped in doGenerate/doStream instead)', () => {
    const router = new ModelRouterLanguageModel({ id: 'v3-gateway/openai/gpt-4o' as `${string}/${string}` }, [gateway]);

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

    const preparedTools = prepareToolsAndToolChoice({
      tools: {
        web_search: {
          id: 'openai.web_search',
          type: 'provider-defined',
          args: { search_context_size: 'medium' },
        } as any,
      },
      toolChoice: undefined,
      activeTools: undefined,
      targetVersion: 'v2',
    });

    // Call doStream — tools and toolChoice are spread at the top level of options
    await router.doStream({
      inputFormat: 'messages',
      ...preparedTools,
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Search the web' }] }],
    } as any);

    // Check what tools were actually passed to the underlying V3 model
    const doStreamCall = (mockV3Model.doStream as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(doStreamCall).toBeDefined();

    const passedOptions = doStreamCall[0];
    expect(passedOptions.tools).toBeDefined();
    expect(passedOptions.tools).toHaveLength(1);
    expect(passedOptions.tools[0].type).toBe('provider');
    expect(passedOptions.tools[0].id).toBe('openai.web_search');
    expect(passedOptions.tools[0].args).toEqual({ search_context_size: 'medium' });
  });

  it('should remap provider tools from provider-defined to provider when routing to V3 model via doGenerate', async () => {
    const router = new ModelRouterLanguageModel({ id: 'v3-gateway/openai/gpt-4o' as `${string}/${string}` }, [gateway]);

    const preparedTools = prepareToolsAndToolChoice({
      tools: {
        web_search: {
          id: 'openai.web_search',
          type: 'provider-defined',
          args: {},
        } as any,
      },
      toolChoice: undefined,
      activeTools: undefined,
      targetVersion: 'v2',
    });

    const result = await router.doGenerate({
      inputFormat: 'messages',
      ...preparedTools,
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Search the web' }] }],
    } as any);

    const doGenerateCall = (mockV3Model.doGenerate as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(doGenerateCall).toBeDefined();

    const passedOptions = doGenerateCall[0];
    expect(passedOptions.tools).toBeDefined();
    expect(passedOptions.tools).toHaveLength(1);
    expect(passedOptions.tools[0].type).toBe('provider');

    expect(result).toMatchObject({
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 5 },
      request: {},
      response: { id: 'test', modelId: 'gpt-4o' },
    });
  });

  it('should not remap function tools when routing to V3 model', async () => {
    const router = new ModelRouterLanguageModel({ id: 'v3-gateway/openai/gpt-4o' as `${string}/${string}` }, [gateway]);

    await router.doStream({
      inputFormat: 'messages',
      tools: [
        {
          type: 'function' as const,
          name: 'calculator',
          description: 'A calculator',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
      toolChoice: { type: 'auto' as const },
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Calculate something' }] }],
    });

    const doStreamCall = (mockV3Model.doStream as ReturnType<typeof vi.fn>).mock.calls[0];
    const passedOptions = doStreamCall[0];

    expect(passedOptions.tools).toHaveLength(1);
    expect(passedOptions.tools[0].type).toBe('function');
  });

  it('should preserve strict on function tools when routing v2-prepared tools to a V3 model', async () => {
    const router = new ModelRouterLanguageModel({ id: 'v3-gateway/openai/gpt-4o' as `${string}/${string}` }, [gateway]);

    const strictTool = createTool({
      id: 'strict-tool',
      description: 'A strict tool',
      strict: true,
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
        additionalProperties: false,
      },
      execute: async () => ({ ok: true }),
    });

    const preparedTools = prepareToolsAndToolChoice({
      tools: {
        strictTool: strictTool as any,
      },
      toolChoice: undefined,
      activeTools: undefined,
      targetVersion: 'v2',
    });

    await router.doStream({
      inputFormat: 'messages',
      ...preparedTools,
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Use the strict tool' }] }],
    } as any);

    const doStreamCall = (mockV3Model.doStream as ReturnType<typeof vi.fn>).mock.calls[0];
    const passedOptions = doStreamCall[0];

    expect(passedOptions.tools).toHaveLength(1);
    expect(passedOptions.tools[0]).toMatchObject({
      type: 'function',
      name: 'strictTool',
      strict: true,
    });
  });

  it('should preserve strict through the full createTool → makeCoreTool → prepareTools → router pipeline', async () => {
    const router = new ModelRouterLanguageModel({ id: 'v3-gateway/openai/gpt-4o' as `${string}/${string}` }, [gateway]);

    // Step 1: createTool with strict (what the user writes)
    const strictTool = createTool({
      id: 'add',
      description: 'Add two numbers together.',
      strict: true,
      inputSchema: z.object({
        x: z.number().describe('The first number to add'),
        y: z.number().describe('The second number to add'),
      }),
      execute: async ({ x, y }) => ({ result: `${x + y}` }),
    });

    // Step 2: makeCoreTool (what the agent does internally)
    const coreTool = makeCoreTool(strictTool as any, {
      name: 'addTool',
      logger: console as any,
      description: 'Add two numbers together.',
      requestContext: new RequestContext(),
      tracingContext: {},
    });

    // Step 3: prepareToolsAndToolChoice with targetVersion 'v2' (what execute.ts does — router is always v2)
    const preparedTools = prepareToolsAndToolChoice({
      tools: { addTool: coreTool as any },
      toolChoice: undefined,
      activeTools: undefined,
      targetVersion: 'v2',
    });

    // Step 4: Route through the model router to the V3 model
    await router.doStream({
      inputFormat: 'messages',
      ...preparedTools,
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Add 1 and 2' }] }],
    } as any);

    const doStreamCall = (mockV3Model.doStream as ReturnType<typeof vi.fn>).mock.calls[0];
    const passedOptions = doStreamCall[0];

    expect(passedOptions.tools).toHaveLength(1);
    expect(passedOptions.tools[0]).toMatchObject({
      type: 'function',
      name: 'addTool',
      strict: true,
    });
  });

  it('should handle mixed provider and function tools when routing to V3 model', async () => {
    const router = new ModelRouterLanguageModel({ id: 'v3-gateway/openai/gpt-4o' as `${string}/${string}` }, [gateway]);

    await router.doStream({
      inputFormat: 'messages',
      tools: [
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
      ] as any,
      toolChoice: { type: 'auto' as const },
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Search and calculate' }] }],
    });

    const doStreamCall = (mockV3Model.doStream as ReturnType<typeof vi.fn>).mock.calls[0];
    const passedOptions = doStreamCall[0];

    expect(passedOptions.tools).toHaveLength(2);
    expect(passedOptions.tools[0].type).toBe('provider'); // remapped from 'provider-defined'
    expect(passedOptions.tools[1].type).toBe('function'); // unchanged
  });
});
