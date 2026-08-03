import type { LanguageModelV4 } from '@ai-sdk/provider-v7';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MastraModelGateway } from './gateways/base';
import type { GatewayLanguageModel, ProviderConfig } from './gateways/base';
import { ModelRouterLanguageModel } from './router';

function createMockV4Model(): LanguageModelV4 {
  return {
    specificationVersion: 'v4',
    provider: 'openai',
    modelId: 'gpt-5',
    supportedUrls: {},
    doGenerate: vi.fn(async () => ({
      content: [],
      finishReason: 'stop',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      warnings: [],
    })),
    doStream: vi.fn(async () => ({ stream: new ReadableStream() })),
  } as unknown as LanguageModelV4;
}

class V4Gateway extends MastraModelGateway {
  readonly id = 'v4-gateway';
  readonly name = 'V4 Gateway';

  constructor(private readonly model: LanguageModelV4) {
    super();
  }

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    return {
      openai: {
        name: 'OpenAI',
        models: ['gpt-5'],
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

  resolveLanguageModel(): GatewayLanguageModel {
    return this.model;
  }
}

describe('ModelRouterLanguageModel with V4 tool-result media (#20378)', () => {
  beforeEach(() => {
    (ModelRouterLanguageModel as unknown as { _clearCachesForTests: () => void })._clearCachesForTests();
  });

  it('normalizes V2 media content before delegating to a V4 provider', async () => {
    const model = createMockV4Model();
    const router = new ModelRouterLanguageModel('v4-gateway/openai/gpt-5', [new V4Gateway(model)]);

    await router.doStream({
      inputFormat: 'messages',
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

    const passed = (model.doStream as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(passed.prompt[0].content[0]).toMatchObject({
      type: 'tool-result',
      output: {
        type: 'content',
        value: [
          { type: 'text', text: 'image result' },
          {
            type: 'file',
            data: { type: 'data', data: 'iVBORw0KGgo=' },
            mediaType: 'image/png',
          },
        ],
      },
    });
  });
});
