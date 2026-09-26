import type { LanguageModelV4 } from '@ai-sdk/provider-v7';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MastraModelGateway } from './gateways/base';
import type { ProviderConfig, GatewayLanguageModel } from './gateways/base';
import { ModelRouterLanguageModel } from './router';

/**
 * Regression test for https://github.com/mastra-ai/mastra/issues/20378
 *
 * ModelRouterLanguageModel hardcodes specificationVersion='v2', so the v2
 * prompt-conversion path (aiV5PromptToAIV7Prompt) never runs when the
 * resolved provider is a V4 model. The router then wraps that V4 model in
 * AISDKV7LanguageModel, whose remapFilePartsToV4() only visits user/assistant
 * messages and only touches existing 'file' parts — so a v2 tool-result
 * media part (e.g. an image returned from a tool call) reaches the V4
 * provider unchanged and gets silently dropped during serialization.
 *
 * This test exercises the full router dispatch path (not just the adapter
 * directly) to confirm the fix covers the actual entry point agents use.
 */

function createMockV4Model(): LanguageModelV4 {
  return {
    specificationVersion: 'v4',
    provider: 'openai',
    modelId: 'gpt-test',
    supportedUrls: {},
    doGenerate: vi.fn().mockResolvedValue({
      content: [],
      finishReason: 'stop',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      warnings: [],
    }),
    doStream: vi.fn().mockResolvedValue({
      stream: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
    }),
  } as unknown as LanguageModelV4;
}

class V4Gateway extends MastraModelGateway {
  readonly id = 'v4-gateway';
  readonly name = 'V4 Gateway';

  private mockModel: LanguageModelV4;

  constructor(mockModel: LanguageModelV4) {
    super();
    this.mockModel = mockModel;
  }

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    return {
      openai: {
        name: 'OpenAI',
        models: ['gpt-test'],
        apiKeyEnvVar: 'OPENAI_API_KEY',
        gateway: 'v4-gateway',
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

describe('ModelRouterLanguageModel with V4 gateway and tool-result media (#20378)', () => {
  let mockV4Model: LanguageModelV4;
  let gateway: V4Gateway;

  beforeEach(() => {
    (ModelRouterLanguageModel as any)._clearCachesForTests();
    mockV4Model = createMockV4Model();
    gateway = new V4Gateway(mockV4Model);
  });

  it('remaps a v2 tool-result media part to a v4 file part when routed to a V4 provider via doStream', async () => {
    const router = new ModelRouterLanguageModel({ id: 'v4-gateway/openai/gpt-test' as `${string}/${string}` }, [
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

    const doStreamCall = (mockV4Model.doStream as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(doStreamCall).toBeDefined();

    const passedOptions = doStreamCall[0];
    const toolMsg = passedOptions.prompt.find((m: any) => m.role === 'tool');
    const value = toolMsg.content[0].output.value;

    expect(value).toEqual([
      { type: 'text', text: 'image result' },
      {
        type: 'file',
        data: { type: 'data', data: 'iVBORw0KGgo=' },
        mediaType: 'image/png',
      },
    ]);
  });
});
