import type { LanguageModelV3 } from '@ai-sdk/provider-v6';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MastraModelGateway } from './gateways/base';
import type { GatewayLanguageModel, ProviderConfig } from './gateways/base';
import { ModelRouterLanguageModel } from './router';

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

  constructor(private mockModel: LanguageModelV3) {
    super();
  }

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    return {
      openai: {
        name: 'OpenAI',
        models: ['gpt-test'],
        apiKeyEnvVar: 'OPENAI_API_KEY',
        gateway: this.id,
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

describe('ModelRouterLanguageModel with V3 tool-result media', () => {
  let mockV3Model: LanguageModelV3;
  let gateway: V3Gateway;

  beforeEach(() => {
    (ModelRouterLanguageModel as any)._clearCachesForTests();
    mockV3Model = createMockV3Model();
    gateway = new V3Gateway(mockV3Model);
  });

  it('remaps image media before streaming to the resolved V3 provider', async () => {
    const router = new ModelRouterLanguageModel({ id: 'v3-gateway/openai/gpt-test' }, [gateway]);

    await router.doStream({
      prompt: [
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

    const passedOptions = vi.mocked(mockV3Model.doStream).mock.calls[0]![0] as any;
    expect(passedOptions.prompt[0].content[0].output.value).toEqual([
      { type: 'text', text: 'image result' },
      { type: 'image-data', data: 'iVBORw0KGgo=', mediaType: 'image/png' },
    ]);
  });

  it('remaps non-image media before generating with the resolved V3 provider', async () => {
    const router = new ModelRouterLanguageModel({ id: 'v3-gateway/openai/gpt-test' }, [gateway]);

    await router.doGenerate({
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

    const passedOptions = vi.mocked(mockV3Model.doGenerate).mock.calls[0]![0] as any;
    expect(passedOptions.prompt[0].content[0].output.value).toEqual([
      { type: 'file-data', data: 'JVBERi0=', mediaType: 'application/pdf' },
    ]);
  });
});
