import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { describe, expect, it, vi } from 'vitest';
import { AISDKV5LanguageModel } from './model';

function createMockV2Model() {
  return {
    specificationVersion: 'v2',
    provider: 'openai-compatible',
    modelId: 'test-model',
    defaultObjectGenerationMode: 'json',
    supportsStructuredOutputs: true,
    supportsImageUrls: true,
    supportedUrls: {},
    doGenerate: vi.fn().mockResolvedValue({
      text: 'ok',
      content: [],
      warnings: [],
      usage: { promptTokens: 1, completionTokens: 1 },
      finishReason: 'stop',
      request: {},
      response: { id: 'resp_1', modelId: 'test-model' },
    }),
    doStream: vi.fn().mockResolvedValue({
      stream: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
      request: {},
      response: { id: 'resp_1', modelId: 'test-model' },
    }),
  } as unknown as LanguageModelV2;
}

describe('AISDKV5LanguageModel', () => {
  it.each(['doGenerate', 'doStream'] as const)(
    'strips strict from function tools before calling v2 %s',
    async method => {
      const model = createMockV2Model();
      const wrapped = new AISDKV5LanguageModel(model);

      await wrapped[method]({
        inputFormat: 'messages',
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        tools: [
          {
            type: 'function',
            name: 'strictTool',
            description: 'A strict tool',
            strict: true,
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
          },
        ],
      } as any);

      const call = (model[method] as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.tools[0]).not.toHaveProperty('strict');
    },
  );
});
