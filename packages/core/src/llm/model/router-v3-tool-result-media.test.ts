import type { LanguageModelV3 } from '@ai-sdk/provider-v6';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MastraModelGateway } from './gateways/base';
import type { ProviderConfig, GatewayLanguageModel } from './gateways/base';
import { ModelRouterLanguageModel } from './router';

/**
 * Regression test for https://github.com/mastra-ai/mastra/issues/21183
 *
 * ModelRouterLanguageModel hardcodes specificationVersion='v2', so the v6
 * prompt-conversion path (aiV5PromptToAIV6Prompt) never runs when the
 * resolved provider is a V3 model. The router then wraps that V3 model in
 * AISDKV6LanguageModel; without an adapter-side remap, a v2 tool-result
 * media part reaches the V3 provider unchanged and cannot survive provider
 * serialization (v3 has no `media` content-part type).
 *
 * This test exercises the full router dispatch path (not just the adapter
 * directly) to confirm the fix covers the actual entry point agents use.
 */

function createMockV3Model(): LanguageModelV3 {
  return {
    specificationVersion: 'v3',
    provider: 'openai',
    modelId: 'gpt-test',
    supportedUrls: {},
    doGenerate: vi.fn().mockResolvedValue({
      content: [],
      finishReason: 'stop',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      warnings: [],
      request: {},
      response: { id: 'test', modelId: 'gpt-test' },
    }),
    doStream: vi.fn().mockResolvedValue({
      stream: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
    }),
  } as unknown as LanguageModelV3;
}

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
        models: ['gpt-test'],
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

describe('ModelRouterLanguageModel with V3 gateway and tool-result media (#21183)', () => {
  let mockV3Model: LanguageModelV3;
  let gateway: V3Gateway;

  beforeEach(() => {
    (ModelRouterLanguageModel as any)._clearCachesForTests();
    mockV3Model = createMockV3Model();
    gateway = new V3Gateway(mockV3Model);
  });

  it('remaps a v2 tool-result media part to image-data when routed to a V3 provider via doStream', async () => {
    const router = new ModelRouterLanguageModel({ id: 'v3-gateway/openai/gpt-test' as `${string}/${string}` }, [
      gateway,
    ]);

    await router.doStream({
      inputFormat: 'messages',
      prompt: [
        {
          role: 'assistant',
          content: [{ type: 'tool-call', toolCallId: 'call_1', toolName: 'read_image', input: {} }],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call_1',
              toolName: 'read_image',
              output: {
                type: 'content',
                value: [
                  { type: 'text', text: 'image result' },
                  { type: 'media', data: 'iVBORw0KGgo=', mediaType: 'image/png' },
                ],
              },
            },
          ],
        },
      ],
    } as any);

    const doStreamCall = (mockV3Model.doStream as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(doStreamCall).toBeDefined();

    const passedOptions = doStreamCall[0];
    const toolMsg = passedOptions.prompt.find((m: any) => m.role === 'tool');
    const value = toolMsg.content[0].output.value;

    expect(value).toEqual([
      { type: 'text', text: 'image result' },
      {
        type: 'image-data',
        data: 'iVBORw0KGgo=',
        mediaType: 'image/png',
      },
    ]);
  });

  it('remaps a v2 tool-result media part to file-data for non-image media via doGenerate', async () => {
    const router = new ModelRouterLanguageModel({ id: 'v3-gateway/openai/gpt-test' as `${string}/${string}` }, [
      gateway,
    ]);

    await router.doGenerate({
      inputFormat: 'messages',
      prompt: [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call_1',
              toolName: 'read_pdf',
              output: {
                type: 'content',
                value: [{ type: 'media', data: 'JVBERi0=', mediaType: 'application/pdf' }],
              },
            },
          ],
        },
      ],
    } as any);

    const doGenerateCall = (mockV3Model.doGenerate as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(doGenerateCall).toBeDefined();

    const passedOptions = doGenerateCall[0];
    const value = passedOptions.prompt[0].content[0].output.value;

    expect(value).toEqual([{ type: 'file-data', data: 'JVBERi0=', mediaType: 'application/pdf' }]);
  });
});
